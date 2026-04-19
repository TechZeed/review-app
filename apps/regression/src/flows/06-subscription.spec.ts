import { test } from "@playwright/test";

// Subscription flow — DEFERRED.
//
// Why skipped:
//   1. No billing UI ships in apps/ui/src today. Grepping the dashboard
//      source for billing|subscription|stripe returns zero matches, so
//      there's no surface to drive from the browser yet.
//   2. The Stripe webhook path on dev is unverified — we'd also need to
//      poll the `subscriptions` table post-test and confirm the webhook
//      landed, which is flaky when tests run from a dev laptop without
//      the `stripe listen` forwarder attached (spec 25 §5).
//
// When both of those gates clear, replace this skip with a real flow:
//   - james@reviewapp.demo logs in (EMPLOYER, DASHBOARD)
//   - UI → billing → pick plan → Stripe iframe → 4242 4242 4242 4242
//   - Poll `SELECT status FROM subscriptions WHERE user_id = james_id`
//     with ≤30s timeout for `active`
//   - Cleanup: cancel subscription + delete DB row
//
// Until then the test stays visible in the report so the gap is
// obvious, rather than silently missing.

test.skip("james subscribes to EMPLOYER_SMALL via Stripe test card", () => {
  // Blocked on: no billing UI in apps/ui/src yet + dev Stripe webhook
  // verification still pending. See comment block at the top of file.
});
