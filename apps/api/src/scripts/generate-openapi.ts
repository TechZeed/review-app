/**
 * Generate OpenAPI 3.1 YAML from the API's Zod validation schemas.
 *
 * Imports every `*.validation.ts` schema and every `*.routes.ts` route table,
 * registers them with @asteasolutions/zod-to-openapi, and serializes via
 * the `yaml` npm package. Output: `docs/openapi.yaml` at the repo root.
 *
 * Why this lives in apps/api (not infra/scripts):
 *   - Needs to import the actual Zod objects, not grep .ts files.
 *   - Shares the API's tsconfig (NodeNext + path aliases).
 *
 * Regenerate: `task dev:openapi:regen`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "glob";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stringify as yamlStringify } from "yaml";
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z, ZodSchema } from "zod";

// Monkey-patches z.ZodType with .openapi() — required before any registry.register call.
extendZodWithOpenApi(z);

const FILE = fileURLToPath(import.meta.url);
const API_ROOT = resolve(dirname(FILE), "..");             // apps/api/src
const REPO_ROOT = resolve(API_ROOT, "..", "..", "..");     // /…/review-app
const MODULE_ROOT = resolve(API_ROOT, "modules");
const OUT = resolve(REPO_ROOT, "docs", "openapi.yaml");

const registry = new OpenAPIRegistry();

// ── 1. Register every exported `*Schema` from every *.validation.ts ────────

async function registerAllSchemas() {
  const files = globSync(`${MODULE_ROOT}/*/*.validation.ts`).sort();
  for (const f of files) {
    const mod: Record<string, unknown> = await import(pathToFileURL(f).href);
    for (const [name, value] of Object.entries(mod)) {
      if (!name.endsWith("Schema")) continue;
      if (!(value instanceof z.ZodType)) continue;
      const compName = name.replace(/Schema$/, "").replace(/^([a-z])/, (_, c) => c.toUpperCase());
      try {
        registry.register(compName, value as ZodSchema);
      } catch (err: any) {
        console.error(`[openapi] skip ${compName}: ${err.message}`);
      }
    }
  }
}

// ── 2. Hand-authored response shapes (load-bearing ones) ───────────────────

const AuthUser = registry.register(
  "AuthUser",
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["INDIVIDUAL", "EMPLOYER", "RECRUITER", "ADMIN"]),
    status: z.enum(["active", "suspended"]).optional(),
    provider: z.string().optional(),
    avatarUrl: z.string().nullable().optional(),
    isApproved: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
);

const ExchangeTokenResponse = registry.register(
  "ExchangeTokenResponse",
  z.object({
    accessToken: z.string(),
    user: AuthUser,
  }),
);

const Capability = registry.register(
  "Capability",
  z.object({
    capability: z.enum(["pro", "employer", "recruiter"]),
    source: z.enum(["subscription", "admin-grant"]),
    expiresAt: z.string().nullable(),
  }),
);

const SubscriptionMe = registry.register(
  "SubscriptionMe",
  z.object({
    tier: z.enum(["free", "pro", "employer", "recruiter"]),
    status: z.string(),
    billingCycle: z.string().nullable().optional(),
    currentPeriodEnd: z.string().nullable().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    stripeSubscriptionId: z.string().nullable().optional(),
    capabilities: z.array(Capability),
  }),
);

const QualityBreakdown = registry.register(
  "QualityBreakdown",
  z.object({
    expertise: z.number().int(),
    care: z.number().int(),
    delivery: z.number().int(),
    initiative: z.number().int(),
    trust: z.number().int(),
  }),
);

const Profile = registry.register(
  "Profile",
  z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    headline: z.string(),
    industry: z.string(),
    bio: z.string().nullable(),
    visibility: z.enum(["public", "recruiter_visible", "private"]),
    qrCodeUrl: z.string().nullable(),
    profileUrl: z.string().url(),
    reviewCount: z.number().int().nonnegative(),
    qualityBreakdown: QualityBreakdown,
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

const Review = registry.register(
  "Review",
  z.object({
    id: z.string().uuid(),
    profileId: z.string().uuid(),
    qualities: z.array(z.string()),
    thumbsUp: z.boolean(),
    badgeTier: z.enum(["standard", "verified_interaction", "verified_testimonial"]),
    verifiable: z.boolean(),
    createdAt: z.string(),
  }),
);

const Pagination = registry.register(
  "Pagination",
  z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
);

const ReviewsPage = registry.register(
  "ReviewsPage",
  z.object({ reviews: z.array(Review), pagination: Pagination }),
);

const ScanResponse = registry.register(
  "ScanResponse",
  z.object({
    reviewToken: z.string().uuid(),
    expiresAt: z.string(),
    profile: z.object({ id: z.string().uuid(), name: z.string() }),
  }),
);

const ErrorResponse = registry.register(
  "Error",
  z.object({
    error: z.string(),
    code: z.string().optional(),
    traceId: z.string().optional(),
    requiredCapability: z.string().optional(),
  }),
);

// ── 3. Walk route tables + register path items ─────────────────────────────

const MOUNTS: Record<string, { path: string; middleware: string[] }> = {
  auth:          { path: "/api/v1/auth",          middleware: [] },
  profile:       { path: "/api/v1/profiles",      middleware: [] },
  review:        { path: "/api/v1/reviews",       middleware: [] },
  quality:       { path: "/api/v1/qualities",     middleware: [] },
  verification:  { path: "/api/v1/verification",  middleware: [] },
  media:         { path: "/api/v1/media",         middleware: [] },
  organization:  { path: "/api/v1/organizations", middleware: ["authenticate"] },
  recruiter:     { path: "/api/v1/recruiter",     middleware: ["authenticate", "capability:recruiter"] },
  employer:      { path: "/api/v1/employer",      middleware: ["authenticate", "capability:employer"] },
  reference:     { path: "/api/v1/references",    middleware: [] },
  subscription:  { path: "/api/v1/subscriptions", middleware: [] },
};

interface RouteBlob {
  method: string;
  routePath: string;
  module: string;
  bodySchema?: string;
  querySchema?: string;
  paramsSchema?: string;
  middleware: string[];
  handler: string;
}

function parseRoutesFile(file: string, moduleName: string, mount: { path: string; middleware: string[] }): RouteBlob[] {
  const src = readFileSync(file, "utf-8");
  const rx = /\b\w*Router\.(get|post|patch|put|delete)\s*\(\s*([\s\S]*?)\n\s*\);/g;
  const out: RouteBlob[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(src))) {
    const method = m[1].toUpperCase();
    const body = m[2];
    const pm = body.match(/(['"`])([^'"`]+)\1/);
    if (!pm) continue;
    const routePath = pm[2];
    const mw: string[] = [];
    let bodySchema: string | undefined, querySchema: string | undefined, paramsSchema: string | undefined;
    for (const raw of body.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (/^(['"`])/.test(raw)) continue;
      let mm: RegExpMatchArray | null;
      if ((mm = raw.match(/^validateBody\s*\(\s*([A-Za-z0-9_]+)/))) bodySchema = mm[1];
      else if ((mm = raw.match(/^validateQuery\s*\(\s*([A-Za-z0-9_]+)/))) querySchema = mm[1];
      else if ((mm = raw.match(/^validateParams\s*\(\s*([A-Za-z0-9_]+)/))) paramsSchema = mm[1];
      else if ((mm = raw.match(/^requireRole\s*\(([^)]+)\)/))) mw.push(`role:${mm[1].replace(/\s+/g, "")}`);
      else if (/^authenticate\b/.test(raw)) mw.push("authenticate");
      else if (/^requireCapability\s*\(/.test(raw)) {
        const mm2 = raw.match(/requireCapability\(['"](\w+)['"]\)/);
        if (mm2) mw.push(`capability:${mm2[1]}`);
      }
    }
    const tokens = body.split(/[\s,()]+/).filter(Boolean);
    const handler = tokens[tokens.length - 1] || "?";
    out.push({ method, routePath, module: moduleName, bodySchema, querySchema, paramsSchema, middleware: [...mount.middleware, ...mw], handler });
  }
  return out;
}

function componentName(schemaVar: string): string {
  return schemaVar.replace(/Schema$/, "").replace(/^([a-z])/, (_, c) => c.toUpperCase());
}

function guessResponseRef(r: RouteBlob): string | undefined {
  const p = `${r.method} ${r.routePath}`;
  if (p === "POST /login") return "ExchangeTokenResponse";
  if (p === "POST /exchange-token") return "ExchangeTokenResponse";
  if (p === "POST /admin/create-user" && r.module === "auth") return "CreateUserResponse";
  if (p === "POST /admin/users/:id/capabilities" && r.module === "auth") return "GrantCapabilityResponse";
  if (p === "DELETE /admin/users/:id/capabilities/:capability" && r.module === "auth") return "RevokeCapabilityResponse";
  if (r.routePath === "/me" && r.module === "auth" && r.method === "GET") return "AuthUser";
  if (r.routePath === "/me" && r.module === "subscription" && r.method === "GET") return "SubscriptionMe";
  if (r.routePath === "/me" && r.module === "profile" && r.method === "GET") return "Profile";
  if (r.routePath === "/:slug" && r.module === "profile" && r.method === "GET") return "Profile";
  if (r.routePath === "/profile/:profileId" && r.module === "review" && r.method === "GET") return "ReviewsPage";
  if (r.routePath === "/me" && r.module === "review" && r.method === "GET") return "ReviewsPage";
  if (r.routePath === "/my-submissions" && r.module === "review" && r.method === "GET") return "ReviewsPage";
  if (r.routePath === "/scan/:slug" && r.module === "review" && r.method === "POST") return "ScanResponse";
  return undefined;
}

function guessSuccessStatus(r: RouteBlob): 200 | 201 {
  const p = `${r.method} ${r.routePath}`;
  if (
    (p === "POST /admin/create-user" && r.module === "auth") ||
    (p === "POST /admin/users/:id/capabilities" && r.module === "auth")
  ) {
    return 201;
  }
  return 200;
}

function registerRoutes() {
  const files = globSync(`${MODULE_ROOT}/*/*.routes.ts`).sort();
  for (const f of files) {
    const moduleName = basename(dirname(f));
    const mount = MOUNTS[moduleName];
    if (!mount) continue;
    const routes = parseRoutesFile(f, moduleName, mount);
    for (const r of routes) {
      const fullPath = (mount.path + r.routePath).replace(/\/\//g, "/").replace(/:([A-Za-z0-9_]+)/g, "{$1}");
      const pathParams = [...r.routePath.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
      const responseRef = guessResponseRef(r);
      const successStatus = guessSuccessStatus(r);

      const op: Parameters<typeof registry.registerPath>[0] = {
        method: r.method.toLowerCase() as any,
        path: fullPath,
        tags: [r.module],
        summary: `${r.method} ${fullPath}`,
        ...(r.middleware.includes("authenticate") && { security: [{ bearerAuth: [] }] }),
        request: {
          params: pathParams.length
            ? z.object(Object.fromEntries(pathParams.map((n) => [n, z.string()])))
            : undefined,
          ...(r.bodySchema && (registry as any)._definitions?.find((d: any) => d.type === "schema" && d.schema._def?.openapi?._internal?.refId === componentName(r.bodySchema))
            ? {
                body: {
                  content: {
                    "application/json": {
                      schema: { $ref: `#/components/schemas/${componentName(r.bodySchema)}` } as any,
                    },
                  },
                },
              }
            : {}),
        } as any,
        responses: {
          [successStatus]: responseRef
            ? {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: `#/components/schemas/${responseRef}` } as any,
                  },
                },
              }
            : { description: "OK" },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } as any } } },
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } as any } } },
          429: { description: "Rate-limited" },
          500: { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } as any } } },
        },
      };

      if (r.middleware.length) (op as any)["x-middleware"] = r.middleware;

      try {
        registry.registerPath(op);
      } catch (e: any) {
        console.error(`[openapi] skip ${r.method} ${fullPath}: ${e.message}`);
      }
    }
  }
}

// ── 4. Generate + write ────────────────────────────────────────────────────

async function main() {
  await registerAllSchemas();
  registerRoutes();

  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "ReviewApp API",
      version: "0.1.0",
      description: "Auto-generated from Express route tables + Zod validation schemas. Do not hand-edit — regenerate via `task dev:openapi:regen`.",
    },
    servers: [{ url: "https://review-api.teczeed.com", description: "Dev" }],
  });

  (doc as any).components = (doc as any).components || {};
  (doc as any).components.securitySchemes = { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } };

  const yaml = yamlStringify(doc, { lineWidth: 0 });
  writeFileSync(OUT, `# ReviewApp OpenAPI — auto-generated, do not hand-edit.\n# Regenerate: task dev:openapi:regen\n# Generated: ${new Date().toISOString()}\n\n${yaml}`);
  console.log(`✓ wrote ${OUT}  (${Object.keys(doc.paths ?? {}).length} paths, ${Object.keys((doc as any).components?.schemas ?? {}).length} schemas)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
