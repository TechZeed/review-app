#!/usr/bin/env bun
/**
 * apply-eas-config — render apps/mobile/eas.json from eas.template.json + env.
 *
 * `.env.dev` is the single source of truth for mobile identifiers (Apple Team ID,
 * ASC App ID, etc.). This script substitutes ${VAR} placeholders in the template
 * and writes the final eas.json. Run it before any `eas build|submit` invocation;
 * Taskfile tasks wire this up automatically.
 *
 * Required env vars (sourced from .env.dev or GitHub Secrets in CI):
 *   APPLE_ID
 *   APPLE_TEAM_ID
 *   ASC_APP_ID
 *
 * Usage:
 *   bun run --env-file=.env.dev infra/dev/apply-eas-config.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const TEMPLATE = resolve(REPO_ROOT, "apps/mobile/eas.template.json");
const OUT = resolve(REPO_ROOT, "apps/mobile/eas.json");

const REQUIRED = ["APPLE_ID", "APPLE_TEAM_ID", "ASC_APP_ID"];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`apply-eas-config: missing env vars: ${missing.join(", ")}`);
  console.error("Run via: bun run --env-file=.env.dev infra/dev/apply-eas-config.ts");
  process.exit(1);
}

const raw = readFileSync(TEMPLATE, "utf8");
const rendered = raw.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name) => {
  const v = process.env[name];
  if (v === undefined) throw new Error(`unresolved placeholder: ${name}`);
  return v;
});

// Validate the output is valid JSON before writing.
JSON.parse(rendered);

writeFileSync(OUT, rendered);
console.log(`apply-eas-config → ${OUT}`);
for (const k of REQUIRED) console.log(`  ${k}=${process.env[k]}`);
