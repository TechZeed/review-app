#!/usr/bin/env bun
/**
 * Generate Play Store visual assets into apps/mobile/store-assets/:
 *
 *   icon-512.png                      (downscaled from assets/icon.png via magick)
 *   feature-graphic-1024x500.png      (composed via magick)
 *   screenshot-1-scan.png             (Playwright capture of a /r/:slug page)
 *   screenshot-2-dashboard.png        (Playwright capture of the dashboard)
 *
 * Assumptions:
 *   - `magick` on PATH (ImageMagick 7).
 *   - apps/regression has @playwright/test installed with chromium.
 *   - DEFAULT_SEED_PASSWORD set (for dashboard login) OR fall back to
 *     "Demo123" which matches the dev seed.
 *
 * Phone viewport: 1080×1920 (Play requires 320–3840 per side, 16:9 or
 * 9:16 preferred). Landing + dashboard shots.
 *
 * Spec 29 §8.5 (new).
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "http";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ASSETS_DIR = resolve(REPO_ROOT, "apps/mobile/store-assets");
const SOURCE_ICON = resolve(REPO_ROOT, "apps/mobile/assets/icon.png");

const SCAN_BASE = process.env.REGRESSION_SCAN_URL ?? "https://review-scan.teczeed.com";
const DASHBOARD_BASE = process.env.REGRESSION_DASHBOARD_URL ?? "https://review-dashboard.teczeed.com";
const API_BASE = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";
const DEMO_EMAIL = process.env.PLAY_DEMO_EMAIL ?? "ramesh@reviewapp.demo";
const DEMO_PASSWORD = process.env.DEFAULT_SEED_PASSWORD ?? "Demo123";
const DEMO_SLUG = process.env.PLAY_DEMO_SLUG ?? "ramesh-kumar";

const VIEWPORT = { width: 1080, height: 1920 };

function run(cmd: string, args: string[]) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.status !== 0) throw new Error(`${cmd} exited ${res.status}`);
}

function ensureDir() {
  if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });
}

function renderIcon() {
  const out = resolve(ASSETS_DIR, "icon-512.png");
  // Play requires 512×512 32-bit PNG for the high-res icon.
  run("magick", [SOURCE_ICON, "-resize", "512x512", "-strip", out]);
}

function renderFeatureGraphic() {
  const out = resolve(ASSETS_DIR, "feature-graphic-1024x500.png");
  // Indigo #4f46e5 background, white ReviewApp wordmark + tagline.
  // Using ImageMagick's label: primitive — no font file dependency.
  // -font on macOS resolves via system font cache.
  run("magick", [
    "-size",
    "1024x500",
    "xc:#4f46e5",
    "-gravity",
    "center",
    "-fill",
    "white",
    "-font",
    "Helvetica-Bold",
    "-pointsize",
    "120",
    "-annotate",
    "+0-40",
    "ReviewApp",
    "-font",
    "Helvetica",
    "-pointsize",
    "44",
    "-annotate",
    "+0+70",
    "Every individual is a brand",
    "-strip",
    out,
  ]);
}

async function captureScreenshots() {
  // Dynamic import from apps/regression so we reuse its @playwright/test.
  // Bun resolves the dep via that node_modules tree.
  const playwright = await import(
    resolve(REPO_ROOT, "apps/regression/node_modules/@playwright/test/index.js")
  );
  const { chromium } = playwright as typeof import("@playwright/test");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: false,
  });

  try {
    // 1) Scan/landing
    const page1 = await context.newPage();
    const scanUrl = `${SCAN_BASE}/r/${DEMO_SLUG}`;
    console.log(`→ capturing ${scanUrl}`);
    await page1.goto(scanUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await page1.waitForTimeout(1000);
    await page1.screenshot({
      path: resolve(ASSETS_DIR, "screenshot-1-scan.png"),
      fullPage: false,
    });
    await page1.close();

    // 2) Dashboard — prime the localStorage auth token, then navigate.
    const page2 = await context.newPage();
    const login = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    if (!login.ok) {
      const body = await login.text();
      throw new Error(`demo login failed: ${login.status} ${body.slice(0, 200)}`);
    }
    const { accessToken, user } = (await login.json()) as {
      accessToken: string;
      user: { id: string; email: string; role: string; name?: string };
    };
    const authUser = {
      token: accessToken,
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? "",
      profile_slug: DEMO_SLUG,
      capabilities: [] as string[],
    };

    await page2.goto(`${DASHBOARD_BASE}/login`, { waitUntil: "domcontentloaded" });
    await page2.evaluate((u) => {
      localStorage.setItem("auth_user", JSON.stringify(u));
    }, authUser);
    console.log(`→ capturing ${DASHBOARD_BASE}/dashboard as ${DEMO_EMAIL}`);
    await page2.goto(`${DASHBOARD_BASE}/dashboard`, { waitUntil: "networkidle", timeout: 30_000 });
    await page2
      .getByTestId("dashboard-root")
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {
        console.warn("   (dashboard-root not found; capturing current state)");
      });
    await page2.waitForTimeout(1500);
    await page2.screenshot({
      path: resolve(ASSETS_DIR, "screenshot-2-dashboard.png"),
      fullPage: false,
    });
    await page2.close();

    // 3) Optional third: profile page (scroll to show review list on scan URL)
    try {
      const page3 = await context.newPage();
      await page3.goto(scanUrl, { waitUntil: "networkidle", timeout: 30_000 });
      await page3.waitForTimeout(800);
      await page3.evaluate(() => window.scrollBy(0, 600));
      await page3.waitForTimeout(500);
      await page3.screenshot({
        path: resolve(ASSETS_DIR, "screenshot-3-profile.png"),
        fullPage: false,
      });
      await page3.close();
    } catch (e) {
      console.warn(`   (screenshot-3 skipped: ${(e as Error).message})`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  ensureDir();
  console.log(`📁 ${ASSETS_DIR}`);
  renderIcon();
  renderFeatureGraphic();
  await captureScreenshots();
  console.log("✅ assets generated");
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
