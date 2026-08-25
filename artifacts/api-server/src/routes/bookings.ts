import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { getSessionPrice, getSessionPriceForCoach } from "../coachPrices";
import { db } from "@workspace/db";
import { bookingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth, type AuthRequest } from "../middleware/requireAuth";
import type Stripe from "stripe";

// Free-cancellation window: 24 hours before session start.
const FREE_CANCEL_MS = 24 * 60 * 60 * 1000;
// Outside the window an athlete receives a 50% refund.
const PARTIAL_REFUND_PCT = 0.5;

const router: IRouter = Router();

// ── GET /bookings ─────────────────────────────────────────────────────────────
// For coaches: returns their own bookings (matched by coach_applications.id → "api_N").
// For members: returns their own bookings (matched by athlete_email).
// Requires authentication.
router.get("/bookings", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;

  if (!process.env.DATABASE_URL) {
    res.json({ bookings: [] });
    return;
  }

  try {
    if (accountType === "coach" || accountType === "owner_admin") {
      // Coaches see bookings where coach_id = "api_N" (their application ID)
      const appResult = await db.execute(sql`
        SELECT id FROM coach_applications WHERE user_id = ${userId} LIMIT 1
      `);
      if (!appResult.rows.length) {
        res.json({ bookings: [] });
        return;
      }
      const applicationId = (appResult.rows[0] as Record<string, any>).id;
      const coachId = `api_${applicationId}`;
      const result = await db.execute(sql`
        SELECT * FROM bookings WHERE coach_id = ${coachId} ORDER BY created_at DESC LIMIT 200
      `);
      res.json({ bookings: result.rows });
    } else if (accountType === "member") {
      // Members see their own bookings by email
      const userResult = await db.execute(sql`
        SELECT email FROM users WHERE id = ${userId} LIMIT 1
      `);
      const email = (userResult.rows[0] as Record<string, any> | undefined)?.email;
      if (!email) { res.json({ bookings: [] }); return; }
      const result = await db.execute(sql`
        SELECT * FROM bookings WHERE athlete_email = ${email} ORDER BY created_at DESC LIMIT 200
      `);
      res.json({ bookings: result.rows });
    } else {
      res.json({ bookings: [] });
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "GET /bookings failed");
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ── Simple in-memory rate limiter ────────────────────────────────────────────
// Max 5 booking attempts per IP per hour to limit unauthenticated abuse.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// ── HTML escaping ─────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Refund a PaymentIntent and log the outcome.
 * Pass `amountCents` to issue a partial refund; omit for a full refund.
 * Returns a boolean indicating whether the refund was issued successfully.
 */
async function issueRefund(
  stripe: Stripe,
  paymentIntentId: string,
  context: Record<string, string>,
  amountCents?: number
): Promise<boolean> {
  try {
    const params: Parameters<typeof stripe.refunds.create>[0] = {
      payment_intent: paymentIntentId,
    };
    if (amountCents !== undefined) {
      params.amount = amountCents;
    }
    await stripe.refunds.create(params);
    logger.info({ paymentIntentId, amountCents, ...context }, "Refund issued");
    return true;
  } catch (refundErr: any) {
    logger.error(
      { err: refundErr.message, paymentIntentId, amountCents, ...context },
      "CRITICAL: refund failed — manual reconciliation required"
    );
    return false;
  }
}

/**
 * Send a booking confirmation email via Resend.
 * Returns true if accepted by Resend, false otherwise.
 * Never throws — email failure must not affect payment or booking logic.
 */
async function sendConfirmationEmail(opts: {
  to: string;
  athleteName: string;
  coachName: string;
  date: string;
  time: string;
  sessionLength: number;
  price: number;
  bookingId: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn(
      { bookingId: opts.bookingId },
      "RESEND_API_KEY not configured — skipping confirmation email."
    );
    return false;
  }

  // Escape all user-controlled values before interpolating into HTML.
  const safeAthleteName = escapeHtml(opts.athleteName);
  const safeCoachName = escapeHtml(opts.coachName);
  const safeDate = escapeHtml(opts.date);
  const safeTime = escapeHtml(opts.time);
  const safeBookingId = escapeHtml(opts.bookingId);

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Session Confirmed! 🏈</h2>
      <p>Hi ${safeAthleteName},</p>
      <p>Your coaching session with <strong>${safeCoachName}</strong> is confirmed.</p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
        <p><strong>Date:</strong> ${safeDate}</p>
        <p><strong>Time:</strong> ${safeTime}</p>
        <p><strong>Duration:</strong> ${opts.sessionLength} minutes</p>
        <p><strong>Amount charged:</strong> $${opts.price}</p>
        <p><strong>Booking ID:</strong> ${safeBookingId}</p>
      </div>
      <p>Free cancellation up to 24 hours before your session. To cancel, visit your profile in the Foster Performance app.</p>
      <p style="color:#666;font-size:12px;">Foster Performance — Elite Football Training</p>
    </div>
  `;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Foster Performance <noreply@fosterperformance.app>",
        to: [opts.to],
        subject: `Session Confirmed: ${opts.coachName} on ${opts.date} at ${opts.time}`,
        html,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      logger.error({ status: resp.status, body, bookingId: opts.bookingId }, "Resend API rejected email");
      return false;
    }

    logger.info({ bookingId: opts.bookingId, to: opts.to }, "Confirmation email sent");
    return true;
  } catch (err: any) {
    logger.error({ err: err.message, bookingId: opts.bookingId }, "Network error sending confirmation email");
    return false;
  }
}

/**
 * POST /api/bookings
 *
 * Process a coaching session booking:
 *  1. Rate limits by IP (5 attempts/hour) to limit unauthenticated abuse.
 *  2. Derives the authoritative price server-side from coachId + sessionLength.
 *  3. Enforces test-mode-only for raw card number handling.
 *  4. Charges the card via Stripe PaymentIntents with an idempotency key.
 *  5. Only creates a booking when PaymentIntent status is exactly `succeeded`.
 *  6. All post-charge DB operations run inside one compensating block:
 *     - Check for existing booking by paymentIntentId (ON CONFLICT DO NOTHING + fetch).
 *     - Insert new booking; on any DB failure → refund and return 500.
 *  7. Sends a confirmation email via Resend (if RESEND_API_KEY is set).
 */
router.post("/bookings", requireAuth, async (req: AuthRequest, res) => {
  // ── Rate limiting ────────────────────────────────────────────────────────────
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";
  if (isRateLimited(clientIp)) {
    res.status(429).json({ error: "Too many booking attempts. Please wait and try again." });
    return;
  }

  const {
    coachId,
    sessionLength,
    date,
    time,
    cardNumber,
    cardExpiry,
    cardCvc,
    cardName,
    athleteEmail,
    athleteName,
    idempotencyKey,
    coachName,
    coachInitials,
    coachColor,
  } = req.body as Record<string, string | undefined>;

  // ── Input validation ────────────────────────────────────────────────────────
  if (!coachId || !sessionLength || !date || !time) {
    res.status(400).json({ error: "Missing required booking fields." });
    return;
  }
  if (!cardNumber || !cardExpiry || !cardCvc) {
    res.status(400).json({ error: "Missing required payment fields." });
    return;
  }
  if (!idempotencyKey) {
    res.status(400).json({ error: "Missing idempotencyKey — required to prevent duplicate charges." });
    return;
  }

  const sessionLengthNum = Number(sessionLength);
  if (sessionLengthNum !== 30 && sessionLengthNum !== 60) {
    res.status(400).json({ error: "sessionLength must be 30 or 60." });
    return;
  }

  // ── Suspension check for API coaches ─────────────────────────────────────
  // Reject bookings for coaches whose account has been suspended by an admin.
  if (coachId.startsWith("api_") && process.env.DATABASE_URL) {
    const numericId = coachId.replace("api_", "");
    try {
      const suspendResult = await db.execute(sql`
        SELECT u.is_suspended
        FROM coach_applications ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.id = ${numericId}
        LIMIT 1
      `);
      if ((suspendResult.rows[0] as any)?.is_suspended) {
        res.status(400).json({ error: "This coach is not currently available for booking." });
        return;
      }
    } catch (suspendErr: any) {
      logger.error({ err: suspendErr.message, coachId }, "Suspension check failed — rejecting booking");
      res.status(503).json({ error: "Coach availability could not be verified. Please try again." });
      return;
    }
  }

  // ── Availability validation for API coaches ──────────────────────────────
  // Verify the requested date/time falls within the coach's configured schedule.
  // Only enforced for api_N coaches (static c1–c8 coaches have no DB availability).
  if (coachId.startsWith("api_") && process.env.DATABASE_URL) {
    const numericId = coachId.replace("api_", "");
    try {
      const availResult = await db.execute(sql`
        SELECT weekly_availability FROM coach_applications WHERE id = ${numericId}
      `);
      const availRow = availResult.rows[0] as any;
      const rawAvail = availRow?.weekly_availability;
      if (rawAvail) {
        const parsed: any = JSON.parse(rawAvail);
        const FULL_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        // Normalise to { days, activeTimes }
        let days: Record<string, boolean> = {};
        let activeTimes: Record<string, boolean> = {};
        if (parsed && typeof parsed === "object" && parsed.days) {
          days = parsed.days;
          activeTimes = parsed.activeTimes ?? {};
        } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          // Legacy flat map
          if (FULL_DAYS.some((d) => d in parsed)) days = parsed;
        } else if (Array.isArray(parsed)) {
          for (const d of parsed as string[]) { if (FULL_DAYS.includes(d)) days[d] = true; }
        }
        // Validate day-of-week (use noon UTC to avoid DST ambiguity)
        if (Object.keys(days).length > 0) {
          const requestedDate = new Date(`${date}T12:00:00Z`);
          const dayName = FULL_DAYS[requestedDate.getUTCDay()];
          if (!days[dayName]) {
            res.status(400).json({ error: `This coach is not available on ${dayName}s.` });
            return;
          }
        }
        // Validate time slot
        if (Object.keys(activeTimes).length > 0 && !activeTimes[time]) {
          res.status(400).json({ error: `Time slot ${time} is not available with this coach.` });
          return;
        }
      }
    } catch (availErr: any) {
      // Fail closed — if availability cannot be verified, do not charge the athlete.
      // They should retry; a transient DB issue is preferable to an out-of-schedule booking.
      logger.error({ err: availErr.message, coachId }, "Availability check failed — rejecting booking");
      res.status(503).json({ error: "Coach availability could not be verified. Please try again shortly." });
      return;
    }
  }

  // ── Server-side price lookup (never trust client-supplied price) ─────────
  // getSessionPriceForCoach handles both static (c1–c8) and API coaches (api_N).
  const price = await getSessionPriceForCoach(coachId, sessionLengthNum as 30 | 60);
  if (price === null) {
    res.status(400).json({ error: `Unknown coach: ${coachId}` });
    return;
  }
  const amountCents = price * 100;

  // Parse expiry MM/YY
  const [expMonth, expYearShort] = cardExpiry.split("/");
  const expYear = expYearShort?.length === 2 ? `20${expYearShort}` : expYearShort;
  if (!expMonth || !expYear || isNaN(Number(expMonth)) || isNaN(Number(expYear))) {
    res.status(400).json({ error: "Invalid card expiry format. Expected MM/YY." });
    return;
  }

  // ── Stripe client — in the controlled 503 path ───────────────────────────
  let stripe: Stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch (err: any) {
    logger.error({ err: err.message }, "Stripe client unavailable");
    res.status(503).json({ error: "Payment system is not configured. Please contact support." });
    return;
  }

  // Note: live-mode raw-card protection is enforced at the middleware layer in
  // app.ts (before express.json()), so PAN/CVC never reaches the server in
  // production. No in-route mode check is needed here.

  // ── Stripe payment (idempotency key prevents duplicate charges on retry) ──
  let paymentIntentId: string;

  try {
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
          name: cardName ?? athleteName ?? "Athlete",
          email: athleteEmail ?? undefined,
        },
      },
      { idempotencyKey: `pm-${idempotencyKey}` }
    );

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        payment_method: paymentMethod.id,
        confirm: true,
        return_url: `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}/`,
        description: `Foster Performance: ${sessionLengthNum}-min session with ${coachName ?? coachId}`,
        metadata: {
          coachId,
          sessionLength: String(sessionLengthNum),
          date,
          time,
          athleteEmail: athleteEmail ?? "",
          idempotencyKey,
        },
      },
      { idempotencyKey: `pi-${idempotencyKey}` }
    );

    // Only `succeeded` = funds captured. All other statuses are not a confirmed charge.
    if (paymentIntent.status !== "succeeded") {
      const piStatus = paymentIntent.status;
      const piId = paymentIntent.id;

      if (piStatus === "processing") {
        // `processing` means Stripe has accepted the payment but it hasn't
        // settled yet (e.g. bank methods). It may still succeed asynchronously.
        // Attempt to cancel so the client can retry safely with a fresh key.
        try {
          await stripe.paymentIntents.cancel(piId);
          // Cancellation succeeded — the intent is terminal and won't charge.
          logger.info({ piId }, "Cancelled processing PaymentIntent — safe to retry");
          res.status(402).json({
            error: "Your payment could not be confirmed and has been cancelled. Please try again.",
            stripeStatus: piStatus,
            retryable: true,
          });
        } catch {
          // Cannot cancel — the intent may still complete and charge the card.
          // Do NOT let the client retry with a new key (would create a second charge).
          logger.error({ piId }, "PaymentIntent is processing and cannot be cancelled — awaiting webhook settlement");
          res.status(402).json({
            error:
              "Your payment is being processed. Please do not retry — " +
              "you will receive confirmation once it settles.",
            stripeStatus: piStatus,
            retryable: false,
          });
        }
        return;
      }

      // Terminal non-processing failures — safe to retry with a new key.
      const statusMessages: Record<string, string> = {
        requires_capture: "Payment authorized but not captured. Please contact support.",
        requires_action:
          "Your card requires additional authentication. Please use a different card or contact support.",
        requires_payment_method: "Your card was declined. Please try a different card.",
      };
      res.status(402).json({
        error: statusMessages[piStatus] ?? "Payment was not successful. Please try again.",
        stripeStatus: piStatus,
        retryable: true,
      });
      return;
    }

    paymentIntentId = paymentIntent.id;
  } catch (err: any) {
    logger.error({ err: err.message, code: err.code }, "Stripe payment failed");
    const userMessage =
      err.type === "StripeCardError"
        ? (err.message as string)
        : "Payment failed. Please check your card details and try again.";
    res.status(402).json({ error: userMessage, stripeCode: err.code });
    return;
  }

  // ── All post-charge DB operations in one compensating block ─────────────
  // Any DB failure here triggers a refund so the athlete is never charged
  // for an unrecorded session.
  let bookingId: string;
  let isIdempotentReturn = false;
  // Hoisted outside try so it's accessible when building the response.
  const newId = randomUUID();
  // Generate a cryptographically-random cancellation token (two UUIDs = 256 bits).
  // Returned once in the booking response; required to call POST /cancel.
  // This binds cancellation authority to the entity that received the original confirmation.
  const newCancellationToken = randomUUID() + "-" + randomUUID();

  try {
    // Use ON CONFLICT DO NOTHING + fetch to handle concurrent retries atomically.
    // The unique constraint on stripe_payment_intent_id ensures at-most-one row.

    await db
      .insert(bookingsTable)
      .values({
        id: newId,
        coachId,
        coachName: coachName ?? coachId,
        coachInitials: coachInitials ?? "",
        coachColor: coachColor ?? "#2F80FF",
        sessionLength: sessionLengthNum,
        price,
        date,
        time,
        status: "upcoming",
        athleteEmail: athleteEmail ?? null,
        athleteName: athleteName ?? null,
        stripePaymentIntentId: paymentIntentId,
        stripePaymentStatus: "succeeded",
        videoRoomUrl: null,
        cancellationToken: newCancellationToken,
      })
      .onConflictDoNothing();

    // Fetch the canonical row — either the one we just inserted, or the
    // pre-existing row that caused the conflict.
    const rows = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.stripePaymentIntentId, paymentIntentId))
      .limit(1);

    if (rows.length === 0) {
      // Should not happen: insert did nothing but row doesn't exist.
      throw new Error("Booking row missing after insert — constraint violation without existing row.");
    }

    bookingId = rows[0].id;
    isIdempotentReturn = bookingId !== newId;

    if (isIdempotentReturn) {
      logger.info({ bookingId, paymentIntentId }, "Returning existing booking (idempotent retry)");
    }
  } catch (dbErr: any) {
    // Refund the charge; the athlete must not be billed for an unrecorded session.
    logger.error(
      { err: dbErr.message, paymentIntentId },
      "DB operation failed after charge — issuing refund"
    );
    const refunded = await issueRefund(stripe, paymentIntentId, { coachId, date });
    res.status(500).json({
      error: refunded
        ? "Your booking could not be saved. Your payment has been refunded. Please try again."
        : "Your booking could not be saved and we were unable to issue an automatic refund. " +
          "Please contact support immediately with this reference: " + paymentIntentId,
      paymentIntentId,
    });
    return;
  }

  // ── Send confirmation email (only on first booking, not idempotent retries) ─
  let emailSent = false;
  if (!isIdempotentReturn && athleteEmail) {
    emailSent = await sendConfirmationEmail({
      to: athleteEmail,
      athleteName: athleteName ?? "Athlete",
      coachName: coachName ?? coachId,
      date,
      time,
      sessionLength: sessionLengthNum,
      price,
      bookingId,
    });
  }

  // Return the cancellationToken so the client can store it and use it later.
  // For idempotent retries, fetch the token from the existing row.
  const cancellationToken = isIdempotentReturn
    ? (await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1))[0]
        ?.cancellationToken ?? null
    : newCancellationToken;

  res.status(isIdempotentReturn ? 200 : 201).json({
    success: true,
    bookingId,
    paymentIntentId,
    paymentStatus: "succeeded",
    emailSent,
    cancellationToken,
  });
});

/**
 * POST /api/bookings/:id/cancel
 *
 * Cancel a booking and issue a Stripe refund:
 *  - Full refund if the session starts more than 24 hours from now (UTC).
 *  - 50% partial refund if the session starts within the next 24 hours.
 *  - Bookings without a stripePaymentIntentId (demo/offline) cancel with no refund step.
 *
 * Authorization: the caller must present the booking's `cancellationToken`, a
 * high-entropy random value generated at booking creation and stored in the DB.
 * The token is returned once in the POST /bookings response and must be retained
 * by the client. This binds cancellation authority to the entity that originally
 * received the booking confirmation without requiring a full session-auth layer.
 *
 * Refund-first semantics: the DB record is only updated to "cancelled" AFTER a
 * successful Stripe refund (or when no payment was made). If the refund fails the
 * booking remains "upcoming" and the athlete can retry.
 */
router.post("/bookings/:id/cancel", async (req, res) => {
  const { id } = req.params;
  const { cancellationToken } = req.body as { cancellationToken?: string };

  // Token is required — missing or blank token is an unconditional rejection.
  if (!cancellationToken || typeof cancellationToken !== "string" || !cancellationToken.trim()) {
    res.status(401).json({ error: "cancellationToken is required." });
    return;
  }

  // ── Fetch the booking ────────────────────────────────────────────────────────
  let rows: (typeof bookingsTable.$inferSelect)[] | null;
  try {
    rows = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .limit(1);
  } catch (err: any) {
    logger.error({ err: err.message, bookingId: id }, "DB error fetching booking for cancellation");
    res.status(500).json({ error: "Failed to look up booking. Please try again." });
    return;
  }

  if (rows.length === 0) {
    // Return 401 rather than 404 so callers cannot probe which booking IDs exist.
    res.status(401).json({ error: "Invalid booking ID or cancellation token." });
    return;
  }

  const booking = rows[0];

  // ── Token verification ────────────────────────────────────────────────────────
  // Use a timing-safe comparison to avoid timing oracle attacks.
  // If the stored token is null (legacy row created before this feature), reject.
  const storedToken = booking.cancellationToken ?? "";
  if (!storedToken || storedToken.length !== cancellationToken.trim().length) {
    res.status(401).json({ error: "Invalid booking ID or cancellation token." });
    return;
  }
  // Timing-safe byte-by-byte comparison.
  let tokenMismatch = 0;
  const supplied = cancellationToken.trim();
  for (let i = 0; i < storedToken.length; i++) {
    tokenMismatch |= storedToken.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  if (tokenMismatch !== 0) {
    res.status(401).json({ error: "Invalid booking ID or cancellation token." });
    return;
  }

  if (booking.status === "cancelled") {
    res.status(409).json({ error: "Booking is already cancelled.", alreadyCancelled: true });
    return;
  }

  // ── Determine refund amount ───────────────────────────────────────────────────
  // Parse session date ("YYYY-MM-DD") and time ("H:MM AM/PM") as UTC components
  // so the cutoff does not shift with the server's local timezone.
  // The booking stores no timezone; UTC is used as the canonical reference.
  let refundAmountCents: number | null = null; // null → full refund (Stripe default)
  let isPartialRefund = false;

  if (booking.stripePaymentIntentId) {
    const [yearStr, monthStr, dayStr] = booking.date.split("-");
    const [timePart, meridiem] = booking.time.split(" ");
    const [hoursRaw, minsRaw] = timePart.split(":").map(Number);
    const hours24 =
      meridiem?.toUpperCase() === "PM" && hoursRaw !== 12
        ? hoursRaw + 12
        : meridiem?.toUpperCase() === "AM" && hoursRaw === 12
        ? 0
        : hoursRaw;

    // Date.UTC avoids any server local-timezone offset.
    const sessionMs = Date.UTC(
      Number(yearStr),
      Number(monthStr) - 1, // months are 0-indexed in Date.UTC
      Number(dayStr),
      hours24,
      minsRaw ?? 0,
      0
    );
    const msUntilSession = sessionMs - Date.now();

    if (msUntilSession < FREE_CANCEL_MS) {
      // Within the 24-hour window — 50% partial refund.
      isPartialRefund = true;
      refundAmountCents = Math.floor(booking.price * 100 * PARTIAL_REFUND_PCT);
    }
  }

  // ── Issue Stripe refund BEFORE updating DB ────────────────────────────────────
  // Refund-first: we only transition the booking to "cancelled" after the refund
  // succeeds. If the refund fails the booking stays "upcoming" so the athlete can
  // retry later, and we return an error so the client knows not to cancel locally.
  let refundPartial = false;

  if (booking.stripePaymentIntentId) {
    let stripe: Stripe;
    try {
      stripe = await getUncachableStripeClient();
    } catch (err: any) {
      logger.error({ err: err.message }, "Stripe client unavailable — cancellation blocked");
      res.status(503).json({
        error:
          "Payment system is currently unavailable. Your session has not been cancelled. " +
          "Please try again in a few minutes.",
      });
      return;
    }

    const refunded = await issueRefund(
      stripe,
      booking.stripePaymentIntentId,
      { bookingId: id, partial: String(isPartialRefund) },
      refundAmountCents !== null ? refundAmountCents : undefined
    );

    if (!refunded) {
      // Refund failed — do not cancel, let the athlete retry or contact support.
      res.status(502).json({
        error:
          "We could not process your refund at this time. " +
          "Your session has not been cancelled. Please try again or contact support.",
        bookingId: id,
      });
      return;
    }

    refundPartial = isPartialRefund;
  }
  // Bookings without a stripePaymentIntentId (demo/offline) proceed to cancellation
  // with no refund step.

  // ── Update DB status to "cancelled" — only reached after a successful refund ──
  try {
    await db
      .update(bookingsTable)
      .set({ status: "cancelled" })
      .where(eq(bookingsTable.id, id));
  } catch (dbErr: any) {
    logger.error({ err: dbErr.message, bookingId: id }, "DB error updating booking to cancelled after refund");
    // Refund already issued — record is inconsistent; flag for manual reconciliation.
    res.status(500).json({
      error:
        "Your refund has been issued, but we could not update your booking record. " +
        "Please contact support with booking ID: " + id,
      refunded: true,
      refundPartial,
    });
    return;
  }

  res.status(200).json({
    success: true,
    bookingId: id,
    refunded: true,
    refundPartial,
    refundAmountCents: refundAmountCents ?? booking.price * 100,
  });
});

export default router;
