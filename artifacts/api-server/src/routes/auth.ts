import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  getEffectiveRole,
  validatePasswordStrength,
} from "../lib/auth";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Email helper ─────────────────────────────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping email");
    return false;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Foster Performance <noreply@fosterperformance.app>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      logger.warn({ status: resp.status, body }, "Resend API error");
    }
    return resp.ok;
  } catch (err: any) {
    logger.warn({ err: err.message }, "Email send failed");
    return false;
  }
}

// ─── IP rate limiting for login ───────────────────────────────────────────────

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false; // not limited
  }
  entry.count += 1;
  return entry.count > 20; // block after 20 IP-level attempts
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUser(user: any, applicationStatus?: string | null) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    accountType: user.account_type,
    onboardingComplete: Boolean(user.onboarding_complete),
    goal: user.goal ?? undefined,
    level: user.level ?? undefined,
    applicationStatus: applicationStatus ?? undefined,
    emailVerified: Boolean(user.email_verified),
    isPremium: Boolean(user.is_premium),
    subscriptionStatus: user.subscription_status ?? null,
    subscriptionPlan: user.subscription_plan ?? undefined,
    subscriptionEndDate: user.subscription_end_date ?? undefined,
    stripeCustomerId: user.stripe_customer_id ?? undefined,
    stripeSubscriptionId: user.stripe_subscription_id ?? undefined,
    streakDays: Number(user.streak_days) || 0,
    totalWorkouts: Number(user.total_workouts) || 0,
    joinDate: user.created_at,
  };
}

