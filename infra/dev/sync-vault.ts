#!/usr/bin/env bun
/**
 * sync-vault — distribute .env.dev values to their real stores.
 *
 * Reads .env.dev, parsed by section headers:
 *   ##### GCP Secrets #####    → pushed to GCP Secret Manager
 *   ##### GitHub Secrets #####  → pushed via `gh secret set`
 *   ##### Local #####           → untouched (local-dev-only)
 *
 * Usage:
 *   bun run --env-file=.env.dev infra/dev/sync-vault.ts          # sync all
 *   bun run --env-file=.env.dev infra/dev/sync-vault.ts gcp      # GCP only
 *   bun run --env-file=.env.dev infra/dev/sync-vault.ts gh       # GitHub only
 *   bun run --env-file=.env.dev infra/dev/sync-vault.ts --dry    # preview
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Env var → GCP Secret Manager secret name. Must match SECRET_MAP in
// apps/api/src/config/configResolver.ts.
const GCP_SECRET_NAMES: Record<string, string> = {
  JWT_SECRET: "review-jwt-secret",
  POSTGRES_PASSWORD: "review-db-password",
  POSTGRES_HOST: "review-db-host",
  POSTGRES_DB: "review-db-name",
  POSTGRES_USER: "review-db-user",
  STRIPE_SECRET_KEY: "review-stripe-secret",
  STRIPE_WEBHOOK_SECRET: "review-stripe-webhook-secret",
};

type Section = "gcp" | "gh" | "local" | null;
type Entry = { key: string; value: string; section: Exclude<Section, null> };

const SECTION_HEADER = /^#+\s*#{3,}\s*(GCP Secrets|GitHub Secrets|Local)\s*#{3,}/i;

function parseEnvFile(path: string): Entry[] {
  const entries: Entry[] = [];
  let section: Section = null;

  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();

    const header = line.match(SECTION_HEADER);
    if (header) {
      const name = header[1].toLowerCase();
      section = name.startsWith("gcp") ? "gcp" : name.startsWith("github") ? "gh" : "local";
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

function run(cmd: string, args: string[], input?: string): { ok: boolean; out: string; err: string } {
  const r = spawnSync(cmd, args, { input, encoding: "utf8" });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function gcloudProject(): string {
  return process.env.GCP_PROJECT_ID ?? "";
}

function gcpSecretExists(name: string): boolean {
  const r = run("gcloud", ["secrets", "describe", name, `--project=${gcloudProject()}`, "--quiet"]);
  return r.ok;
}

function syncGcp(entry: Entry, dry: boolean): void {
  const secretName = GCP_SECRET_NAMES[entry.key];
  if (!secretName) {
    console.log(`  ⏭  ${entry.key} — no GCP secret name mapped, skipping`);
    return;
  }

  if (dry) {
    console.log(`  [dry] ${entry.key} → gcp:${secretName}`);
    return;
  }

  if (!gcpSecretExists(secretName)) {
    const create = run("gcloud", [
      "secrets", "create", secretName,
      `--project=${gcloudProject()}`,
      "--replication-policy=automatic",
      "--quiet",
    ]);
    if (!create.ok) {
      console.log(`  ✗ ${entry.key} — create failed: ${create.err.trim()}`);
      return;
    }
  }

  const add = run(
    "gcloud",
    ["secrets", "versions", "add", secretName, `--project=${gcloudProject()}`, "--data-file=-", "--quiet"],
    entry.value,
  );
  console.log(add.ok ? `  ✓ ${entry.key} → gcp:${secretName}` : `  ✗ ${entry.key} — ${add.err.trim()}`);
}

function syncGh(entry: Entry, dry: boolean): void {
  // Special case: GCP_SA_KEY_FILE points to a file whose contents get pushed as GCP_SA_KEY.
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
    const r = run("gh", ["secret", "set", "GCP_SA_KEY", "--body", body]);
    console.log(r.ok ? `  ✓ GCP_SA_KEY (from ${path}) → gh` : `  ✗ GCP_SA_KEY — ${r.err.trim()}`);
    return;
  }

  if (dry) {
    console.log(`  [dry] ${entry.key} → gh secret`);
    return;
  }

  const r = run("gh", ["secret", "set", entry.key, "--body", entry.value]);
  console.log(r.ok ? `  ✓ ${entry.key} → gh` : `  ✗ ${entry.key} — ${r.err.trim()}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry") || args.includes("--dry-run");
  const only = args.find((a) => a === "gcp" || a === "gh");

  const envPath = resolve(import.meta.dir, "../../.env.dev");
  if (!existsSync(envPath)) {
    console.error(`.env.dev not found at ${envPath}`);
    process.exit(1);
  }

  if (!gcloudProject()) {
    console.error("GCP_PROJECT_ID not set. Run with `bun run --env-file=.env.dev ...`");
    process.exit(1);
  }

  const entries = parseEnvFile(envPath);
  const gcp = entries.filter((e) => e.section === "gcp");
  const gh = entries.filter((e) => e.section === "gh");

  console.log(`sync-vault — project=${gcloudProject()} dry=${dry}`);

  if (!only || only === "gcp") {
    console.log(`\nGCP Secret Manager (${gcp.length} entries):`);
    for (const e of gcp) syncGcp(e, dry);
  }

  if (!only || only === "gh") {
    console.log(`\nGitHub Secrets (${gh.length} entries):`);
    for (const e of gh) syncGh(e, dry);
  }

  console.log("\nDone.");
}

main();
