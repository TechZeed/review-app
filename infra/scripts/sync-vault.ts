#!/usr/bin/env bun
/**
 * sync-vault — distribute .env.dev values to their real stores.
 *
 * String sections (values synced as-is):
 *   ##### GCP Secrets #####      → GCP Secret Manager (via SECRET_MAP name)
 *   ##### GitHub Secrets #####   → `gh secret set`
 *   ##### Both #####             → pushed to both
 *   ##### Local #####            → untouched
 *
 * File vault sections (file CONTENTS synced; path given as value):
 *   ##### GCP Vault Files #####     → GCP Secret Manager, mounted on Cloud
 *                                     Run via --set-secrets file mount
 *   ##### GitHub Vault Files #####  → GH Secrets as base64, decoded at CI
 *                                     boot by .github/actions/hydrate-vault
 *
 * Usage:
 *   bun run --env-file=.env.dev infra/scripts/sync-vault.ts          # push all
 *   bun run --env-file=.env.dev infra/scripts/sync-vault.ts gcp      # GCP strings + files
 *   bun run --env-file=.env.dev infra/scripts/sync-vault.ts gh       # GH strings + files
 *   bun run --env-file=.env.dev infra/scripts/sync-vault.ts --dry    # preview
 *   bun run --env-file=.env.dev infra/scripts/sync-vault.ts pull     # pull GCP vault
 *                                                                  files to disk
 *   bun run --env-file=.env.dev infra/scripts/sync-vault.ts pull --force  # overwrite
 *
 * See docs/specs/22-file-vault-pattern.md.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { resolve, dirname, basename } from "node:path";

// Concurrency for remote writes. 6 matches what reqsume (secrets.go) settled
// on — high enough to hide gh/gcloud's ~500ms cold-start, low enough to stay
// under GitHub's secondary-rate-limit for /repos/{}/actions/secrets.
const CONCURRENCY = 6;

async function pool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

function runAsync(
  cmd: string,
  args: string[],
  input?: string | Buffer,
): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise((resolvePromise) => {
    const proc = spawn(cmd, args);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => resolvePromise({ ok: code === 0, out, err }));
    proc.on("error", (e) => resolvePromise({ ok: false, out, err: err + e.message }));
    if (input !== undefined) proc.stdin.end(input);
    else proc.stdin.end();
  });
}

// String-secret env var → GCP Secret Manager name. Must match SECRET_MAP
// in apps/api/src/config/configResolver.ts.
const GCP_SECRET_NAMES: Record<string, string> = {
  JWT_SECRET: "review-jwt-secret",
  POSTGRES_PASSWORD: "review-db-password",
  POSTGRES_HOST: "review-db-host",
  POSTGRES_DB: "review-db-name",
  POSTGRES_USER: "review-db-user",
  STRIPE_SECRET_KEY: "review-stripe-secret",
  STRIPE_WEBHOOK_SECRET: "review-stripe-webhook-secret",
};

type Section =
  | "gcp"
  | "gh"
  | "both"
  | "local"
  | "gcp_vault"
  | "gh_vault"
  | null;

type Entry = { key: string; value: string; section: Exclude<Section, null> };

const SECTION_HEADER =
  /^#+\s*#{3,}\s*(GCP Vault Files|GitHub Vault Files|GCP Secrets|GitHub Secrets|Both|Local)\s*#{3,}/i;

function sectionOf(name: string): Exclude<Section, null> {
  const n = name.toLowerCase();
  if (n.startsWith("gcp vault")) return "gcp_vault";
  if (n.startsWith("github vault")) return "gh_vault";
  if (n.startsWith("gcp")) return "gcp";
  if (n.startsWith("github")) return "gh";
  if (n === "both") return "both";
  return "local";
}

function parseEnvFile(path: string): Entry[] {
  const entries: Entry[] = [];
  let section: Section = null;

  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    const header = line.match(SECTION_HEADER);
    if (header) {
      section = sectionOf(header[1]);
      continue;
    }

    if (!section || !line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!key) continue;

    entries.push({ key, value, section });
  }

  return entries;
}

function run(
  cmd: string,
  args: string[],
  input?: string | Buffer,
): { ok: boolean; out: string; err: string } {
  const r = spawnSync(cmd, args, { input, encoding: "utf8" });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function runBinary(
  cmd: string,
  args: string[],
): { ok: boolean; stdout: Buffer; err: string } {
  const r = spawnSync(cmd, args, { encoding: "buffer" });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? Buffer.alloc(0),
    err: (r.stderr ?? Buffer.alloc(0)).toString("utf8"),
  };
}

function gcloudProject(): string {
  return process.env.GCP_PROJECT_ID ?? "";
}

function gcpSecretExists(name: string): boolean {
  const r = run("gcloud", [
    "secrets",
    "describe",
    name,
    `--project=${gcloudProject()}`,
    "--quiet",
  ]);
  return r.ok;
}

function ensureGcpSecret(name: string): boolean {
  if (gcpSecretExists(name)) return true;
  const r = run("gcloud", [
    "secrets",
    "create",
    name,
    `--project=${gcloudProject()}`,
    "--replication-policy=automatic",
    "--quiet",
  ]);
  return r.ok;
}

function addGcpVersion(name: string, data: string | Buffer): { ok: boolean; err: string } {
  const r = spawnSync(
    "gcloud",
    [
      "secrets",
      "versions",
      "add",
      name,
      `--project=${gcloudProject()}`,
      "--data-file=-",
      "--quiet",
    ],
    { input: data, encoding: "utf8" },
  );
  return { ok: r.status === 0, err: r.stderr ?? "" };
}

// ─── String secret sync ─────────────────────────────────────────

async function syncGcp(entry: Entry, dry: boolean): Promise<void> {
  const secretName = GCP_SECRET_NAMES[entry.key];
  if (!secretName) {
    console.log(`  ⏭  ${entry.key} — no GCP secret name mapped, skipping`);
    return;
  }
  if (dry) {
    console.log(`  [dry] ${entry.key} → gcp:${secretName}`);
    return;
  }
  if (!ensureGcpSecret(secretName)) {
    console.log(`  ✗ ${entry.key} — create failed`);
    return;
  }
  const r = await runAsync(
    "gcloud",
    ["secrets", "versions", "add", secretName, `--project=${gcloudProject()}`, "--data-file=-", "--quiet"],
    entry.value,
  );
  console.log(
    r.ok
      ? `  ✓ ${entry.key} → gcp:${secretName}`
      : `  ✗ ${entry.key} — ${r.err.trim()}`,
  );
}

async function syncGh(entry: Entry, dry: boolean): Promise<void> {
  if (entry.key === "GCP_SA_KEY_FILE") {
    const path = resolve(entry.value);
    if (!existsSync(path)) {
      console.log(`  ⏭  GCP_SA_KEY_FILE → ${path} not found, skipping GCP_SA_KEY`);
      return;
    }
    const body = readFileSync(path, "utf8");
    if (dry) {
      console.log(`  [dry] GCP_SA_KEY (from ${path}) → gh secret`);
      return;
    }
    const r = await runAsync("gh", ["secret", "set", "GCP_SA_KEY"], body);
    console.log(
      r.ok
        ? `  ✓ GCP_SA_KEY (from ${path}) → gh`
        : `  ✗ GCP_SA_KEY — ${r.err.trim()}`,
    );
    return;
  }

  if (dry) {
    console.log(`  [dry] ${entry.key} → gh secret`);
    return;
  }
  const r = await runAsync("gh", ["secret", "set", entry.key], entry.value);
  console.log(r.ok ? `  ✓ ${entry.key} → gh` : `  ✗ ${entry.key} — ${r.err.trim()}`);
}

// ─── Vault file sync ────────────────────────────────────────────

const REPO_ROOT = resolve(import.meta.dir, "../..");

/** Stem from an env var: FIREBASE_SA_PATH → firebase-sa. */
function stemFromKey(key: string): string {
  if (!key.endsWith("_PATH")) {
    throw new Error(`Vault file key must end in _PATH (got ${key})`);
  }
  return key
    .slice(0, -"_PATH".length)
    .toLowerCase()
    .replace(/_/g, "-");
}