async function getApplicationStatus(userId: number): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT status FROM coach_applications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 1
    `);
    return (result.rows[0] as any)?.status ?? null;
  } catch {
    return null;
  }
}

function isAllowedRole(role: string): boolean {
  return ["member", "coach_applicant"].includes(role);
}

async function sendVerificationEmail(userId: number, email: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await db.execute(sql`
    UPDATE users SET
      email_verification_token = ${token},
      email_verification_expires = ${expires.toISOString()},
      updated_at = NOW()
    WHERE id = ${userId}
  `);
  await sendEmail(
    email,
    "Verify your Foster Performance email",
    `<p>Hi there,</p>
     <p>Please verify your email address by entering this code in the app:</p>
     <h2 style="letter-spacing:4px;">${token.slice(0, 6).toUpperCase()}</h2>
     <p>This code expires in 24 hours. If you didn't create an account, ignore this email.</p>
     <p>— Foster Performance</p>`
  );
}

// ─── POST /auth/register ─────────────────────────────────────────────────────

router.post("/auth/register", async (req, res) => {
  const { name, email, password, accountType = "member" } = req.body as any;

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    res.status(400).json({ error: strengthError });
    return;
  }

  const safeRole = isAllowedRole(accountType) ? accountType : "member";
  const emailLower = (email as string).toLowerCase().trim();

  try {
    const existing = await db.execute(
      sql`SELECT id FROM users WHERE email = ${emailLower}`
    );
    if ((existing.rows as any[]).length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const effectiveRole = getEffectiveRole(emailLower, safeRole);

    const result = await db.execute(sql`
      INSERT INTO users (email, name, password_hash, account_type)
      VALUES (${emailLower}, ${name.trim()}, ${passwordHash}, ${effectiveRole})
      RETURNING *
    `);
    const user = result.rows[0] as any;

    // Send verification email (non-blocking)
    sendVerificationEmail(user.id, user.email).catch(() => {});

    let appStatus: string | null = null;
    if (user.account_type === "coach_applicant") {
      appStatus = await getApplicationStatus(user.id);
    }

    const token = signToken({
      userId: user.id,
      accountType: user.account_type,
      email: user.email,
      tokenVersion: 0,
    });

    res.status(201).json({ token, user: formatUser(user, appStatus) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Register error");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// ─── POST /auth/login ────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";

  if (checkLoginRateLimit(clientIp)) {
    res.status(429).json({ error: "Too many sign-in attempts. Please wait 15 minutes." });
    return;
  }

  const { email, password } = req.body as any;
  if (!email?.trim() || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const emailLower = (email as string).toLowerCase().trim();

  try {
    const result = await db.execute(
      sql`SELECT * FROM users WHERE email = ${emailLower}`
    );
    const user = result.rows[0] as any;

    // Account lockout check
    if (user?.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.locked_until).getTime() - Date.now()) / 60000
      );
      res.status(423).json({
        error: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
      });
      return;
    }

    if (!user) {
      res.status(401).json({ error: "Unable to sign in. Check your information and try again." });
      return;
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      // Track failed attempts; lock after 5
      const attempts = (user.failed_login_attempts ?? 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await db.execute(sql`
        UPDATE users SET
          failed_login_attempts = ${attempts},
          locked_until = ${lockUntil?.toISOString() ?? null},
          updated_at = NOW()
        WHERE id = ${user.id}
      `);
      if (lockUntil) {
        res.status(423).json({ error: "Too many failed attempts. Account locked for 15 minutes." });
      } else {
        res.status(401).json({ error: "Unable to sign in. Check your information and try again." });
      }
      return;
    }

    // Successful login — reset failed attempts
    const effectiveRole = getEffectiveRole(emailLower, user.account_type);
    await db.execute(sql`
      UPDATE users SET
        failed_login_attempts = 0,
        locked_until = NULL,
        account_type = ${effectiveRole},
        updated_at = NOW()
      WHERE id = ${user.id}
    `);
    user.account_type = effectiveRole;

    let appStatus: string | null = null;
    if (user.account_type === "coach_applicant") {
      appStatus = await getApplicationStatus(user.id);
    }

    const token = signToken({
      userId: user.id,
      accountType: user.account_type,
      email: user.email,
      tokenVersion: Number(user.token_version ?? 0),
    });

    res.json({ token, user: formatUser(user, appStatus) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Login error");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ─── GET /auth/me ────────────────────────────────────────────────────────────

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;

  try {
    const result = await db.execute(
      sql`SELECT * FROM users WHERE id = ${userId}`
    );
    const user = result.rows[0] as any;

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const effectiveRole = getEffectiveRole(user.email, user.account_type);
    if (effectiveRole !== user.account_type) {
      await db.execute(sql`
        UPDATE users SET account_type = ${effectiveRole}, updated_at = NOW()
        WHERE id = ${userId}
      `);
      user.account_type = effectiveRole;
    }

    let appStatus: string | null = null;
    if (user.account_type === "coach_applicant") {
      appStatus = await getApplicationStatus(user.id);
    }

    res.json({ user: formatUser(user, appStatus) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Get /me error");
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// ─── PATCH /auth/me ──────────────────────────────────────────────────────────

router.patch("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;
  const {
    name, goal, level, onboardingComplete, isPremium, subscriptionStatus,
    subscriptionPlan, subscriptionEndDate, stripeCustomerId, stripeSubscriptionId,
    streakDays, totalWorkouts,
  } = req.body as any;

  try {
    const result = await db.execute(sql`
      UPDATE users SET
        name                  = COALESCE(${name ?? null}, name),
        goal                  = COALESCE(${goal ?? null}, goal),
        level                 = COALESCE(${level ?? null}, level),
        onboarding_complete   = COALESCE(${onboardingComplete !== undefined ? onboardingComplete : null}::boolean, onboarding_complete),
        is_premium            = COALESCE(${isPremium !== undefined ? isPremium : null}::boolean, is_premium),
        subscription_status   = COALESCE(${subscriptionStatus ?? null}, subscription_status),
        subscription_plan     = COALESCE(${subscriptionPlan ?? null}, subscription_plan),
        subscription_end_date = COALESCE(${subscriptionEndDate ?? null}, subscription_end_date),
        stripe_customer_id    = COALESCE(${stripeCustomerId ?? null}, stripe_customer_id),
        stripe_subscription_id= COALESCE(${stripeSubscriptionId ?? null}, stripe_subscription_id),
        streak_days           = COALESCE(${streakDays !== undefined ? streakDays : null}::integer, streak_days),
        total_workouts        = COALESCE(${totalWorkouts !== undefined ? totalWorkouts : null}::integer, total_workouts),
        updated_at            = NOW()
      WHERE id = ${userId}
      RETURNING *
    `);
    const user = result.rows[0] as any;

    let appStatus: string | null = null;
    if (user.account_type === "coach_applicant") {
      appStatus = await getApplicationStatus(user.id);
    }

    res.json({ user: formatUser(user, appStatus) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Update /me error");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ─── POST /auth/become-coach ─────────────────────────────────────────────────

router.post("/auth/become-coach", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;

  if (accountType !== "member") {
    const msg =
      accountType === "coach_applicant"
        ? "You already have a pending coach application"
        : "Your account is already a coach or admin account";
    res.status(400).json({ error: msg });
    return;
  }

  try {
    await db.execute(sql`
      UPDATE users
      SET account_type = 'coach_applicant', updated_at = NOW()
      WHERE id = ${userId}
    `);

    const rows = await db.execute(sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`);
    const user = rows.rows[0] as any;
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const effectiveRole = getEffectiveRole(user.email, "coach_applicant");
    const newToken = signToken({
      userId: user.id,
      email: user.email,
      accountType: effectiveRole,
      tokenVersion: Number(user.token_version ?? 0),
    });

    logger.info({ userId }, "Member transitioned to coach_applicant");
    res.json({ token: newToken, user: formatUser(user) });
  } catch (err: any) {
    logger.error({ err: err.message, userId }, "become-coach role transition failed");
    res.status(500).json({ error: "Could not update account role" });
  }
});

