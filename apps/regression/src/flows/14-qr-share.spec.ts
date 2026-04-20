import { test, expect, type BrowserContext } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Reviewee daily-loop coverage — QR share affordance on the dashboard.
//
// PRD: every individual is a brand → the QR code is the primary growth
// surface. We assert the dashboard renders a scannable QR for the logged-in
// reviewee, and that the "Copy link" button puts the canonical public URL
// (https://review-scan.teczeed.com/r/<slug>) on the clipboard.
//
// We deliberately do NOT click the native-share button — Playwright can't
// interact with the OS share sheet, and the codepath alerts on failure. We
// just assert it's present + enabled.
//
// No DB writes. Cleanup-free.

const SCAN_URL = process.env.REGRESSION_SCAN_URL ?? "https://review-scan.teczeed.com";
const RAMESH_PUBLIC_URL = `${SCAN_URL}/r/ramesh-kumar`;

async function grantClipboard(context: BrowserContext, origin: string): Promise<void> {
  // Chromium needs explicit clipboard permission for the dashboard origin
  // before navigator.clipboard.{readText,writeText} resolves.
  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  } catch {
    // Webkit/Firefox channels ignore the permission API — readText() will
    // still work in headless Chromium, which is what CI uses.
  }
}

test.describe("dashboard QR share (spec PRD-01)", () => {
  test("ramesh sees QR + copy-link puts public URL on clipboard", async ({ page, context }) => {
    const dashboardOrigin =
      process.env.REGRESSION_DASHBOARD_URL ?? "https://review-dashboard.teczeed.com";
    await grantClipboard(context, dashboardOrigin);

    await primeDashboardSession(page, "ramesh@reviewapp.demo");

    // QR container exists and the SVG is rendered inside it.
    const qrContainer = page.getByTestId("reviewee-qr");
    await expect(qrContainer).toBeVisible({ timeout: 10_000 });
    await expect(qrContainer.locator("svg")).toBeVisible();

    // The container is annotated with the canonical public URL so the
    // assertion is independent of the QR pixel content.
    await expect(qrContainer).toHaveAttribute("data-qr-url", RAMESH_PUBLIC_URL);

    // The visible URL caption matches too — guards against the share UI
    // drifting from the QR encoder.
    await expect(page.getByText(RAMESH_PUBLIC_URL, { exact: true })).toBeVisible();

    // Share button present and enabled. Don't click — native share sheet
    // is unreachable from Playwright.
    const shareBtn = page.getByTestId("share-qr-button");
    await expect(shareBtn).toBeVisible();
    await expect(shareBtn).toBeEnabled();

    // Copy-link is the testable fallback. Stub the post-copy alert so it
    // doesn't block, click, then assert clipboard contents.
    const copyBtn = page.getByTestId("copy-link-button");
    await expect(copyBtn).toBeVisible();

    page.on("dialog", (d) => {
      void d.accept();
    });

    await copyBtn.click();

    // Wait for clipboard to settle (writeText is async + inside a try).
    await expect.poll(
      async () => page.evaluate(() => navigator.clipboard.readText()),
      { timeout: 5_000 },
    ).toBe(RAMESH_PUBLIC_URL);
  });
});