export function gcpSecretNameForVaultKey(key: string): string {
  return `review-${stemFromKey(key)}`;
}

export function ghSecretNameForVaultKey(key: string): string {
  return `${stemFromKey(key).toUpperCase().replace(/-/g, "_")}_B64`;
}

function resolveVaultPath(valuePath: string): string {
  // Values in .env.dev are repo-root-relative (e.g. infra/dev/vault/foo.json).
  // Legacy entries may still carry a `../../` prefix (apps/api-relative) —
  // strip it so both resolve to the same absolute path.
  const stripped = valuePath.startsWith("../../")
    ? valuePath.slice("../../".length)
    : valuePath;
  return resolve(REPO_ROOT, stripped);
}

async function syncGcpVault(entry: Entry, dry: boolean): Promise<void> {
  const abs = resolveVaultPath(entry.value);
  if (!existsSync(abs)) {
    console.log(`  ⏭  ${entry.key} → ${abs} not found, skipping`);
    return;
  }
  const secretName = gcpSecretNameForVaultKey(entry.key);
  if (dry) {
    console.log(`  [dry] ${entry.key} (${abs}) → gcp:${secretName}`);
    return;
  }
  if (!ensureGcpSecret(secretName)) {
    console.log(`  ✗ ${entry.key} — create failed`);
    return;
  }
  const bytes = readFileSync(abs);
  const r = await runAsync(
    "gcloud",
    ["secrets", "versions", "add", secretName, `--project=${gcloudProject()}`, "--data-file=-", "--quiet"],
    bytes,
  );
  console.log(
    r.ok
      ? `  ✓ ${entry.key} (${abs}) → gcp:${secretName}`
      : `  ✗ ${entry.key} — ${r.err.trim()}`,
  );
}