// ─── POST /auth/forgot-password ──────────────────────────────────────────────
// Sends a 6-character alphanumeric OTP to the account email.
// Always returns a neutral message — never reveals whether an email is registered.

router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as any;
  if (!email?.trim()) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  // Neutral response regardless of outcome
  const neutral = {
    message: "If an account exists for this email, password-reset instructions have been sent.",
  };

  const emailLower = (email as string).toLowerCase().trim();

  try {
    const result = await db.execute(
      sql`SELECT id FROM users WHERE email = ${emailLower} LIMIT 1`
    );
    const user = result.rows[0] as any;
    if (!user) {
      res.json(neutral);
      return;
    }

    // Generate 6-char uppercase alphanumeric OTP
    const otp = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
    const tokenHash = createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalidate previous unused tokens for this user
    await db.execute(sql`
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ${user.id} AND used_at IS NULL
    `);

    await db.execute(sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
    `);

    await sendEmail(
      emailLower,
      "Reset your Foster Performance password",
      `<p>Hi,</p>
       <p>We received a request to reset your password. Enter this code in the app:</p>
       <h2 style="font-size:32px;letter-spacing:6px;font-family:monospace;">${otp}</h2>
       <p><strong>This code expires in 15 minutes and can only be used once.</strong></p>
       <p>If you didn't request a password reset, ignore this email — your account is safe.</p>
       <p>— Foster Performance</p>`
    );

    logger.info({ userId: user.id }, "Password reset OTP sent");
    res.json(neutral);
  } catch (err: any) {
    logger.error({ err: err.message }, "forgot-password error");
    res.json(neutral); // Still neutral on error
  }
});

// ─── POST /auth/reset-password ───────────────────────────────────────────────
// Validates the OTP, enforces password strength, updates password, invalidates sessions.

router.post("/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body as any;

  if (!email?.trim() || !code?.trim() || !newPassword) {
    res.status(400).json({ error: "Email, code, and new password are required" });
    return;
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    res.status(400).json({ error: strengthError });
    return;
  }

  const emailLower = (email as string).toLowerCase().trim();
  const tokenHash = createHash("sha256").update((code as string).trim().toUpperCase()).digest("hex");

  try {
    const userResult = await db.execute(
      sql`SELECT id FROM users WHERE email = ${emailLower} LIMIT 1`
    );
    const user = userResult.rows[0] as any;
    if (!user) {
      res.status(400).json({ error: "This reset code has expired or is invalid. Request a new one." });
      return;
    }

    const tokenResult = await db.execute(sql`
      SELECT id FROM password_reset_tokens
      WHERE user_id = ${user.id}
        AND token_hash = ${tokenHash}
        AND used_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const tokenRow = tokenResult.rows[0] as any;
    if (!tokenRow) {
      res.status(400).json({ error: "This reset code has expired or is invalid. Request a new one." });
      return;
    }

    const newHash = await hashPassword(newPassword);

    // Update password and increment token_version (invalidates all existing sessions)
    await db.execute(sql`
      UPDATE users SET
        password_hash = ${newHash},
        token_version = COALESCE(token_version, 0) + 1,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
      WHERE id = ${user.id}
    `);

    // Mark token as used
    await db.execute(sql`
      UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${tokenRow.id}
    `);

    logger.info({ userId: user.id }, "Password reset successful");
    res.json({ message: "Your password has been updated successfully." });
  } catch (err: any) {
    logger.error({ err: err.message }, "reset-password error");
    res.status(500).json({ error: "Password reset failed. Please try again." });
  }
});

// ─── POST /auth/send-verification ────────────────────────────────────────────

