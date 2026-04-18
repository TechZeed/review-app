#!/usr/bin/env bun
/**
 * apply-mobile-config — render apps/mobile/{eas,app}.json from their .template.json
 * counterparts, using `.env.dev` as the single source of truth.
 *
 * Both output files are gitignored. Never edit them directly — edit the
 * .template.json or add the variable to .env.dev.
 *
 * Usage:
 *   bun run --env-file=.env.dev infra/dev/apply-mobile-config.ts
 *
 * Invoked automatically by `task dev:mobile:config` (a dep of every
 * deploy:mobile* task).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../..");

const TARGETS = [
  {
    template: resolve(REPO_ROOT, "apps/mobile/eas.template.json"),
    out: resolve(REPO_ROOT, "apps/mobile/eas.json"),
  },
  {
    template: resolve(REPO_ROOT, "apps/mobile/app.template.json"),
    out: resolve(REPO_ROOT, "apps/mobile/app.json"),
  },
];

const PLACEHOLDER = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

function collectPlaceholders(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER)) found.add(m[1]);
  return found;
}

const allRequired = new Set<string>();
const sources = TARGETS.map(({ template, out }) => {
  const raw = readFileSync(template, "utf8");
  for (const k of collectPlaceholders(raw)) allRequired.add(k);
  return { template, out, raw };
});

const missing = [...allRequired].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`apply-mobile-config: missing env vars: ${missing.join(", ")}`);
  console.error("Run via: bun run --env-file=.env.dev infra/dev/apply-mobile-config.ts");
  process.exit(1);
}

for (const { template, out, raw } of sources) {
  const rendered = raw.replace(PLACEHOLDER, (_, name) => process.env[name] as string);
  // Fail loudly on invalid JSON rather than write garbage.
  JSON.parse(rendered);
  writeFileSync(out, rendered);
  console.log(`apply-mobile-config → ${out.replace(REPO_ROOT + "/", "")}`);
}
for (const k of [...allRequired].sort()) {
  console.log(`  ${k}=${process.env[k]}`);
}
