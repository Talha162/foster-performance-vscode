import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getUncachableStripeClient, getCachedStripeMode } from "../stripeClient";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import type Stripe from "stripe";

const router: IRouter = Router();

// ── Price lookup-key constants ───────────────────────────────────────────────
const PRICE_KEY_MONTHLY = "foster_membership_monthly_v1";
const PRICE_KEY_ANNUAL = "foster_membership_annual_v1";

/**
 * Find or create the Stripe Price for a membership plan.
 * Uses lookup_key to avoid creating duplicates across restarts.
 */
async function getOrCreatePrice(stripe: Stripe, plan: "monthly" | "annual"): Promise<string> {
  const lookupKey = plan === "monthly" ? PRICE_KEY_MONTHLY : PRICE_KEY_ANNUAL;
  const amount = plan === "monthly" ? 999 : 7999; // cents
  const interval: "month" | "year" = plan === "monthly" ? "month" : "year";

  try {
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (existing.data.length > 0) return existing.data[0].id;
  } catch { /* fall through to create */ }

  // Create product + price
  const product = await stripe.products.create({
    name: "Foster Performance Membership",
    description: "Full access to all fitness programs, nutrition plans, and the Coach Marketplace.",
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

/**
 * Save a subscription record to the DB.
 * Non-fatal — if the DB is unavailable, the subscription response is still returned.
 */
async function saveSubscription(
  userId: string,
  userEmail: string | undefined,
  userName: string | undefined,
  customerId: string,
  subscriptionId: string,
  plan: string,
  status: string,
  currentPeriodEnd: string
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.execute(sql`
      INSERT INTO member_subscriptions
        (id, user_id, user_email, user_name, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
      VALUES
        (${randomUUID()}, ${userId}, ${userEmail ?? null}, ${userName ?? null},
         ${customerId}, ${subscriptionId}, ${plan}, ${status}, ${currentPeriodEnd}::timestamptz)
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end
    `);
  } catch (err: any) {
    logger.warn({ err: err.message }, "Failed to save subscription record to DB (non-fatal)");
  }
}

/**
 * POST /api/subscriptions/create
 *
 * Creates a Foster Performance membership subscription.
 * In test mode with raw card data (same pattern as bookings).
 * Falls back to a mock subscription when Stripe is not connected.
 */
router.post("/subscriptions/create", async (req, res) => {
  const {
    userId,
    userName,
    userEmail,
    cardNumber,
    cardExpiry,
    cardCvc,
    cardName,
    plan,
    idempotencyKey,
  } = req.body as Record<string, string | undefined>;

  if (!userId || !plan || !idempotencyKey) {
    res.status(400).json({ error: "Missing required fields: userId, plan, idempotencyKey" });
    return;
  }
  if (plan !== "monthly" && plan !== "annual") {
    res.status(400).json({ error: 'plan must be "monthly" or "annual"' });
    return;
  }
  if (!cardNumber || !cardExpiry || !cardCvc) {
    res.status(400).json({ error: "Missing card details" });
    return;
  }

  // Guard: never accept raw cards in live mode
  if (getCachedStripeMode() === "live") {
    res.status(503).json({
      error: "Raw card collection is unavailable in production. Please use the Stripe mobile SDK.",
    });
    return;
  }

  // ── Try to use Stripe ────────────────────────────────────────────────────
  let stripe: Stripe | null = null;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    // Stripe not connected — fall through to mock mode
  }

  const [expMonth, expYearShort] = (cardExpiry ?? "").split("/");
  const expYear = expYearShort?.length === 2 ? `20${expYearShort}` : expYearShort;

  // ── Mock mode (Stripe not connected) ─────────────────────────────────────
  if (!stripe) {
    logger.warn({ userId }, "Stripe not connected — creating mock subscription");
    const now = Date.now();
    const msToAdd = plan === "annual" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const subId = "sub_test_" + randomUUID().replace(/-/g, "").slice(0, 24);
    const custId = "cus_test_" + randomUUID().replace(/-/g, "").slice(0, 24);
    const endDate = new Date(now + msToAdd).toISOString();

    await saveSubscription(userId, userEmail, userName, custId, subId, plan, "active", endDate);

    res.json({
      subscriptionId: subId,
      customerId: custId,
      status: "active",
      currentPeriodEnd: endDate,
      plan,
      testMode: true,
    });
    return;
  }

  // ── Real Stripe subscription ──────────────────────────────────────────────
  try {
    // 1. Create PaymentMethod from raw card (test mode only, enforced above)
    if (!expMonth || !expYear || isNaN(Number(expMonth)) || isNaN(Number(expYear))) {
      res.status(400).json({ error: "Invalid card expiry format. Expected MM/YY." });
      return;
    }

    const paymentMethod = await stripe.paymentMethods.create(
      {
        type: "card",
        card: {
          number: cardNumber.replace(/\s/g, ""),
          exp_month: parseInt(expMonth, 10),
          exp_year: parseInt(expYear, 10),
          cvc: cardCvc,
        },
        billing_details: {
          name: cardName ?? userName ?? "Member",
          email: userEmail ?? undefined,
        },
      },
      { idempotencyKey: `sub-pm-${idempotencyKey}` }
    );

    // 2. Create Customer
    const customer = await stripe.customers.create(
      {
        email: userEmail ?? undefined,
        name: userName ?? undefined,
        payment_method: paymentMethod.id,
        invoice_settings: { default_payment_method: paymentMethod.id },
        metadata: { userId },
      },
      { idempotencyKey: `sub-cust-${idempotencyKey}` }
    );

    // 3. Get or create Price
    const priceId = await getOrCreatePrice(stripe, plan as "monthly" | "annual");

    // 4. Create Subscription
    const subscription = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [{ price: priceId }],
        payment_settings: {
          payment_method_types: ["card"],
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: { userId, plan },
      },
      { idempotencyKey: `sub-create-${idempotencyKey}` }
    );

    const status =
      subscription.status === "trialing" ? "trialing" :
      subscription.status === "active" ? "active" : subscription.status;

    // current_period_end is a number on Stripe Subscription; cast needed for SDK typing variance
    const endDate = new Date((subscription as any).current_period_end * 1000).toISOString();

    await saveSubscription(userId, userEmail, userName, customer.id, subscription.id, plan, status, endDate);

    logger.info({ subscriptionId: subscription.id, userId, plan, status }, "Subscription created");

    res.json({
      subscriptionId: subscription.id,
      customerId: customer.id,
      status,
      currentPeriodEnd: endDate,
      plan,
      testMode: true,
    });
  } catch (err: any) {
    logger.error({ err: err.message, userId }, "Subscription creation failed");
    const userMessage =
      err.type === "StripeCardError"
        ? (err.message as string)
        : "Subscription failed. Please check your card details and try again.";
    res.status(402).json({ error: userMessage, stripeCode: err.code });
  }
});

