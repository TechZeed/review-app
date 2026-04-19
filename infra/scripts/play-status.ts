#!/usr/bin/env bun
/**
 * Play Console status CLI.
 *
 * Uses the eas-submit service account (already has Release Manager access
 * to sg.reviewapp.app via Play Console → Users and Permissions) to query
 * the Google Play Developer API and print a concise status summary:
 *
 *   - App identity (package, title).
 *   - Active releases per track (internal / alpha / beta / production):
 *     versionCode, status, release notes, rollout fraction.
 *   - Edit state (any unfinalised draft listing).
 *
 * Scopes required: https://www.googleapis.com/auth/androidpublisher
 * SA role: Release Manager (or Admin) on the Play Console app.
 *
 * Usage:
 *   bun run infra/scripts/play-status.ts           # default package sg.reviewapp.app
 *   bun run infra/scripts/play-status.ts --package sg.other.app
 *   bun run infra/scripts/play-status.ts --track internal
 */

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SA_PATH = resolve(REPO_ROOT, "infra/dev/vault/eas-submit-sa.json");

const DEFAULT_PACKAGE = "sg.reviewapp.app";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function parseArgs(argv: string[]): { package: string; track: string | null } {
  const out = { package: DEFAULT_PACKAGE, track: null as string | null };
  for (const a of argv) {
    const [k, v] = a.split("=", 2);
    if (k === "--package") out.package = v || "";
    if (k === "--track") out.track = v || "";
  }
  return out;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  };
  const payload = b64url(JSON.stringify(claims));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = b64url(signer.sign(sa.private_key));
  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!body.access_token) {
    throw new Error(`token exchange failed: ${body.error} — ${body.error_description ?? "no detail"}`);
  }
  return body.access_token;
}

async function api<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://androidpublisher.googleapis.com${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.text()).trim();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body) as T;
}

interface Edit { id: string; expiryTimeSeconds: string }
interface TrackRelease {
  name?: string;
  versionCodes?: string[];
  status: string; // completed | inProgress | halted | draft
  userFraction?: number;
  releaseNotes?: Array<{ language: string; text: string }>;
}
interface Track { track: string; releases?: TrackRelease[] }
interface TracksList { tracks?: Track[] }
interface Listing { language: string; title?: string; shortDescription?: string; fullDescription?: string }
interface ListingsList { listings?: Listing[] }
interface AppDetails { defaultLanguage?: string; contactEmail?: string; contactWebsite?: string }

async function withEdit<T>(token: string, pkg: string, fn: (editId: string) => Promise<T>): Promise<T> {
  const edit = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/edits`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  if (!edit.ok) throw new Error(`create edit → ${edit.status}: ${await edit.text()}`);
  const { id } = (await edit.json()) as Edit;
  try {
    return await fn(id);
  } finally {
    // Don't commit; just let the edit expire. Reading doesn't need a commit.
    await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/edits/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

function header(line: string) {
  console.log(`\n━━━ ${line} ${"━".repeat(Math.max(0, 68 - line.length))}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.package) throw new Error("--package required");

  const sa = JSON.parse(readFileSync(SA_PATH, "utf-8")) as ServiceAccount;
  const token = await getAccessToken(sa);

  console.log(`🔑 authed as ${sa.client_email}`);
  console.log(`📦 package: ${args.package}`);

  await withEdit(token, args.package, async (editId) => {
    // ── App identity ────────────────────────────────────────────
    header("app details");
    try {
      const details = await api<AppDetails>(
        token,
        `/androidpublisher/v3/applications/${args.package}/edits/${editId}/details`,
      );
      console.log(`default language: ${details.defaultLanguage ?? "(unset)"}`);
      console.log(`contact email:    ${details.contactEmail ?? "(unset)"}`);
      console.log(`contact website:  ${details.contactWebsite ?? "(unset)"}`);
    } catch (e: any) {
      console.log(`(failed: ${e.message})`);
    }

    // ── Listings ────────────────────────────────────────────────
    header("store listings");
    try {
      const listings = await api<ListingsList>(
        token,
        `/androidpublisher/v3/applications/${args.package}/edits/${editId}/listings`,
      );
      if (!listings.listings?.length) {
        console.log("⚠️  no store listings (title / descriptions missing — Play rejects external testing without these)");
      } else {
        for (const l of listings.listings) {
          console.log(`[${l.language}]`);
          console.log(`  title:             ${l.title || "(empty)"}`);
          console.log(`  short description: ${l.shortDescription ? l.shortDescription.slice(0, 80) : "(empty)"}`);
          console.log(`  full description:  ${l.fullDescription ? `${l.fullDescription.length} chars` : "(empty)"}`);
        }
      }
    } catch (e: any) {
      console.log(`(failed: ${e.message})`);
    }

    // ── Tracks ──────────────────────────────────────────────────
    header("tracks & releases");
    const tracks = await api<TracksList>(
      token,
      `/androidpublisher/v3/applications/${args.package}/edits/${editId}/tracks`,
    );
    if (!tracks.tracks?.length) {
      console.log("(no tracks)");
      return;
    }
    for (const t of tracks.tracks) {
      if (args.track && t.track !== args.track) continue;
      const releases = t.releases ?? [];
      console.log(`\n◎ ${t.track}  (${releases.length} release${releases.length === 1 ? "" : "s"})`);
      if (releases.length === 0) {
        console.log("   — no releases on this track");
        continue;
      }
      for (const r of releases) {
        const vc = (r.versionCodes ?? []).join(", ");
        const pct = r.userFraction ? ` @ ${(r.userFraction * 100).toFixed(0)}%` : "";
        console.log(
          `   ${r.status.padEnd(10)} versionCode=[${vc}]${pct}${r.name ? `  name='${r.name}'` : ""}`,
        );
        const notes = r.releaseNotes?.find((n) => n.language === "en-US") ?? r.releaseNotes?.[0];
        if (notes?.text) {
          const first = notes.text.split("\n")[0].slice(0, 120);
          console.log(`              └─ notes: ${first}${notes.text.length > first.length ? "…" : ""}`);
        }
      }
    }
  });

  console.log();
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
