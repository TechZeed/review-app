import { test, expect } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Subscription / billing flow regression.
//
// What this exercises:
//   1. james@reviewapp.demo (EMPLOYER) signs in and lands on /billing
//   2. The billing page renders the employer-tier plan cards (3 of them)
//      from spec 11 §1.2
//   3. Clicking "Upgrade" on one of the plans posts to
//      /api/v1/subscriptions/checkout and gets back a Stripe-hosted
//      `checkoutUrl` (we stop at the redirect — the cross-origin Stripe
//      Checkout page itself is covered by the `test.fixme` block below).
//
// Why we don't drive the full Stripe iframe → webhook → status=active
// loop here:
//   - Stripe-hosted Checkout is a cross-origin page on
//     `checkout.stripe.com`. Playwright can technically fill it, but it's
//     known to be brittle in headless Chromium (recaptcha, 3DS popups,
//     A/B test variants of the Stripe form).
//   - The webhook landing path requires `stripe listen` forwarding from
//     the test runner machine (spec 25 §5), which CI doesn't have.
//   - Both of those gates are tracked in the `test.fixme` below.

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

test.describe("billing page (browser)", () => {
  test("james sees employer plans and can start a Stripe checkout session", async ({
    page,
  }) => {
    await primeDashboardSession(page, "james@reviewapp.demo");

    await page.goto("/billing");
    await expect(page.getByTestId("billing-root")).toBeVisible({ timeout: 15_000 });

    // Current-plan card always renders (free tier if no subscription).
    await expect(page.getByTestId("billing-current-plan")).toBeVisible();

    // Employer plans grid: small / medium / large = 3 cards.
    const cards = page.getByTestId("billing-plan-card");
    await expect(cards).toHaveCount(3, { timeout: 10_000 });
    await expect(cards.first()).toContainText(/Employer/i);

    // Intercept the checkout POST so we can stop the redirect cleanly
    // (we don't want this test to actually navigate to Stripe).
    const checkoutPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/subscriptions/checkout") &&
        res.request().method() === "POST",
      { timeout: 15_000 },
    );

    // Click the first available upgrade button.
    const upgradeBtn = page.getByTestId("billing-upgrade-btn").first();
    await upgradeBtn.click();

    const res = await checkoutPromise;
    // Either 201 (new session) or 409 (active sub already exists from a
    // prior run that didn't get cleaned up) — both prove the wiring is
    // intact.
    expect([201, 409]).toContain(res.status());

    if (res.status() === 201) {
      const body = await res.json();
      expect(body.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    }
  });

  test.fixme(
    "james completes Stripe test-card checkout and ends up with active subscription",
    async () => {
      // Blocked on:
      //   1. Cross-origin Stripe-hosted Checkout is brittle to drive in
      //      headless Chromium (recaptcha, 3DS, layout A/B tests).
      //   2. CI runners don't have `stripe listen` forwarding the
      //      `checkout.session.completed` webhook back to dev.
      // When both are sorted: log james in, navigate /billing, click
      // Upgrade, follow the redirect, fill 4242 4242 4242 4242 / any
      // future date / any CVC, wait for redirect back to
      // /billing?status=success, then poll
      // GET /api/v1/subscriptions/me until status === "active".
      void API_URL;
    },
  );
});
