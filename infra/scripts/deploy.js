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

// Script lives at infra/scripts/; repo root is two levels up. Everything
// below (.env files, app dirs, deploy-env-vars tempfile, vault paths)
// resolves against ROOT_DIR — never __dirname, never process.cwd().
const ROOT_DIR = path.resolve(__dirname, '..', '..');

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
  'VITE_FEATURE_EMAIL_LOGIN',
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
    execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR });
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

const SECTION_HEADER_RE =
  /^#+\s*#{3,}\s*(GCP Vault Files|GitHub Vault Files|GCP Secrets|GitHub Secrets|Both|Local)\s*#{3,}/i;

// Keys deploy.js understands. Used for the process.env overlay when
// running in CI where .env.<env> is empty/absent and secrets come in
// as job-level env vars (see .github/workflows/deploy.yml).
const KNOWN_CONFIG_KEYS = [
  'NODE_ENV',
  'GCP_PROJECT_ID', 'GCP_REGION', 'CLOUDSQL_CONNECTION_NAME',
  'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD',
  'JWT_SECRET', 'JWT_EXPIRATION_TIME_IN_MINUTES',
  'FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_PATH',
  'GCP_BUCKET_NAME', 'SIGNED_URL_EXPIRY_MINUTES',
  'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRODUCT_PRO', 'STRIPE_PRODUCT_EMPLOYER', 'STRIPE_PRODUCT_RECRUITER',
  'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_ANNUAL',
  'STRIPE_PRICE_EMPLOYER_SMALL', 'STRIPE_PRICE_EMPLOYER_MEDIUM', 'STRIPE_PRICE_EMPLOYER_LARGE',
  'STRIPE_PRICE_RECRUITER_BASIC', 'STRIPE_PRICE_RECRUITER_PREMIUM',
  'SMS_PROVIDER',
  'APP_BASE_URL', 'API_BASE_URL', 'APP_URL', 'FRONTEND_URL', 'CORS_ORIGINS',
  'REVIEW_TOKEN_EXPIRY_HOURS', 'REVIEW_COOLDOWN_DAYS',
  'ENABLE_HTTP_LOGGING',
  'EXPO_TOKEN',
  'VITE_API_URL',
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MEASUREMENT_ID',
];

function loadEnvFile(env) {
  const filePath = path.join(ROOT_DIR, `.env.${env}`);
  const result = {};
  const gcpVaultFiles = {}; // KEY → local path (repo-root-resolved)

  if (fs.existsSync(filePath)) {
    let section = null;
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const raw of lines) {
      const line = raw.trim();

      const header = line.match(SECTION_HEADER_RE);
      if (header) {
        const n = header[1].toLowerCase();
        if (n.startsWith('gcp vault')) section = 'gcp_vault';
        else if (n.startsWith('github vault')) section = 'gh_vault';
        else section = 'other';
        continue;
      }

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

      if (section === 'gcp_vault' && key.endsWith('_PATH')) {
        const stripped = value.startsWith('../../') ? value.slice(6) : value;
        gcpVaultFiles[key] = path.resolve(ROOT_DIR, stripped);
      }
    }
  }

  // Overlay process.env for known keys (CI path — secrets injected as
  // job-level env vars). process.env wins over file so CI can override.
  for (const key of KNOWN_CONFIG_KEYS) {
    const v = process.env[key];
    if (v !== undefined && v !== '') {
      result[key] = v;
    }
  }

  if (Object.keys(result).length === 0) {
    console.error(
      `No config found: ${filePath} missing and no KNOWN_CONFIG_KEYS present in process.env`,
    );
    process.exit(1);
  }

  result.__gcpVaultFiles = gcpVaultFiles;
  return result;
}

