/**
 * Owner Admin routes — all protected by requireAdmin middleware.
 * The owner_admin role is assigned ONLY via the OWNER_ADMIN_EMAIL env var.
 * There is no public endpoint that grants admin access.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import { AuthRequest } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

// All routes require owner_admin
router.use(requireAdmin as any);

// ─── Applications ─────────────────────────────────────────────────────────────

router.get("/admin/applications", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT ca.*, u.name AS user_name, u.email AS user_email
      FROM coach_applications ca
      JOIN users u ON u.id = ca.user_id
      ORDER BY ca.created_at DESC
    `);
    res.json({
      applications: (result.rows as any[]).map(formatApplicationAdmin),
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin list applications error");
    res.status(500).json({ error: "Failed to load applications" });
  }
});

router.get("/admin/applications/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute(sql`
      SELECT ca.*, u.name AS user_name, u.email AS user_email
      FROM coach_applications ca
      JOIN users u ON u.id = ca.user_id
      WHERE ca.id = ${parseInt(id, 10)}
    `);
    const app = result.rows[0] as any;
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    res.json({ application: formatApplicationAdmin(app) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin get application error");
    res.status(500).json({ error: "Failed to load application" });
  }
});

/**
 * PATCH /admin/applications/:id
 * Update application status. When status is "Approved", the applicant's
 * account_type is promoted from coach_applicant → coach.
 * When "Rejected" or "Suspended", role reverts to member.
 */
router.patch("/admin/applications/:id", async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body as any;

  const validStatuses = [
    "Incomplete",
    "Submitted",
    "Pending Review",
    "More Information Required",
    "Approved",
    "Rejected",
    "Suspended",
  ];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }

  try {
    const appResult = await db.execute(
      sql`SELECT * FROM coach_applications WHERE id = ${parseInt(id, 10)}`
    );
    const app = appResult.rows[0] as any;
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    // Update application
    const updated = await db.execute(sql`
      UPDATE coach_applications SET
        status        = ${status},
        admin_notes   = COALESCE(${adminNotes ?? null}, admin_notes),
        reviewed_at   = NOW(),
        updated_at    = NOW()
      WHERE id = ${parseInt(id, 10)}
      RETURNING *
    `);

    // Sync user role
    let newRole: string | null = null;
    if (status === "Approved") {
      newRole = "coach";
    } else if (status === "Rejected" || status === "Suspended") {
      newRole = "member";
    } else if (status === "Pending Review" || status === "More Information Required") {
      newRole = "coach_applicant";
    }

    if (newRole !== null) {
      await db.execute(sql`
        UPDATE users SET account_type = ${newRole}, updated_at = NOW()
        WHERE id = ${app.user_id}
      `);
    }

    res.json({ application: formatApplicationAdmin(updated.rows[0] as any) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin update application error");
    res.status(500).json({ error: "Failed to update application" });
  }
});

// ─── Users / Members ─────────────────────────────────────────────────────────

