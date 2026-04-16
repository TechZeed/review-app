#!/usr/bin/env node

/**
 * Review App Deployment Script
 *
 * Usage: node deploy.js <service> <environment>
 *   service:     api | web | ui | all
 *   environment: dev | staging | prod
 *
 * Builds, pushes, and deploys the specified service(s) to GCP Cloud Run.
 */

const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GCP_PROJECT = 'humini-review';
const GCP_REGION = 'asia-southeast1';
const ARTIFACT_REGISTRY = `${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/review-apps`;
const CLOUDSQL_CONNECTION = 'humini-review:asia-southeast1:review-db-dev';

const VALID_SERVICES = ['api', 'web', 'ui'];
const VALID_ENVS = ['dev', 'staging', 'prod'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, label) {
  console.log(`\n>>> ${label || cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error(`\nFailed: ${label || cmd}`);
    process.exit(1);
  }
}

function timestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

// ---------------------------------------------------------------------------
// Secret Manager references (for Cloud Run --set-secrets flag)
// ---------------------------------------------------------------------------

function secretRef(secretName) {
  return `projects/${GCP_PROJECT}/secrets/${secretName}/versions/latest`;
}

function buildApiSecrets() {
  // Maps Cloud Run env var name -> GCP Secret Manager secret name
  const mapping = {
    POSTGRES_PASSWORD: 'review-db-password',
    JWT_SECRET: 'review-jwt-secret',
    STRIPE_SECRET_KEY: 'review-stripe-secret',
    STRIPE_WEBHOOK_SECRET: 'review-stripe-webhook-secret',
  };
  return Object.entries(mapping)
    .map(([envVar, secret]) => `${envVar}=${secret}:latest`)
    .join(',');
}

// ---------------------------------------------------------------------------
// Deploy functions
// ---------------------------------------------------------------------------

function buildAndPush(service, env) {
  const ts = timestamp();
  const tag = `${env}-${ts}`;
  const localImage = `review-${service}:${tag}`;
  const remoteImage = `${ARTIFACT_REGISTRY}/${service}:${tag}`;

  console.log(`\n========================================`);
  console.log(`Building ${service} for ${env}`);
  console.log(`Image: ${remoteImage}`);
  console.log(`========================================`);

  const buildArgs = (service === 'web' || service === 'ui')
    ? `--build-arg VITE_API_URL=https://review-api.teczeed.com --build-arg VITE_FIREBASE_API_KEY=AIzaSyBAQ3fKCEiCn-z7VPG9jEzQ-XA9rCWBvhE --build-arg VITE_FIREBASE_AUTH_DOMAIN=humini-review.firebaseapp.com --build-arg VITE_FIREBASE_PROJECT_ID=humini-review`
    : '';
  run(`docker build ${buildArgs} -t ${localImage} apps/${service}/`, `Build ${service}`);
  run(`docker tag ${localImage} ${remoteImage}`, `Tag ${service}`);
  run(`docker push ${remoteImage}`, `Push ${service}`);

  return remoteImage;
}

function deployApi(image, env) {
  const serviceName = `review-api-${env}`;
  const secrets = buildApiSecrets();

  const envPairs = {
    NODE_ENV: 'production',
    GCP_PROJECT_ID: GCP_PROJECT,
    CLOUDSQL_CONNECTION_NAME: CLOUDSQL_CONNECTION,
    POSTGRES_DB: 'dev_review_db',
    POSTGRES_USER: 'review_user',
    FIREBASE_PROJECT_ID: GCP_PROJECT,
    GCP_BUCKET_NAME: 'humini-review-media-dev',
    JWT_EXPIRATION_TIME_IN_MINUTES: '60',
    SMS_PROVIDER: 'mock',
    REVIEW_TOKEN_EXPIRY_HOURS: '48',
    REVIEW_COOLDOWN_DAYS: '7',
    SIGNED_URL_EXPIRY_MINUTES: '60',
    ENABLE_HTTP_LOGGING: 'false',
    APP_URL: 'https://review-api.teczeed.com',
    FRONTEND_URL: 'https://review-scan.teczeed.com',
    CORS_ORIGINS: 'https://review-scan.teczeed.com,https://review-dashboard.teczeed.com,https://review-profile.teczeed.com',
  };

  // Build --set-env-vars with ^ delimiter (commas in values break default delimiter)
  const envFlags = '--set-env-vars=^||^' + Object.entries(envPairs)
    .map(([k, v]) => `${k}=${v}`)
    .join('||');

  const cmd = [
    'gcloud run deploy', serviceName,
    `--image=${image}`,
    `--region=${GCP_REGION}`,
    `--platform=managed`,
    `--allow-unauthenticated`,
    `--add-cloudsql-instances=${CLOUDSQL_CONNECTION}`,
    envFlags,
    `--set-secrets="${secrets}"`,
    `--min-instances=0`,
    `--max-instances=2`,
    `--memory=512Mi`,
    `--cpu=1`,
    `--port=8080`,
    `--timeout=300`,
    `--project=${GCP_PROJECT}`,
    `--quiet`,
  ].join(' ');

  run(cmd, `Deploy ${serviceName}`);
  console.log(`\n${serviceName} deployed successfully.`);
}

function deployFrontend(service, image, env) {
  const serviceName = `review-${service}-${env}`;

  const envVars = [
    'NODE_ENV=production',
  ].join(',');

  const cmd = [
    'gcloud run deploy', serviceName,
    `--image=${image}`,
    `--region=${GCP_REGION}`,
    `--platform=managed`,
    `--allow-unauthenticated`,
    `--set-env-vars="${envVars}"`,
    `--min-instances=0`,
    `--max-instances=2`,
    `--memory=256Mi`,
    `--cpu=1`,
    `--port=80`,
    `--timeout=300`,
    `--project=${GCP_PROJECT}`,
    `--quiet`,
  ].join(' ');

  run(cmd, `Deploy ${serviceName}`);
  console.log(`\n${serviceName} deployed successfully.`);
}

function deployService(service, env) {
  const image = buildAndPush(service, env);

  if (service === 'api') {
    deployApi(image, env);
  } else {
    deployFrontend(service, image, env);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node deploy.js <service> <environment>');
    console.error('  service:     api | web | ui | all');
    console.error('  environment: dev | staging | prod');
    process.exit(1);
  }

  const [serviceArg, env] = args;

  if (!VALID_ENVS.includes(env)) {
    console.error(`Invalid environment: ${env}. Must be one of: ${VALID_ENVS.join(', ')}`);
    process.exit(1);
  }

  const services = serviceArg === 'all' ? VALID_SERVICES : [serviceArg];

  for (const svc of services) {
    if (!VALID_SERVICES.includes(svc)) {
      console.error(`Invalid service: ${svc}. Must be one of: ${VALID_SERVICES.join(', ')}, all`);
      process.exit(1);
    }
  }

  // Ensure Docker is authenticated to Artifact Registry
  run(
    `gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev --quiet`,
    'Configure Docker for Artifact Registry'
  );

  // Ensure Artifact Registry repository exists
  run(
    `gcloud artifacts repositories describe review-apps --location=${GCP_REGION} --project=${GCP_PROJECT} 2>/dev/null || ` +
    `gcloud artifacts repositories create review-apps --repository-format=docker --location=${GCP_REGION} --project=${GCP_PROJECT}`,
    'Ensure Artifact Registry repository exists'
  );

  for (const svc of services) {
    deployService(svc, env);
  }

  console.log('\n========================================');
  console.log('Deployment complete!');
  console.log('========================================');
}

main();
