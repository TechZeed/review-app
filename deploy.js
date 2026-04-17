#!/usr/bin/env node

/**
 * Review App Deployment Script
 *
 * Usage:
 *   node deploy.js <service> <environment>   # build + deploy (also syncs secrets)
 *   node deploy.js secrets <environment>     # sync .env.<env> secrets to GCP Secret Manager only
 *   node deploy.js all <environment>         # deploy api + web + ui
 *
 *   service:     api | web | ui | all | secrets
 *   environment: dev | staging | prod
 *
 * Source of truth: .env.<environment> at repo root. All values (env vars, build args,
 * secret values) are read from there. The script never hardcodes config.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Fixed infra identifiers (not config — these name the infra itself)
// ---------------------------------------------------------------------------

const GCP_PROJECT = 'humini-review';
const GCP_REGION = 'asia-southeast1';
const ARTIFACT_REGISTRY = `${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/review-apps`;
const CLOUDSQL_CONNECTION = 'humini-review:asia-southeast1:review-db-dev';

const VALID_SERVICES = ['api', 'web', 'ui'];
const VALID_ENVS = ['dev', 'staging', 'prod'];

// ---------------------------------------------------------------------------
// Env var classification
// ---------------------------------------------------------------------------

// Env var name in Cloud Run -> Secret Manager secret name.
// These are read from .env.<env> and pushed to Secret Manager; Cloud Run
// references them via --set-secrets.
const SECRET_MAPPING = {
  POSTGRES_PASSWORD: 'review-db-password',
  JWT_SECRET: 'review-jwt-secret',
  STRIPE_SECRET_KEY: 'review-stripe-secret',
  STRIPE_WEBHOOK_SECRET: 'review-stripe-webhook-secret',
};

// Keys from .env.<env> that are local-dev only — never sent to Cloud Run.
const LOCAL_ONLY_KEYS = new Set([
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'FIREBASE_SERVICE_ACCOUNT_PATH',
  'EXPO_TOKEN',
  'PORT',
]);

// Vite build-arg keys used for web/ui docker builds.
const VITE_BUILD_ARG_KEYS = [
  'VITE_API_URL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
];

// Forced overrides — always applied regardless of .env.<env> contents.
const FORCED_ENV = {
  NODE_ENV: 'production',
};

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

function loadEnvFile(env) {
  const filePath = path.join(__dirname, `.env.${env}`);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing env file: ${filePath}`);
    process.exit(1);
  }
  const result = {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function requireKeys(envMap, keys, context) {
  const missing = keys.filter((k) => !envMap[k] || envMap[k].length === 0);
  if (missing.length) {
    console.error(`Missing required keys in .env file (${context}): ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Secret Manager sync
// ---------------------------------------------------------------------------

function secretExists(secretName) {
  try {
    execSync(
      `gcloud secrets describe ${secretName} --project=${GCP_PROJECT}`,
      { stdio: 'ignore' }
    );
    return true;
  } catch {
    return false;
  }
}

function currentSecretValue(secretName) {
  try {
    return execSync(
      `gcloud secrets versions access latest --secret=${secretName} --project=${GCP_PROJECT}`,
      { stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString();
  } catch {
    return null;
  }
}

function upsertSecret(secretName, value) {
  if (!secretExists(secretName)) {
    console.log(`  [create] ${secretName}`);
    execSync(
      `gcloud secrets create ${secretName} --replication-policy=automatic --project=${GCP_PROJECT}`,
      { stdio: 'inherit' }
    );
  }
  const existing = currentSecretValue(secretName);
  if (existing === value) {
    console.log(`  [unchanged] ${secretName}`);
    return;
  }
  console.log(`  [update] ${secretName}`);
  execSync(
    `gcloud secrets versions add ${secretName} --data-file=- --project=${GCP_PROJECT}`,
    { input: value, stdio: ['pipe', 'inherit', 'inherit'] }
  );
}

function syncSecrets(envMap) {
  console.log(`\n>>> Sync secrets to GCP Secret Manager (project=${GCP_PROJECT})`);
  requireKeys(envMap, Object.keys(SECRET_MAPPING), 'secrets');
  for (const [envVar, secretName] of Object.entries(SECRET_MAPPING)) {
    upsertSecret(secretName, envMap[envVar]);
  }
}

function buildApiSecretsFlag() {
  return Object.entries(SECRET_MAPPING)
    .map(([envVar, secret]) => `${envVar}=${secret}:latest`)
    .join(',');
}

// ---------------------------------------------------------------------------
// Build Cloud Run env var set from .env.<env>
// ---------------------------------------------------------------------------

function buildCloudRunEnv(envMap) {
  const secretKeys = new Set(Object.keys(SECRET_MAPPING));
  const viteKeys = new Set(VITE_BUILD_ARG_KEYS);
  const out = {};
  for (const [k, v] of Object.entries(envMap)) {
    if (secretKeys.has(k)) continue;      // injected via --set-secrets
    if (LOCAL_ONLY_KEYS.has(k)) continue; // dev-machine only
    if (viteKeys.has(k)) continue;        // baked into frontend bundle at build time
    out[k] = v;
  }
  Object.assign(out, FORCED_ENV);
  return out;
}

// ---------------------------------------------------------------------------
// Build + deploy
// ---------------------------------------------------------------------------

function buildAndPush(service, env, envMap) {
  const ts = timestamp();
  const tag = `${env}-${ts}`;
  const localImage = `review-${service}:${tag}`;
  const remoteImage = `${ARTIFACT_REGISTRY}/${service}:${tag}`;

  console.log(`\n========================================`);
  console.log(`Building ${service} for ${env}`);
  console.log(`Image: ${remoteImage}`);
  console.log(`========================================`);

  let buildArgs = '';
  if (service === 'web' || service === 'ui') {
    const present = VITE_BUILD_ARG_KEYS.filter((k) => envMap[k]);
    buildArgs = present
      .map((k) => `--build-arg ${k}=${envMap[k]}`)
      .join(' ');
  }

  run(`docker build ${buildArgs} -t ${localImage} apps/${service}/`, `Build ${service}`);
  run(`docker tag ${localImage} ${remoteImage}`, `Tag ${service}`);
  run(`docker push ${remoteImage}`, `Push ${service}`);

  return remoteImage;
}

function writeEnvVarsFile(envPairs) {
  // YAML file — values are JSON-encoded for safe escaping of commas/quotes/etc.
  const lines = Object.entries(envPairs).map(
    ([k, v]) => `${k}: ${JSON.stringify(String(v))}`
  );
  const filePath = path.join(__dirname, `.deploy-env-vars.${process.pid}.yaml`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
  return filePath;
}

function deployApi(image, env, envMap) {
  const serviceName = `review-api-${env}`;
  const secrets = buildApiSecretsFlag();
  const envPairs = buildCloudRunEnv(envMap);
  const envVarsFile = writeEnvVarsFile(envPairs);

  const cmd = [
    'gcloud run deploy', serviceName,
    `--image=${image}`,
    `--region=${GCP_REGION}`,
    `--platform=managed`,
    `--allow-unauthenticated`,
    `--add-cloudsql-instances=${CLOUDSQL_CONNECTION}`,
    `--env-vars-file=${envVarsFile}`,
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

  try {
    run(cmd, `Deploy ${serviceName}`);
  } finally {
    try { fs.unlinkSync(envVarsFile); } catch {}
  }
  console.log(`\n${serviceName} deployed successfully.`);
}

function deployFrontend(service, image, env) {
  const serviceName = `review-${service}-${env}`;

  const envVars = ['NODE_ENV=production'].join(',');

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

function deployService(service, env, envMap) {
  const image = buildAndPush(service, env, envMap);
  if (service === 'api') {
    deployApi(image, env, envMap);
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
    console.error('  service:     api | web | ui | all | secrets');
    console.error('  environment: dev | staging | prod');
    process.exit(1);
  }

  const [serviceArg, env] = args;

  if (!VALID_ENVS.includes(env)) {
    console.error(`Invalid environment: ${env}. Must be one of: ${VALID_ENVS.join(', ')}`);
    process.exit(1);
  }

  const envMap = loadEnvFile(env);

  // Secrets-only mode: sync and exit.
  if (serviceArg === 'secrets') {
    syncSecrets(envMap);
    console.log('\nSecrets synced.');
    return;
  }

  const services = serviceArg === 'all' ? VALID_SERVICES : [serviceArg];
  for (const svc of services) {
    if (!VALID_SERVICES.includes(svc)) {
      console.error(`Invalid service: ${svc}. Must be one of: ${VALID_SERVICES.join(', ')}, all, secrets`);
      process.exit(1);
    }
  }

  run(
    `gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev --quiet`,
    'Configure Docker for Artifact Registry'
  );

  run(
    `gcloud artifacts repositories describe review-apps --location=${GCP_REGION} --project=${GCP_PROJECT} 2>/dev/null || ` +
    `gcloud artifacts repositories create review-apps --repository-format=docker --location=${GCP_REGION} --project=${GCP_PROJECT}`,
    'Ensure Artifact Registry repository exists'
  );

  // If api is being deployed, sync secrets first so Cloud Run can reference them.
  if (services.includes('api')) {
    syncSecrets(envMap);
  }

  for (const svc of services) {
    deployService(svc, env, envMap);
  }

  console.log('\n========================================');
  console.log('Deployment complete!');
  console.log('========================================');
}

main();