async function syncGhVault(entry: Entry, dry: boolean): Promise<void> {
  const abs = resolveVaultPath(entry.value);
  if (!existsSync(abs)) {
    console.log(`  ⏭  ${entry.key} → ${abs} not found, skipping`);
    return;
  }
  const ghName = ghSecretNameForVaultKey(entry.key);
  if (dry) {
    console.log(`  [dry] ${entry.key} (${abs}) → gh:${ghName}`);
    return;
  }
  const b64 = readFileSync(abs).toString("base64");
  const r = await runAsync("gh", ["secret", "set", ghName], b64);
  console.log(
    r.ok
      ? `  ✓ ${entry.key} (${abs}) → gh:${ghName}`
      : `  ✗ ${entry.key} — ${r.err.trim()}`,
  );
}

function pullGcpVault(entry: Entry, force: boolean): void {
  const abs = resolveVaultPath(entry.value);
  if (existsSync(abs) && !force) {
    console.log(`  ⏭  ${entry.key} → ${abs} already exists (use --force to overwrite)`);
    return;
  }
  const secretName = gcpSecretNameForVaultKey(entry.key);
  const r = runBinary("gcloud", [
    "secrets",
    "versions",
    "access",
    "latest",
    `--secret=${secretName}`,
    `--project=${gcloudProject()}`,
    "--quiet",
  ]);
  if (!r.ok) {
    console.log(`  ✗ ${entry.key} → gcp:${secretName} — ${r.err.trim()}`);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true, mode: 0o700 });
  writeFileSync(abs, r.stdout);
  chmodSync(abs, 0o600);
  console.log(`  ✓ ${entry.key} ← gcp:${secretName} → ${abs}`);
}

// ─── Main ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry") || args.includes("--dry-run");
  const force = args.includes("--force");
  const mode = args.find((a) => a === "gcp" || a === "gh" || a === "pull");

  const envPath = resolve(REPO_ROOT, ".env.dev");
  if (!existsSync(envPath)) {
    console.error(`.env.dev not found at ${envPath}`);
    process.exit(1);
  }

  if (!gcloudProject()) {
    console.error("GCP_PROJECT_ID not set. Run with `bun run --env-file=.env.dev ...`");
    process.exit(1);
  }

  const entries = parseEnvFile(envPath);
  const gcp = entries.filter((e) => e.section === "gcp" || e.section === "both");
  const gh = entries.filter((e) => e.section === "gh" || e.section === "both");
  const gcpVault = entries.filter((e) => e.section === "gcp_vault");
  const ghVault = entries.filter((e) => e.section === "gh_vault");

  const started = Date.now();
  console.log(
    `sync-vault — project=${gcloudProject()} mode=${mode ?? "all"} dry=${dry} concurrency=${CONCURRENCY}`,
  );

  if (mode === "pull") {
    console.log(`\nPulling ${gcpVault.length} GCP vault files (force=${force}):`);
    for (const e of gcpVault) pullGcpVault(e, force);
    console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
    return;
  }

  if (!mode || mode === "gcp") {
    console.log(`\nGCP Secret Manager — strings (${gcp.length}):`);
    await pool(gcp, (e) => syncGcp(e, dry));
    console.log(`\nGCP Secret Manager — vault files (${gcpVault.length}):`);
    await pool(gcpVault, (e) => syncGcpVault(e, dry));
  }

  if (!mode || mode === "gh") {
    console.log(`\nGitHub Secrets — strings (${gh.length}):`);
    await pool(gh, (e) => syncGh(e, dry));
    console.log(`\nGitHub Secrets — vault files (${ghVault.length}):`);
    await pool(ghVault, (e) => syncGhVault(e, dry));
  }

  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