router.post("/auth/send-verification", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;

  try {
    const result = await db.execute(
      sql`SELECT email, email_verified FROM users WHERE id = ${userId} LIMIT 1`
    );
    const user = result.rows[0] as any;
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.email_verified) {
      res.json({ message: "Email is already verified" });
      return;
    }
    await sendVerificationEmail(userId, user.email);
    res.json({ message: "Verification email sent" });
  } catch (err: any) {
    logger.error({ err: err.message }, "send-verification error");
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

// ─── POST /auth/verify-email ─────────────────────────────────────────────────

router.post("/auth/verify-email", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;
  const { code } = req.body as any;

  if (!code?.trim()) {
    res.status(400).json({ error: "Verification code is required" });
    return;
  }

  try {
    const result = await db.execute(sql`
      SELECT email_verification_token, email_verification_expires, email_verified
      FROM users WHERE id = ${userId} LIMIT 1
    `);
    const user = result.rows[0] as any;
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.email_verified) {
      res.json({ message: "Email already verified" });
      return;
    }

    const storedToken = user.email_verification_token as string | null;
    const expires = user.email_verification_expires
      ? new Date(user.email_verification_expires)
      : null;

    const codeUpper = (code as string).trim().toUpperCase();
    const tokenPrefix = storedToken?.slice(0, 6).toUpperCase();

    if (!storedToken || !expires || expires < new Date() || codeUpper !== tokenPrefix) {
      res.status(400).json({
        error: "This verification code has expired or is invalid. Request a new one.",
      });
      return;
    }

    await db.execute(sql`
      UPDATE users SET
        email_verified = TRUE,
        email_verification_token = NULL,
        email_verification_expires = NULL,
        updated_at = NOW()
      WHERE id = ${userId}
    `);

    res.json({ message: "Email verified successfully" });
  } catch (err: any) {
    logger.error({ err: err.message }, "verify-email error");
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// ─── POST /auth/logout-all ────────────────────────────────────────────────────
// Invalidates all existing sessions for this user by incrementing token_version.

router.post("/auth/logout-all", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;

  try {
    const result = await db.execute(sql`
      UPDATE users SET
        token_version = COALESCE(token_version, 0) + 1,
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING token_version
    `);
    const newVersion = Number((result.rows[0] as any)?.token_version ?? 1);

    // Fetch fresh user for new token
    const userResult = await db.execute(sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`);
    const user = userResult.rows[0] as any;

    const token = signToken({
      userId: user.id,
      accountType: user.account_type,
      email: user.email,
      tokenVersion: newVersion,
    });

    logger.info({ userId }, "User signed out of all devices");
    res.json({ token, message: "Signed out of all other devices" });
  } catch (err: any) {
    logger.error({ err: err.message }, "logout-all error");
    res.status(500).json({ error: "Failed to sign out of all devices" });
  }
});

// ─── POST /auth/change-password ──────────────────────────────────────────────
// Requires current password. Issues a fresh token after success.

router.post("/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;
  const { currentPassword, newPassword } = req.body as any;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required" });
    return;
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    res.status(400).json({ error: strengthError });
    return;
  }

  try {
    const result = await db.execute(
      sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`
    );
    const user = result.rows[0] as any;
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const valid = await comparePassword(currentPassword, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const newHash = await hashPassword(newPassword);
    const updResult = await db.execute(sql`
      UPDATE users SET
        password_hash = ${newHash},
        token_version = COALESCE(token_version, 0) + 1,
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING token_version, account_type, email
    `);
    const updated = updResult.rows[0] as any;

    const token = signToken({
      userId,
      accountType: updated.account_type,
      email: updated.email,
      tokenVersion: Number(updated.token_version),
    });

    logger.info({ userId }, "Password changed");
    res.json({ token, message: "Password updated successfully" });
  } catch (err: any) {
    logger.error({ err: err.message }, "change-password error");
    res.status(500).json({ error: "Failed to change password. Please try again." });
  }
});

// ─── POST /auth/change-email ──────────────────────────────────────────────────
// Requires current password. Sends verification to new email.

router.post("/auth/change-email", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;
  const { currentPassword, newEmail } = req.body as any;

  if (!currentPassword || !newEmail?.trim()) {
    res.status(400).json({ error: "Current password and new email are required" });
    return;
  }

  const newEmailLower = (newEmail as string).toLowerCase().trim();

  try {
    const result = await db.execute(
      sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`
    );
    const user = result.rows[0] as any;
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const valid = await comparePassword(currentPassword, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const emailConflict = await db.execute(
      sql`SELECT id FROM users WHERE email = ${newEmailLower} AND id != ${userId} LIMIT 1`
    );
    if ((emailConflict.rows as any[]).length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    await db.execute(sql`
      UPDATE users SET
        email = ${newEmailLower},
        email_verified = FALSE,
        updated_at = NOW()
      WHERE id = ${userId}
    `);

    // Send verification to new email
    await sendVerificationEmail(userId, newEmailLower);

    logger.info({ userId }, "Email changed");
    res.json({ message: "Email updated. Please verify your new email address." });
  } catch (err: any) {
    logger.error({ err: err.message }, "change-email error");
    res.status(500).json({ error: "Failed to change email. Please try again." });
  }
});

export default router;