router.get("/admin/users", async (req, res) => {
  const { role } = req.query as any;
  try {
    const result = await db.execute(
      role
        ? sql`SELECT id, email, name, account_type, onboarding_complete, is_suspended, subscription_status, subscription_plan, subscription_end_date, created_at FROM users WHERE account_type = ${role} ORDER BY created_at DESC`
        : sql`SELECT id, email, name, account_type, onboarding_complete, is_suspended, subscription_status, subscription_plan, subscription_end_date, created_at FROM users ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin list users error");
    res.status(500).json({ error: "Failed to load users" });
  }
});

/**
 * PATCH /admin/users/:id/suspend
 * Suspend or unsuspend any user account (not owner_admin).
 * Suspended users are hidden from the marketplace and lose access to premium features.
 * Data is preserved — this is reversible.
 */
router.patch("/admin/users/:id/suspend", async (req, res) => {
  const { id } = req.params;
  const { suspend } = req.body as { suspend: boolean };
  try {
    const result = await db.execute(sql`
      UPDATE users
      SET is_suspended = ${Boolean(suspend)}, updated_at = NOW()
      WHERE id = ${parseInt(id, 10)} AND account_type != 'owner_admin'
      RETURNING id, email, name, account_type, is_suspended
    `);
    if (!(result.rows as any[]).length) {
      res.status(404).json({ error: "User not found or cannot be modified" });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin suspend user error");
    res.status(500).json({ error: "Failed to update suspension status" });
  }
});

/**
 * PATCH /admin/users/:id/role
 * Manually change a user's role. Can only set: member, coach_applicant, coach.
 * owner_admin is NEVER assignable through this endpoint.
 */
router.patch("/admin/users/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body as any;

  const allowedRoles = ["member", "coach_applicant", "coach"];
  if (!allowedRoles.includes(role)) {
    res
      .status(400)
      .json({
        error:
          "Invalid role. Allowed: member, coach_applicant, coach. owner_admin cannot be assigned via API.",
      });
    return;
  }

  try {
    const result = await db.execute(sql`
      UPDATE users SET account_type = ${role}, updated_at = NOW()
      WHERE id = ${parseInt(id, 10)}
      RETURNING id, email, name, account_type
    `);
    if ((result.rows as any[]).length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin update user role error");
    res.status(500).json({ error: "Failed to update role" });
  }
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/admin/stats", async (_req, res) => {
  try {
    const [members, coaches, applicants, bookingCount, revenue] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM users WHERE account_type = 'member'`),
      db.execute(sql`SELECT COUNT(*) as count FROM users WHERE account_type = 'coach'`),
      db.execute(sql`SELECT COUNT(*) as count FROM users WHERE account_type = 'coach_applicant'`),
      db.execute(sql`SELECT COUNT(*) as count FROM bookings`),
      db.execute(sql`SELECT COALESCE(SUM(price), 0) AS gross FROM bookings WHERE stripe_payment_status = 'succeeded'`),
    ]);
    res.json({
      members: parseInt((members.rows[0] as any).count),
      coaches: parseInt((coaches.rows[0] as any).count),
      applicants: parseInt((applicants.rows[0] as any).count),
      bookings: parseInt((bookingCount.rows[0] as any).count),
      grossRevenue: parseFloat((revenue.rows[0] as any).gross ?? "0"),
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin stats error");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ─── Bookings (admin view) ────────────────────────────────────────────────────

router.get("/admin/bookings", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100
    `);
    res.json({ bookings: result.rows });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin bookings error");
    res.status(500).json({ error: "Failed to load bookings" });
  }
});

// ─── Platform Settings ────────────────────────────────────────────────────────

router.get("/admin/settings", async (_req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT * FROM platform_settings ORDER BY key ASC`
    );
    res.json({ settings: result.rows });
  } catch {
    res.json({ settings: [] });
  }
});

router.patch("/admin/settings", async (req, res) => {
  const { key, value } = req.body as any;
  if (!key) {
    res.status(400).json({ error: "key is required" });
    return;
  }
  try {
    await db.execute(sql`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "Admin settings error");
    res.status(500).json({ error: "Failed to save setting" });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatApplicationAdmin(app: any) {
  return {
    id: String(app.id),
    userId: String(app.user_id),
    userName: app.user_name,
    userEmail: app.user_email,
    fullName: app.full_name,
    phone: app.phone,
    professionalTitle: app.professional_title,
    biography: app.biography,
    experienceYears: app.experience_years,
    certifications: app.certifications,
    specialties: app.specialties ? tryParse(app.specialties) : [],
    services: app.services ? tryParse(app.services) : [],
    sessionLengths: app.session_lengths ? tryParse(app.session_lengths) : [],
    prices: app.prices ? tryParse(app.prices) : {},
    weeklyAvailability: app.weekly_availability ? tryParse(app.weekly_availability) : {},
    virtualSessions: Boolean(app.virtual_sessions),
    inPersonSessions: Boolean(app.in_person_sessions),
    serviceLocation: app.service_location,
    professionalLinks: app.professional_links ? tryParse(app.professional_links) : {},
    profilePhotoUrl: app.profile_photo_url,
    agreedToTerms: Boolean(app.agreed_to_terms),
    status: app.status,
    adminNotes: app.admin_notes,
    submittedAt: app.submitted_at,
    reviewedAt: app.reviewed_at,
    createdAt: app.created_at,
  };
}

function tryParse(v: any) {
  try { return JSON.parse(v); } catch { return v; }
}

export default router;