// Vault file key → { secretName, mountPath }.
// FIREBASE_SA_PATH → { secretName: 'review-firebase-sa', mountPath: '/secrets/firebase-sa.json' }
function vaultFileMeta(key, localPath) {
  const stem = key.slice(0, -'_PATH'.length).toLowerCase().replace(/_/g, '-');
  return {
    secretName: `review-${stem}`,
    mountPath: `/secrets/${path.basename(localPath)}`,
  };
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
  // In CI, the deployer SA typically only has `secretmanager.secretAccessor`
  // — enough to reference secrets from Cloud Run but not to create/update
  // them. Set SKIP_SECRET_SYNC=true in the workflow to skip upserts and
  // assume sync-vault.ts (run from a human's machine with admin perms)
  // has already populated Secret Manager.
  if (process.env.SKIP_SECRET_SYNC === 'true') {
    console.log('\n>>> Skip Secret Manager sync (SKIP_SECRET_SYNC=true)');
    requireKeys(envMap, Object.keys(SECRET_MAPPING), 'secrets');
    return;
  }
  console.log(`\n>>> Sync secrets to GCP Secret Manager (project=${GCP_PROJECT})`);
  requireKeys(envMap, Object.keys(SECRET_MAPPING), 'secrets');
  for (const [envVar, secretName] of Object.entries(SECRET_MAPPING)) {
    upsertSecret(secretName, envMap[envVar]);
  }

  // Vault files: push file CONTENTS to Secret Manager so Cloud Run can
  // --set-secrets mount them at runtime.
  const vaultFiles = envMap.__gcpVaultFiles || {};
  for (const [envKey, localPath] of Object.entries(vaultFiles)) {
    const { secretName } = vaultFileMeta(envKey, localPath);
    if (!fs.existsSync(localPath)) {
      console.error(`  [skip] ${envKey} → ${localPath} not found`);
      continue;
    }
    const bytes = fs.readFileSync(localPath);
    if (!secretExists(secretName)) {
      console.log(`  [create] ${secretName}`);
      execSync(
        `gcloud secrets create ${secretName} --replication-policy=automatic --project=${GCP_PROJECT}`,
        { stdio: 'inherit' },
      );
    }
    console.log(`  [update] ${secretName} (from ${path.relative(ROOT_DIR, localPath)})`);
    execSync(
      `gcloud secrets versions add ${secretName} --data-file=- --project=${GCP_PROJECT}`,
      { input: bytes, stdio: ['pipe', 'inherit', 'inherit'] },
    );
  }
}

function buildApiSecretsFlag(envMap) {
  const stringSecrets = Object.entries(SECRET_MAPPING).map(
    ([envVar, secret]) => `${envVar}=${secret}:latest`,
  );

  // Mount vault files as /secrets/<basename>:<secretName>:latest.
  // Cloud Run writes the file at container start via platform IAM; app
  // never needs Secret Manager permissions at runtime.
  const vaultFiles = envMap.__gcpVaultFiles || {};
  const fileMounts = Object.entries(vaultFiles).map(([envKey, localPath]) => {
    const { secretName, mountPath } = vaultFileMeta(envKey, localPath);
    return `${mountPath}=${secretName}:latest`;
  });

  return [...stringSecrets, ...fileMounts].join(',');
}

// ---------------------------------------------------------------------------
// Build Cloud Run env var set from .env.<env>
// ---------------------------------------------------------------------------

function buildCloudRunEnv(envMap, deployEnv) {
  const secretKeys = new Set(Object.keys(SECRET_MAPPING));
  const viteKeys = new Set(VITE_BUILD_ARG_KEYS);
  const vaultFiles = envMap.__gcpVaultFiles || {};
  const vaultKeys = new Set(Object.keys(vaultFiles));
  const out = {};
  for (const [k, v] of Object.entries(envMap)) {
    if (k.startsWith('__')) continue;     // internal bookkeeping
    if (secretKeys.has(k)) continue;      // injected via --set-secrets
    if (LOCAL_ONLY_KEYS.has(k)) continue; // dev-machine only
    if (viteKeys.has(k)) continue;        // baked into frontend bundle at build time
    if (vaultKeys.has(k)) continue;       // overridden below to the Cloud Run mount path
    out[k] = v;
  }
  // Override each vault file env var with its Cloud Run mount path so the
  // running app sees e.g. FIREBASE_SA_PATH=/secrets/firebase-sa.json.
  for (const [envKey, localPath] of Object.entries(vaultFiles)) {
    const { mountPath } = vaultFileMeta(envKey, localPath);
    out[envKey] = mountPath;
  }
  Object.assign(out, FORCED_ENV);
  // APP_ENV selects which apps/api/config/application.<env>.env the runtime
  // loads. Maps the deploy env (dev|staging|prod) → APP_ENV (dev|prod).
  out.APP_ENV = deployEnv === 'staging' ? 'prod' : deployEnv;
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
  const filePath = path.join(ROOT_DIR, `.deploy-env-vars.${process.pid}.yaml`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
  return filePath;
}

function deployApi(image, env, envMap) {
  const serviceName = `review-api-${env}`;
  const secrets = buildApiSecretsFlag(envMap);
  const envPairs = buildCloudRunEnv(envMap, env);
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
