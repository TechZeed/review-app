/**
 * Shared Google Play Developer API auth helper.
 *
 * Loads the eas-submit service-account key from the file vault (spec 22)
 * and exchanges a signed JWT for an OAuth2 access token scoped to
 * androidpublisher. Kept dependency-free — node:crypto + fetch only.
 */

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const SA_PATH = resolve(REPO_ROOT, "infra/dev/vault/eas-submit-sa.json");
export const API_BASE = "https://androidpublisher.googleapis.com";
export const DEFAULT_PACKAGE = "sg.reviewapp.app";

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function loadServiceAccount(): ServiceAccount {
  return JSON.parse(readFileSync(SA_PATH, "utf-8")) as ServiceAccount;
}

export async function getAccessToken(sa: ServiceAccount): Promise<string> {
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

export async function authedFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export async function jsonOrThrow(res: Response, label: string): Promise<any> {
  const text = (await res.text()).trim();
  if (!res.ok) throw new Error(`${label} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

/**
 * Draft-app commit workaround.
 *
 * Before the app has a production release through review, Play rejects
 * edit commits with "Only releases with status draft may be created on
 * draft app" if any track snapshot in the edit contains a non-draft
 * release. Removing those from each track's edit state (via PUT tracks/
 * {track} with only draft releases retained) satisfies the commit
 * validator. Play preserves completed releases server-side regardless —
 * the next `play-status` call will still show them.
 */
export async function stripCompletedReleasesFromAllTracks(
  token: string,
  pkg: string,
  editId: string,
): Promise<void> {
  const listRes = await authedFetch(
    token,
    `/androidpublisher/v3/applications/${pkg}/edits/${editId}/tracks`,
  );
  const data = (await jsonOrThrow(listRes, "list tracks")) as {
    tracks?: Array<{
      track: string;
      releases?: Array<{ status: string; name?: string; versionCodes?: string[] }>;
    }>;
  };
  for (const t of data.tracks ?? []) {
    const releases = t.releases ?? [];
    const draftOnly = releases.filter((r) => r.status === "draft");
    if (releases.length === draftOnly.length) continue; // nothing to strip
    const body = { track: t.track, releases: draftOnly };
    const putRes = await authedFetch(
      token,
      `/androidpublisher/v3/applications/${pkg}/edits/${editId}/tracks/${t.track}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    await jsonOrThrow(putRes, `strip-completed ${t.track}`);
  }
}
