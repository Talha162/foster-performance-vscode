/**
 * Public coaches API — returns approved coach profiles from the
 * coach_applications table.  No auth required (public marketplace).
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const FULL_DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function tryParse(str: string | null | undefined, fallback: any): any {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Normalise weekly_availability to a consistent shape:
 *   { days: { Monday: bool, … }, activeTimes: { "9:00 AM": bool, … }, sessionDurationMins: number }
 *
 * Handles two legacy formats written by the coach-application form and the old
 * flat-map calendar save:
 *   - New nested  : { days: {…}, activeTimes: {…}, sessionDurationMins: N }
 *   - Legacy flat : { Monday: true, Wednesday: true, … }   (no activeTimes)
 *   - Array list  : ["Monday", "Wednesday", …]              (some older app versions)
 */
function normalizeAvailability(raw: any): {
  days: Record<string, boolean>;
  activeTimes: Record<string, boolean>;
  sessionDurationMins: number;
} {
  if (!raw || typeof raw !== "object") {
    return { days: {}, activeTimes: {}, sessionDurationMins: 60 };
  }
  // New nested shape
  if (raw.days && typeof raw.days === "object") {
    return {
      days: raw.days as Record<string, boolean>,
      activeTimes: (raw.activeTimes as Record<string, boolean>) ?? {},
      sessionDurationMins: (raw.sessionDurationMins as number) ?? 60,
    };
  }
  // Legacy flat day-map: { Monday: true, … }
  const isLegacyFlat = FULL_DAY_NAMES.some((d) => d in raw);
  if (isLegacyFlat) {
    return { days: raw as Record<string, boolean>, activeTimes: {}, sessionDurationMins: 60 };
  }
  // Array list: ["Monday", "Wednesday"]
  if (Array.isArray(raw)) {
    const days: Record<string, boolean> = {};
    for (const d of raw as string[]) { if (FULL_DAY_NAMES.includes(d)) days[d] = true; }
    return { days, activeTimes: {}, sessionDurationMins: 60 };
  }
  return { days: {}, activeTimes: {}, sessionDurationMins: 60 };
}

function formatCoach(row: any) {
  return {
    id: `api_${row.id}`,
    applicationId: Number(row.id),
    userId: String(row.user_id),
    name: row.full_name || row.user_name || "Coach",
    email: row.user_email,
    title: row.professional_title ?? "",
    bio: row.biography ?? "",
    experienceYears: Number(row.experience_years) || 0,
    certifications: row.certifications ?? "",
    specialties: tryParse(row.specialties, []) as string[],
    services: tryParse(row.services, []) as string[],
    sessionLengths: tryParse(row.session_lengths, [30, 60]) as number[],
    prices: tryParse(row.prices, { session30: null, session60: null }),
    weeklyAvailability: normalizeAvailability(tryParse(row.weekly_availability, {})),
    virtualSessions: Boolean(row.virtual_sessions),
    inPersonSessions: Boolean(row.in_person_sessions),
    serviceLocation: row.service_location ?? "",
    professionalLinks: tryParse(row.professional_links, {}),
    profilePhotoUrl: row.profile_photo_url ?? null,
    subscriberStatus: row.subscription_status ?? null,
    reviewedAt: row.reviewed_at ?? null,
  };
}

// ── GET /coaches ───────────────────────────────────────────────────────────────

router.get("/coaches", async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    res.json({ coaches: [] });
    return;
  }
  try {
    const result = await db.execute(sql`
      SELECT
        ca.id,
        ca.user_id,
        ca.full_name,
        ca.professional_title,
        ca.biography,
        ca.experience_years,
        ca.certifications,
        ca.specialties,
        ca.services,
        ca.session_lengths,
        ca.prices,
        ca.weekly_availability,
        ca.virtual_sessions,
        ca.in_person_sessions,
        ca.service_location,
        ca.professional_links,
        ca.profile_photo_url,
        ca.reviewed_at,
        u.name  AS user_name,
        u.email AS user_email,
        u.subscription_status
      FROM coach_applications ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.status = 'Approved'
        AND u.is_suspended = FALSE
      ORDER BY ca.reviewed_at DESC
    `);
    const coaches = (result.rows as any[]).map(formatCoach);
    res.json({ coaches });
  } catch (err: any) {
    logger.error({ err: err.message }, "GET /coaches failed");
    res.status(500).json({ error: "Could not load coaches" });
  }
});

// ── GET /coaches/:id ───────────────────────────────────────────────────────────

router.get("/coaches/:id", async (req, res) => {
  const { id } = req.params;
  // Client may send "api_123" or raw "123"
  const numericId = id.replace("api_", "").replace(/\D/g, "");
  if (!numericId) {
    res.status(404).json({ error: "Coach not found" });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.status(404).json({ error: "Coach not found" });
    return;
  }

  try {
    const result = await db.execute(sql`
      SELECT
        ca.*,
        u.name  AS user_name,
        u.email AS user_email,
        u.subscription_status
      FROM coach_applications ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.id = ${Number(numericId)}
        AND ca.status = 'Approved'
        AND u.is_suspended = FALSE
      LIMIT 1
    `);
    if ((result.rows as any[]).length === 0) {
      res.status(404).json({ error: "Coach not found" });
      return;
    }
    res.json({ coach: formatCoach(result.rows[0] as any) });
  } catch (err: any) {
    logger.error({ err: err.message, id }, "GET /coaches/:id failed");
    res.status(500).json({ error: "Could not load coach" });
  }
});

export default router;
