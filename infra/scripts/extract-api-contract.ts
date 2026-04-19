#!/usr/bin/env bun
/**
 * Walk every module's *.routes.ts, extract each route (method + path +
 * auth requirements + validation schema + controller ref), resolve the
 * schema name back to its Zod shape in *.validation.ts, and print a
 * single Markdown contract doc to stdout.
 *
 * Usage: bun run infra/scripts/extract-api-contract.ts > docs/api-contract.md
 *
 * Not precise: `validateBody(x)` might be a schema variable we can't
 * always resolve without a full TS AST. When we can't, we print the
 * symbol name instead — still useful to browse from.
 */

import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

type Prefix = { path: string; middleware: string[] };

// Prefix mounts in app.ts — kept in sync manually since we only have a dozen.
const MOUNTS: Record<string, Prefix> = {
  "auth/auth.routes.ts":                 { path: "/api/v1/auth",         middleware: [] },
  "profile/profile.routes.ts":           { path: "/api/v1/profiles",     middleware: [] },
  "review/review.routes.ts":             { path: "/api/v1/reviews",      middleware: [] },
  "quality/quality.routes.ts":           { path: "/api/v1/qualities",    middleware: [] },
  "verification/verification.routes.ts": { path: "/api/v1/verification", middleware: [] },
  "media/media.routes.ts":               { path: "/api/v1/media",        middleware: [] },
  "organization/organization.routes.ts": { path: "/api/v1/organizations", middleware: ["authenticate"] },
  "recruiter/recruiter.routes.ts":       { path: "/api/v1/recruiter",    middleware: ["authenticate", "requireRole(RECRUITER|ADMIN)"] },
  "employer/employer.routes.ts":         { path: "/api/v1/employer",     middleware: ["authenticate", "requireRole(EMPLOYER|ADMIN)"] },
  "reference/reference.routes.ts":       { path: "/api/v1/references",   middleware: [] },
  "subscription/subscription.routes.ts": { path: "/api/v1/subscriptions", middleware: [] },
};

interface Route {
  method: string;
  path: string;
  fullPath: string;
  middleware: string[];
  validations: { kind: string; schema: string }[];
  controller: string;
}

function parseRoutes(file: string, mount: Prefix): Route[] {
  const src = readFileSync(file, "utf-8");
  // Match router.<method>(... ) blocks up to the closing paren on its own line.
  const rx = /\b(?:authRouter|profileRouter|reviewRouter|qualityRouter|verificationRouter|mediaRouter|organizationRouter|recruiterRouter|employerRouter|referenceRouter|subscriptionRouter)\.(get|post|patch|put|delete)\s*\(\s*([\s\S]*?)\n\s*\);/g;
  const out: Route[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src))) {
    const method = m[1].toUpperCase();
    const body = m[2];
    const pathMatch = body.match(/(['"`])([^'"`]+)\1/);
    if (!pathMatch) continue;
    const path = pathMatch[2];
    const mwList: string[] = [];
    const validations: { kind: string; schema: string }[] = [];
    for (const part of body.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (/^(['"`])/.test(part)) continue; // path
      const vMatch = part.match(/^(validateBody|validateQuery|validateParams)\s*\(\s*([A-Za-z0-9_]+)/);
      if (vMatch) { validations.push({ kind: vMatch[1], schema: vMatch[2] }); continue; }
      const roleMatch = part.match(/^requireRole\s*\(([^)]+)\)/);
      if (roleMatch) { mwList.push(`requireRole(${roleMatch[1].replace(/\s+/g, "")})`); continue; }
      if (/^authenticate\b/.test(part)) { mwList.push("authenticate"); continue; }
      if (/RateLimit\b/.test(part)) { mwList.push(part.split(/\s/)[0].replace(/[,]/g, "")); continue; }
      if (/^(authRate|apiRate|reviewRate|otpRate|uploadRate)/.test(part)) { mwList.push(part); continue; }
      // Final positional arg is the controller method.
      if (/^(controller|.*Controller)\.?[A-Za-z0-9_]+/.test(part) ||
          /^[a-z][A-Za-z0-9_]+\.?[a-z][A-Za-z0-9_]*$/.test(part)) {
        out.push(undefined as any); // placeholder
        out.pop();
      }
    }
    // Controller handler — last non-empty token.
    const tokens = body.split(/[\s,()]+/).filter(Boolean);
    const controller = tokens[tokens.length - 1] || "?";
    out.push({
      method,
      path,
      fullPath: (mount.path + path).replace(/\/\//g, "/"),
      middleware: [...mount.middleware, ...mwList],
      validations,
      controller,
    });
  }
  return out;
}

function extractSchemas(file: string): Record<string, string> {
  try {
    const src = readFileSync(file, "utf-8");
    // Match `export const <Name>Schema = <Expr>;` including multi-line z.object({...}) until the closing balanced paren.
    const rx = /export\s+const\s+([A-Za-z0-9_]+Schema)\s*=\s*([\s\S]*?);\s*\n/g;
    const out: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = rx.exec(src))) out[m[1]] = m[2].trim();
    return out;
  } catch { return {}; }
}

const moduleRoot = "/Users/muthuishere/muthu/gitworkspace/bossbroprojects/review-workspace/review-app/apps/api/src/modules";
const files = globSync(`${moduleRoot}/*/*.routes.ts`).sort();

console.log("# ReviewApp API Contract (auto-generated)\n");
console.log(`> Generated ${new Date().toISOString()} — do not hand-edit. Run \`bun infra/scripts/extract-api-contract.ts > docs/api-contract.md\`.\n`);
console.log("Base: `https://review-api.teczeed.com`  (dev)\n");
console.log("Auth: bearer JWT via \`Authorization: Bearer <accessToken>\` returned by `POST /api/v1/auth/login` or `/auth/exchange`.\n");
console.log("---\n");

for (const f of files) {
  const rel = f.slice(moduleRoot.length + 1);
  const mount = MOUNTS[rel];
  if (!mount) continue;
  const routes = parseRoutes(f, mount);
  const schemas = extractSchemas(f.replace(".routes.ts", ".validation.ts"));
  const moduleName = rel.split("/")[0];
  console.log(`## \`${moduleName}\` — mount \`${mount.path}\`\n`);
  if (mount.middleware.length) console.log(`Router-level middleware: \`${mount.middleware.join(" → ")}\`\n`);
  for (const r of routes) {
    const mwStr = r.middleware.length ? ` _(${r.middleware.join(", ")})_` : "";
    console.log(`### ${r.method} \`${r.fullPath}\`${mwStr}`);
    console.log(`Handler: \`${r.controller}\``);
    if (r.validations.length) {
      console.log("");
      for (const v of r.validations) {
        const shape = schemas[v.schema];
        console.log(`- **${v.kind}** \`${v.schema}\``);
        if (shape) {
          console.log("  ```ts");
          console.log("  " + shape.split("\n").join("\n  "));
          console.log("  ```");
        }
      }
    }
    console.log("");
  }
  console.log("---\n");
}
