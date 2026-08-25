/**
 * Coach Subscriptions API
 *
 * Mirrors the member subscription flow. Coaches pay a platform subscription
 * ($29.99/month or $249.99/year) to offer their services. In test mode only;
 * raw card data is accepted the same way as member subscriptions.
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getUncachableStripeClient, getCachedStripeMode } from "../stripeClient";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth, type AuthRequest } from "../middleware/requireAuth";
import type Stripe from "stripe";

const router: IRouter = Router();

const PRICE_KEY_COACH_MONTHLY = "foster_coach_monthly_v1";
const PRICE_KEY_COACH_ANNUAL  = "foster_coach_annual_v1";
const COACH_MONTHLY_CENTS     = 2999;   // $29.99
const COACH_ANNUAL_CENTS      = 24999;  // $249.99

async function getOrCreateCoachPrice(stripe: Stripe, plan: "monthly" | "annual"): Promise<string> {
  const lookupKey = plan === "monthly" ? PRICE_KEY_COACH_MONTHLY : PRICE_KEY_COACH_ANNUAL;
  const amount = plan === "monthly" ? COACH_MONTHLY_CENTS : COACH_ANNUAL_CENTS;
  const interval: "month" | "year" = plan === "monthly" ? "month" : "year";

  try {
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (existing.data.length > 0) return existing.data[0].id;
  } catch { /* fall through */ }

  const product = await stripe.products.create({
    name: "Foster Performance Coach Platform",
    description: "Coach dashboard, booking management, and client tools.",
  });
  const price = await stripe.prices.create({
    unit_amount: amount,
    currency: "usd",
    recurring: { interval },
    product: product.id,
    lookup_key: lookupKey,
    transfer_lookup_key: true,
  });
  return price.id;
}

// ── POST /coach-subscriptions/create ─────────────────────────────────────────
router.post("/coach-subscriptions/create", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;
  if (accountType !== "coach" && accountType !== "owner_admin") {
    res.status(403).json({ error: "Coach account required" });
    return;
  }

  const { plan, idempotencyKey } = req.body as Record<string, string | undefined>;

  if (!plan || !idempotencyKey) {
    res.status(400).json({ error: "Missing required fields: plan, idempotencyKey" });
    return;
  }
  if (plan !== "monthly" && plan !== "annual") {
    res.status(400).json({ error: 'plan must be "monthly" or "annual"' });
    return;
  }

  // Reject in live mode — real payment via Stripe PaymentSheet not yet implemented.
  if (getCachedStripeMode() === "live") {
    res.status(503).json({
      error:
        "Coach subscription payment is not yet available in live mode. " +
        "Connect Stripe and complete the native SDK integration to enable real charges.",
    });
    return;
  }

  // Coach subscription is test-mode only — no raw card data accepted.
  // Real payment via Stripe PaymentSheet will be wired when Task #5
  // (native Stripe card collection) is complete.
  const mockId = `mock_coach_sub_${randomUUID()}`;
  if (process.env.DATABASE_URL) {
    try {
      await db.execute(sql`
        UPDATE users SET
          subscription_status = 'active',
          subscription_plan = ${"coach_" + plan},
          stripe_subscription_id = ${mockId},
          updated_at = NOW()
        WHERE id = ${userId}
      `);
    } catch { /* non-fatal */ }
  }

  res.status(201).json({
    subscriptionId: mockId,
    status: "active",
    plan,
    testMode: true,
    mock: true,
  });
});

// ── GET /coach-subscriptions/status ──────────────────────────────────────────
router.get("/coach-subscriptions/status", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;

  if (!process.env.DATABASE_URL) {
    res.json({ status: "none", plan: null });
    return;
  }

  try {
    const r = await db.execute(sql`
      SELECT subscription_status, subscription_plan, stripe_subscription_id
      FROM users WHERE id = ${userId} LIMIT 1
    `);
    const row = r.rows[0] as Record<string, any> | undefined;
    res.json({
      status: row?.subscription_status ?? "none",
      plan: row?.subscription_plan ?? null,
      stripeSubscriptionId: row?.stripe_subscription_id ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /coach-subscriptions/cancel ─────────────────────────────────────────
router.post("/coach-subscriptions/cancel", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;

  if (!process.env.DATABASE_URL) {
    res.json({ success: true });
    return;
  }

  try {
    const r = await db.execute(sql`
      SELECT stripe_subscription_id FROM users WHERE id = ${userId} LIMIT 1
    `);
    const row = r.rows[0] as Record<string, any> | undefined;
    const stripeSubId = row?.stripe_subscription_id;

    if (stripeSubId && !stripeSubId.startsWith("mock_")) {
      let stripe: Stripe | null = null;
      try { stripe = await getUncachableStripeClient(); } catch { /* non-fatal */ }
      if (stripe) {
        await stripe.subscriptions.cancel(stripeSubId);
      }
    }

    await db.execute(sql`
      UPDATE users SET
        subscription_status = 'cancelled',
        updated_at = NOW()
      WHERE id = ${userId}
    `);
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "Coach subscription cancel failed");
    res.status(500).json({ error: err.message });
  }
});

export default router;
