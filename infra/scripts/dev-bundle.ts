#!/usr/bin/env bun
/**
 * dev-bundle — one-shot dev-environment bootstrap via GCP Secret Manager.
 *
 * The bundle tars `.env.dev` + `infra/dev/vault/` into a single secret
 * `review-dev-bundle`. New teammates clone the repo, run
 * `task dev:bundle:pull`, and their workspace mirrors the owner's.
 *
 *   push  — reads GCP_PROJECT_ID from the caller's env (Taskfile loads
 *           .env.dev). Creates the secret if missing, then adds a new
 *           version from `tar czf -` piped output.
 *   pull  — project resolved from --project=<id> or `gcloud config
 *           get-value project`. Streams `versions access latest` into
 *           `tar xzf -` from repo root.
 *
 * Per-secret IAM keeps blast radius small. Grant a teammate access with:
 *   gcloud secrets add-iam-policy-binding review-dev-bundle \
 *     --member='user:alice@example.com' \
 *     --role='roles/secretmanager.secretAccessor' \
 *     --project=<GCP_PROJECT_ID>
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SECRET_NAME = "review-dev-bundle";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT_DEFAULTS_FILE = resolve(REPO_ROOT, "apps/api/config/application.dev.env");

// Non-secret project identity lives in apps/api/config/application.dev.env
// (committed API dev defaults). Used as a fallback when GCP_PROJECT_ID isn't
// in the caller env — lets `dev:bundle:pull` work from a fresh clone with
// zero flags, before .env.dev has been pulled.
function readProjectDefaults(): Record<string, string> {
  if (!existsSync(PROJECT_DEFAULTS_FILE)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(PROJECT_DEFAULTS_FILE, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function parseProjectFlag(argv: string[]): string | undefined {
  const flag = argv.find((a) => a.startsWith("--project="));
  return flag?.split("=", 2)[1];
}

function gcloudProjectFromConfig(): string | undefined {
  const r = spawnSync("gcloud", ["config", "get-value", "project"], { encoding: "utf-8" });
  const val = r.stdout?.trim();
  return val && val !== "(unset)" ? val : undefined;
}

function secretExists(project: string): boolean {
  const r = spawnSync(
    "gcloud",
    ["secrets", "describe", SECRET_NAME, `--project=${project}`],
    { stdio: "ignore" },
  );
  return r.status === 0;
}

function createSecret(project: string): void {
  const r = spawnSync(
    "gcloud",
    ["secrets", "create", SECRET_NAME, "--replication-policy=automatic", `--project=${project}`],
    { stdio: "inherit" },
  );
  if (r.status !== 0) die(`Failed to create secret ${SECRET_NAME}`);
}

async function pipeAB(from: ReturnType<typeof spawn>, to: ReturnType<typeof spawn>): Promise<void> {
  from.stdout!.pipe(to.stdin!);
  const [fromCode, toCode] = await Promise.all([
    new Promise<number>((r) => from.on("close", (c) => r(c ?? 0))),
    new Promise<number>((r) => to.on("close", (c) => r(c ?? 0))),
  ]);
  if (fromCode !== 0) die(`Source command exited ${fromCode}`);
  if (toCode !== 0) die(`Destination command exited ${toCode}`);
}

async function push(): Promise<void> {
  const project = process.env.GCP_PROJECT_ID || readProjectDefaults().GCP_PROJECT_ID;
  if (!project) die("GCP_PROJECT_ID not set — add it to apps/api/config/application.dev.env or .env.dev");

  if (!secretExists(project)) {
    console.log(`Secret ${SECRET_NAME} not found — creating under project ${project}`);
    createSecret(project);
  }

  console.log(`→ Packing .env.dev + infra/dev/vault/ …`);
  // gcloud's stdout text-encoding corrupts raw gzip bytes on retrieval,
  // so we base64-wrap the tarball. Harmless on push; decoded on pull.
  // `.env` is NOT in the bundle — it's committed as placeholder-only (d28).
  const tar = spawn("tar", ["czf", "-", ".env.dev", "infra/dev/vault/"], { cwd: REPO_ROOT });
  const base64 = spawn("base64", [], { stdio: ["pipe", "pipe", "inherit"] });
  const gcloud = spawn(
    "gcloud",
    ["secrets", "versions", "add", SECRET_NAME, "--data-file=-", `--project=${project}`],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  tar.stdout!.pipe(base64.stdin!);
  base64.stdout!.pipe(gcloud.stdin!);
  const codes = await Promise.all([
    new Promise<number>((r) => tar.on("close", (c) => r(c ?? 0))),
    new Promise<number>((r) => base64.on("close", (c) => r(c ?? 0))),
    new Promise<number>((r) => gcloud.on("close", (c) => r(c ?? 0))),
  ]);
  if (codes.some((c) => c !== 0)) die(`Push pipeline failed: codes=${codes.join(",")}`);
  console.log(`✓ Pushed ${SECRET_NAME} to project ${project}`);
}

async function pull(argv: string[]): Promise<void> {
  const project =
    parseProjectFlag(argv) ||
    process.env.GCP_PROJECT_ID ||
    readProjectDefaults().GCP_PROJECT_ID ||
    gcloudProjectFromConfig();
  if (!project) {
    die("No project id. Pass --project=<id>, set GCP_PROJECT_ID, add to apps/api/config/application.dev.env, or `gcloud config set project <id>`.");
  }

  console.log(`→ Fetching ${SECRET_NAME} from project ${project} …`);
  const gcloud = spawn(
    "gcloud",
    ["secrets", "versions", "access", "latest", `--secret=${SECRET_NAME}`, `--project=${project}`],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  const b64d = spawn("base64", ["-d"], { stdio: ["pipe", "pipe", "inherit"] });
  const tar = spawn("tar", ["xzf", "-"], { cwd: REPO_ROOT, stdio: ["pipe", "inherit", "inherit"] });
  gcloud.stdout!.pipe(b64d.stdin!);
  b64d.stdout!.pipe(tar.stdin!);
  const codes = await Promise.all([
    new Promise<number>((r) => gcloud.on("close", (c) => r(c ?? 0))),
    new Promise<number>((r) => b64d.on("close", (c) => r(c ?? 0))),
    new Promise<number>((r) => tar.on("close", (c) => r(c ?? 0))),
  ]);
  if (codes.some((c) => c !== 0)) die(`Pull pipeline failed: codes=${codes.join(",")}`);
  console.log(`✓ Unpacked .env.dev + infra/dev/vault/ into ${REPO_ROOT}`);
}

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "push":
    await push();
    break;
  case "pull":
    await pull(rest);
    break;
  default:
    console.error("Usage: dev-bundle.ts <push|pull> [--project=<id>]");
    process.exit(2);
}