/**
 * POST /api/subscriptions/cancel
 *
 * Cancels a Stripe subscription at period end (members keep access until then).
 * Falls back to a no-op confirmation when Stripe is not connected.
 */
router.post("/subscriptions/cancel", async (req, res) => {
  const { subscriptionId } = req.body as { subscriptionId?: string };

  if (!subscriptionId) {
    res.status(400).json({ error: "subscriptionId is required" });
    return;
  }

  // Mock subscription IDs — just confirm cancellation
  if (subscriptionId.startsWith("sub_test_")) {
    if (process.env.DATABASE_URL) {
      try {
        await db.execute(sql`
          UPDATE member_subscriptions SET status = 'canceled' WHERE stripe_subscription_id = ${subscriptionId}
        `);
      } catch { /* non-fatal */ }
    }
    res.json({ status: "canceled", canceledAt: new Date().toISOString() });
    return;
  }

  let stripe: Stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    res.status(503).json({ error: "Payment system not configured." });
    return;
  }

  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    if (process.env.DATABASE_URL) {
      try {
        await db.execute(sql`
          UPDATE member_subscriptions SET status = 'canceled' WHERE stripe_subscription_id = ${subscriptionId}
        `);
      } catch { /* non-fatal */ }
    }

    logger.info({ subscriptionId }, "Subscription scheduled for cancellation at period end");
    res.json({
      status: "canceled",
      canceledAt: new Date().toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (err: any) {
    logger.error({ err: err.message, subscriptionId }, "Subscription cancellation failed");
    res.status(500).json({ error: "Could not cancel subscription. Please try again." });
  }
});

/**
 * GET /api/subscriptions/status/:subscriptionId
 *
 * Returns the current status of a subscription.
 */
router.get("/subscriptions/status/:subscriptionId", async (req, res) => {
  const { subscriptionId } = req.params;

  if (!subscriptionId) {
    res.status(400).json({ error: "subscriptionId is required" });
    return;
  }

  // Check DB first
  if (process.env.DATABASE_URL) {
    try {
      const rows = await db.execute(sql`
        SELECT stripe_subscription_id, plan, status, current_period_end
        FROM member_subscriptions
        WHERE stripe_subscription_id = ${subscriptionId}
        LIMIT 1
      `);
      if (rows.rows.length > 0) {
        const row = rows.rows[0] as any;
        res.json({
          subscriptionId: row.stripe_subscription_id,
          plan: row.plan,
          status: row.status,
          currentPeriodEnd: row.current_period_end,
        });
        return;
      }
    } catch { /* fall through */ }
  }

  // Try Stripe directly
  let stripe: Stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    res.status(503).json({ error: "Payment system not configured." });
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    res.json({
      subscriptionId: subscription.id,
      plan: subscription.metadata?.plan ?? "monthly",
      status: subscription.status,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
    });
  } catch (err: any) {
    logger.error({ err: err.message, subscriptionId }, "Failed to retrieve subscription");
    res.status(404).json({ error: "Subscription not found." });
  }
});

export default router;
