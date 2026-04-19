#!/usr/bin/env bun
/**
 * Push text fields of the Play Console store listing from the declarative
 * manifest at `apps/mobile/store-listing.yml`.
 *
 * Writes:
 *   - app details: defaultLanguage, contactEmail, contactWebsite
 *   - listing[{language}]: title, shortDescription, fullDescription
 *
 * Idempotent: creating a fresh edit each run; on any error the edit is
 * DELETEd so the next run gets a clean slate. Commits with
 * changesNotSentForReview=false so text changes go through review.
 *
 * Spec 29 §8.5. Pair with play-images-push.ts for assets.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REPO_ROOT,
  DEFAULT_PACKAGE,
  loadServiceAccount,
  getAccessToken,
  authedFetch,
  jsonOrThrow,
  stripCompletedReleasesFromAllTracks,
} from "./play-auth.ts";

const MANIFEST_PATH = resolve(REPO_ROOT, "apps/mobile/store-listing.yml");

interface Manifest {
  language: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  contactEmail: string;
  contactWebsite: string;
  privacyPolicyUrl: string;
  defaultLanguage: string;
}

/**
 * Minimal YAML parser for our flat listing manifest. Supports:
 *   - `key: value` scalars
 *   - `key: >- \n  folded scalar` (folded block, joins lines with space)
 *   - `key: | \n  literal block` (literal block, preserves newlines)
 * Not a general YAML parser — the manifest shape is fixed.
 */
function parseManifest(text: string): Manifest {
  const lines = text.split("\n");
  const out: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const [, key, rest] = m;
    const trimmed = rest.trim();
    if (trimmed === ">-" || trimmed === ">" || trimmed === "|" || trimmed === "|-") {
      const mode = trimmed[0]; // '>' or '|'
      i++;
      const block: string[] = [];
      while (i < lines.length && (lines[i].startsWith("  ") || lines[i] === "")) {
        block.push(lines[i].replace(/^ {2}/, ""));
        i++;
      }
      // strip trailing empty lines
      while (block.length && block[block.length - 1] === "") block.pop();
      if (mode === ">") {
        // folded: newlines → spaces (blank lines preserved as newline)
        out[key] = block
          .reduce<string[]>((acc, cur) => {
            if (cur === "") acc.push("\n");
            else acc.push(cur);
            return acc;
          }, [])
          .join(" ")
          .replace(/ ?\n ?/g, "\n")
          .trim();
      } else {
        out[key] = block.join("\n");
      }
    } else {
      // scalar — strip surrounding quotes if any
      out[key] = trimmed.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      i++;
    }
  }
  const required = [
    "language",
    "title",
    "shortDescription",
    "fullDescription",
    "contactEmail",
    "contactWebsite",
    "privacyPolicyUrl",
    "defaultLanguage",
  ] as const;
  for (const k of required) {
    if (!out[k]) throw new Error(`store-listing.yml missing required key: ${k}`);
  }
  return out as unknown as Manifest;
}

function parseArgs(argv: string[]): { package: string } {
  let pkg = DEFAULT_PACKAGE;
  for (const a of argv) {
    const [k, v] = a.split("=", 2);
    if (k === "--package" && v) pkg = v;
  }
  return { package: pkg };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = parseManifest(readFileSync(MANIFEST_PATH, "utf-8"));

  // Sanity limits — Play Console enforces these. Fail fast locally.
  if (manifest.title.length > 30) throw new Error(`title exceeds 30 chars (${manifest.title.length})`);
  if (manifest.shortDescription.length > 80)
    throw new Error(`shortDescription exceeds 80 chars (${manifest.shortDescription.length})`);
  if (manifest.fullDescription.length > 4000)
    throw new Error(`fullDescription exceeds 4000 chars (${manifest.fullDescription.length})`);

  const sa = loadServiceAccount();
  const token = await getAccessToken(sa);
  const pkg = args.package;
  console.log(`🔑 authed as ${sa.client_email}`);
  console.log(`📦 package: ${pkg}`);
  console.log(`📄 manifest: ${MANIFEST_PATH}`);
  console.log(
    `   title=${manifest.title.length}ch short=${manifest.shortDescription.length}ch full=${manifest.fullDescription.length}ch`,
  );

  // Create edit session.
  const editRes = await authedFetch(token, `/androidpublisher/v3/applications/${pkg}/edits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  const edit = (await jsonOrThrow(editRes, "create edit")) as { id: string };
  const editId = edit.id;
  console.log(`✏️  edit: ${editId}`);

  try {
    // PATCH app details — defaultLanguage + contact only. The Play
    // Developer API v3 AppDetails resource does NOT include a privacy
    // policy field; the privacy-policy URL must be set via the Play
    // Console web UI (Policy → App content → Privacy policy). The
    // manifest still tracks the URL so we have one source of truth;
    // operators copy it into the console once per app.
    const detailsBody = {
      defaultLanguage: manifest.defaultLanguage,
      contactEmail: manifest.contactEmail,
      contactWebsite: manifest.contactWebsite,
    };
    const dRes = await authedFetch(
      token,
      `/androidpublisher/v3/applications/${pkg}/edits/${editId}/details`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(detailsBody),
      },
    );
    await jsonOrThrow(dRes, "patch details");
    console.log(`   ✓ details (contact email + website)`);
    console.log(
      `   ⓘ  privacy policy URL (${manifest.privacyPolicyUrl}) must be set manually in Play Console → Policy → App content`,
    );

    // PUT listing for the target language.
    const listingBody = {
      language: manifest.language,
      title: manifest.title,
      shortDescription: manifest.shortDescription,
      fullDescription: manifest.fullDescription,
    };
    const lRes = await authedFetch(
      token,
      `/androidpublisher/v3/applications/${pkg}/edits/${editId}/listings/${manifest.language}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(listingBody),
      },
    );
    await jsonOrThrow(lRes, "put listing");
    console.log(`   ✓ listing [${manifest.language}]`);

    // Draft-app guard: before the app has gone through its first
    // production review, Play blocks commits with "Only releases with
    // status draft may be created on draft app" whenever a non-draft
    // release sits in any track's edit snapshot. Strip those from each
    // track within the edit before committing. Completed releases
    // continue to appear in Play's read API after commit (Play preserves
    // them separately as live state); the PUT here only clears them from
    // the edit-diff so commit validation passes. See spec 29 §8.5.
    await stripCompletedReleasesFromAllTracks(token, pkg, editId);

    const cRes = await authedFetch(
      token,
      `/androidpublisher/v3/applications/${pkg}/edits/${editId}:commit`,
      { method: "POST" },
    );
    await jsonOrThrow(cRes, "commit");
    console.log(`✅ committed edit ${editId}`);
  } catch (err) {
    console.error(`✗ push failed — rolling back edit ${editId}`);
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
