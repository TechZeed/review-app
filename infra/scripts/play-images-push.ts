#!/usr/bin/env bun
/**
 * Upload Play Console image assets from `apps/mobile/store-assets/`:
 *
 *   icon-512.png                      → listings/{lang}/icon
 *   feature-graphic-1024x500.png      → listings/{lang}/featureGraphic
 *   screenshot-*.png                  → listings/{lang}/phoneScreenshots
 *
 * Upload API lives under the /upload/... prefix with ?uploadType=media
 * and a raw binary body (Content-Type: image/png).
 *
 * Icon + featureGraphic are single-image slots — upload replaces.
 * phoneScreenshots is a collection — DELETE all first, then POST each.
 *
 * Idempotent; commits with changesNotSentForReview=false. On any failure
 * the edit is deleted so the next run starts clean.
 *
 * Spec 29 §8.5.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  REPO_ROOT,
  DEFAULT_PACKAGE,
  API_BASE,
  loadServiceAccount,
  getAccessToken,
  authedFetch,
  jsonOrThrow,
  stripCompletedReleasesFromAllTracks,
} from "./play-auth.ts";

const ASSETS_DIR = resolve(REPO_ROOT, "apps/mobile/store-assets");
const LANGUAGE = "en-GB";

function parseArgs(argv: string[]): { package: string } {
  let pkg = DEFAULT_PACKAGE;
  for (const a of argv) {
    const [k, v] = a.split("=", 2);
    if (k === "--package" && v) pkg = v;
  }
  return { package: pkg };
}

async function uploadBinary(
  token: string,
  pkg: string,
  editId: string,
  language: string,
  imageType: "icon" | "featureGraphic" | "phoneScreenshots",
  filePath: string,
): Promise<void> {
  const bytes = readFileSync(filePath);
  // The upload endpoint uses /upload prefix and ?uploadType=media.
  const url = `${API_BASE}/upload/androidpublisher/v3/applications/${pkg}/edits/${editId}/listings/${language}/${imageType}?uploadType=media`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "image/png",
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload ${imageType} (${filePath}) → ${res.status}: ${text.slice(0, 400)}`);
  }
}

async function deleteAllScreenshots(
  token: string,
  pkg: string,
  editId: string,
  language: string,
): Promise<void> {
  const res = await authedFetch(
    token,
    `/androidpublisher/v3/applications/${pkg}/edits/${editId}/listings/${language}/phoneScreenshots`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`delete phoneScreenshots → ${res.status}: ${text.slice(0, 300)}`);
  }
}

function collectScreenshots(): string[] {
  if (!existsSync(ASSETS_DIR)) return [];
  return readdirSync(ASSETS_DIR)
    .filter((f) => f.startsWith("screenshot-") && f.endsWith(".png"))
    .sort()
    .map((f) => resolve(ASSETS_DIR, f));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const iconPath = resolve(ASSETS_DIR, "icon-512.png");
  const featureGraphicPath = resolve(ASSETS_DIR, "feature-graphic-1024x500.png");
  const screenshots = collectScreenshots();

  if (!existsSync(iconPath)) throw new Error(`missing ${iconPath} — run task dev:play:assets:regenerate`);
  if (!existsSync(featureGraphicPath)) throw new Error(`missing ${featureGraphicPath}`);
  if (screenshots.length < 2) {
    throw new Error(
      `need ≥2 phone screenshots in ${ASSETS_DIR}; found ${screenshots.length}`,
    );
  }

  const sa = loadServiceAccount();
  const token = await getAccessToken(sa);
  const pkg = args.package;
  console.log(`🔑 authed as ${sa.client_email}`);
  console.log(`📦 package: ${pkg}`);
  console.log(`🖼  icon: ${iconPath}`);
  console.log(`🖼  feature graphic: ${featureGraphicPath}`);
  console.log(`🖼  screenshots (${screenshots.length}):`);
  for (const s of screenshots) console.log(`     - ${s}`);

  const editRes = await authedFetch(token, `/androidpublisher/v3/applications/${pkg}/edits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  const edit = (await jsonOrThrow(editRes, "create edit")) as { id: string };
  const editId = edit.id;
  console.log(`✏️  edit: ${editId}`);

  try {
    await uploadBinary(token, pkg, editId, LANGUAGE, "icon", iconPath);
    console.log(`   ✓ icon`);

    await uploadBinary(token, pkg, editId, LANGUAGE, "featureGraphic", featureGraphicPath);
    console.log(`   ✓ featureGraphic`);

    await deleteAllScreenshots(token, pkg, editId, LANGUAGE);
    console.log(`   ✓ cleared existing phoneScreenshots`);
    for (const s of screenshots) {
      await uploadBinary(token, pkg, editId, LANGUAGE, "phoneScreenshots", s);
      console.log(`   ✓ phoneScreenshot ${s.split("/").pop()}`);
    }

    // Draft-app guard — see play-auth.ts for the rationale.
    await stripCompletedReleasesFromAllTracks(token, pkg, editId);

    const cRes = await authedFetch(
      token,
      `/androidpublisher/v3/applications/${pkg}/edits/${editId}:commit`,
      { method: "POST" },
    );
    await jsonOrThrow(cRes, "commit");
    console.log(`✅ committed edit ${editId}`);
  } catch (err) {
    console.error(`✗ image push failed — rolling back edit ${editId}`);
    await authedFetch(token, `/androidpublisher/v3/applications/${pkg}/edits/${editId}`, {
      method: "DELETE",
    }).catch(() => {});
    throw err;
  }
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
