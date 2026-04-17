#!/usr/bin/env node
/**
 * apple-setup — open Apple Developer + App Store Connect in a Playwright-driven
 * Chromium and poll for IDs we need for `eas.json`:
 *   - appleTeamId  (from developer.apple.com/account)
 *   - ascAppId     (from the URL after the app is created in App Store Connect)
 *
 * You log in + do 2FA manually. The script watches the pages and writes both
 * IDs to `apps/mobile/.apple-ids.json`. Ctrl+C to stop.
 *
 * Run:  node infra/dev/apple-setup.mjs
 */
import { chromium } from "/usr/local/lib/node_modules/playwright/index.mjs";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const PROFILE_DIR = resolve(REPO_ROOT, "infra/dev/.apple-browser-profile");
const OUT_FILE = resolve(REPO_ROOT, "apps/mobile/.apple-ids.json");

const BUNDLE_ID = "sg.reviewapp.app";

function loadState() {
  if (!existsSync(OUT_FILE)) return {};
  try {
    return JSON.parse(readFileSync(OUT_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  writeFileSync(OUT_FILE, JSON.stringify(state, null, 2));
}

function log(msg) {
  console.log(`[apple-setup ${new Date().toLocaleTimeString()}] ${msg}`);
}

const state = loadState();
log(`starting — current state: ${JSON.stringify(state)}`);

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null,
  args: ["--no-first-run"],
});

// Dev portal tab
const devPage = await ctx.newPage();
await devPage.goto("https://developer.apple.com/account", { waitUntil: "domcontentloaded" }).catch(() => {});

// ASC tab
const ascPage = await ctx.newPage();
await ascPage.goto("https://appstoreconnect.apple.com/apps", { waitUntil: "domcontentloaded" }).catch(() => {});

log("Browser open. Log in to both tabs (use io@deemwar.com). I'll poll every 5s.");
log(`Bundle ID to use in ASC when creating the app: ${BUNDLE_ID}`);
log(`IDs will be saved to: ${OUT_FILE}`);

async function scrapeTeamId(page) {
  try {
    // Team ID appears in the account page as a visible label "Team ID" in membership details,
    // and also in the window.__AppleIDSession or similar. Try a few strategies.
    const html = await page.content();
    const m = html.match(/Team ID[^A-Z0-9]{0,40}([A-Z0-9]{10})/);
    if (m) return m[1];
    // Fallback: scan for any 10-char team-id-shaped string near the word "Team"
    const m2 = html.match(/\b([A-Z0-9]{10})\b[^<]{0,40}Team/);
    if (m2) return m2[1];
    return null;
  } catch {
    return null;
  }
}

async function scrapeAscAppId(page) {
  try {
    const url = page.url();
    // ASC app URLs: https://appstoreconnect.apple.com/apps/{APP_ID}/...
    const m = url.match(/\/apps\/(\d{9,12})(?:\/|$|\?)/);
    if (m) return m[1];
    // Also scan anchor hrefs on the app-list page
    const hrefs = await page.$$eval("a[href*='/apps/']", (els) => els.map((e) => e.href));
    for (const h of hrefs) {
      const mm = h.match(/\/apps\/(\d{9,12})(?:\/|$|\?)/);
      if (mm) return mm[1];
    }
    return null;
  } catch {
    return null;
  }
}

async function scrapeAscPagesForBundle(page) {
  try {
    // When browsing ASC apps list we may find an entry matching our bundle id.
    const hits = await page
      .$$eval("[data-test-id], article, a, div", (els) =>
        els
          .map((e) => ({
            text: (e.textContent || "").trim().slice(0, 200),
            href: e.href || null,
          }))
          .filter((x) => x.text.includes("sg.reviewapp.app") || (x.text.includes("Review") && x.href)),
      )
      .catch(() => []);
    return hits.slice(0, 5);
  } catch {
    return [];
  }
}

let ticks = 0;
const maxTicks = 180; // 15 minutes at 5s

const timer = setInterval(async () => {
  ticks++;
  let changed = false;

  if (!state.appleTeamId) {
    const t = await scrapeTeamId(devPage);
    if (t) {
      state.appleTeamId = t;
      changed = true;
      log(`✓ Captured appleTeamId = ${t}`);
    }
  }

  if (!state.ascAppId) {
    // First check current ASC page URL (if user clicked into an app)
    let a = await scrapeAscAppId(ascPage);
    if (a) {
      state.ascAppId = a;
      changed = true;
      log(`✓ Captured ascAppId = ${a}`);
    }
  }

  if (changed) saveState(state);

  if (ticks % 6 === 0) {
    log(
      `tick ${ticks}/${maxTicks} — team:${state.appleTeamId || "waiting"} asc:${state.ascAppId || "waiting"}`,
    );
  }

  if (state.appleTeamId && state.ascAppId) {
    log("Both IDs captured. You can Ctrl+C now (browser will stay for any extra work).");
  }

  if (ticks >= maxTicks) {
    log("15-minute poll window reached. Exiting.");
    clearInterval(timer);
    await ctx.close().catch(() => {});
    process.exit(0);
  }
}, 5000);

process.on("SIGINT", async () => {
  log("SIGINT — saving state and closing browser");
  clearInterval(timer);
  saveState(state);
  await ctx.close().catch(() => {});
  process.exit(0);
});
