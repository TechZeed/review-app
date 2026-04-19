import { defineConfig } from "@playwright/test";

// All URLs come from env — suite is env-agnostic (spec 25 §10).
// Defaults point at dev so `npx playwright test` works without flags when
// .env.regression is loaded.
const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";
const SCAN_URL = process.env.REGRESSION_SCAN_URL ?? "https://review-scan.teczeed.com";
const DASHBOARD_URL = process.env.REGRESSION_DASHBOARD_URL ?? "https://review-dashboard.teczeed.com";

export default defineConfig({
  testDir: "./src/flows",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: false,
  },

  projects: [
    {
      name: "smoke",
      use: { baseURL: API_URL },
      testMatch: /00-smoke\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { baseURL: API_URL },
      testMatch: /01-mobile-api\.spec\.ts/,
    },
    {
      name: "scanner",
      use: { baseURL: SCAN_URL },
      testMatch: /04-scanner\.spec\.ts/,
    },
    {
      name: "dashboard",
      use: { baseURL: DASHBOARD_URL },
      testMatch: /(02-dashboard-login|03-dashboard-reviews|05-role-upgrade|06-subscription|07-admin-page)\.spec\.ts/,
    },
    {
      name: "api",
      use: { baseURL: API_URL },
      testMatch: /07-cross-stack\.spec\.ts/,
    },
  ],
});
