/**
 * Coach Availability API
 *
 * Allows coaches to read and update their weekly availability,
 * stored as a JSON object in coach_applications.weekly_availability.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth, type AuthRequest } from "../middleware/requireAuth";

const router: IRouter = Router();

// ── GET /coaches/me/availability ──────────────────────────────────────────────
router.get("/coaches/me/availability", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;
  if (accountType !== "coach" && accountType !== "owner_admin") {
    res.status(403).json({ error: "Coach account required" });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.json({ availability: null });
    return;
  }

  try {
    const result = await db.execute(sql`
      SELECT weekly_availability FROM coach_applications WHERE user_id = ${userId} LIMIT 1
    `);
    const row = result.rows[0] as Record<string, any> | undefined;
    const rawStr = row?.weekly_availability;
    if (!rawStr) { res.json({ availability: null }); return; }
    try {
      const parsed = JSON.parse(rawStr);
      // Normalise to { days, activeTimes, sessionDurationMins } for the calendar
      const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
      let normalised: Record<string, any>;
      if (parsed && typeof parsed === "object" && parsed.days) {
        normalised = {
          days: parsed.days,
          activeTimes: parsed.activeTimes ?? {},
          sessionDurationMins: parsed.sessionDurationMins ?? 60,
        };
      } else if (Array.isArray(parsed)) {
        const days: Record<string, boolean> = {};
        for (const d of parsed as string[]) { if (DAYS.includes(d)) days[d] = true; }
        normalised = { days, activeTimes: {}, sessionDurationMins: 60 };
      } else if (parsed && typeof parsed === "object" && DAYS.some((d) => d in parsed)) {
        normalised = { days: parsed, activeTimes: {}, sessionDurationMins: 60 };
      } else {
        normalised = { days: {}, activeTimes: {}, sessionDurationMins: 60 };
      }
      res.json({ availability: normalised });
    } catch {
      res.json({ availability: null });
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to read coach availability");
    res.status(500).json({ error: "Failed to read availability" });
  }
});

// ── PATCH /coaches/me/availability ───────────────────────────────────────────
// Body: { days: { Monday: true, Tuesday: false, ... }, sessionDurationMins?: number }
router.patch("/coaches/me/availability", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;
  if (accountType !== "coach" && accountType !== "owner_admin") {
    res.status(403).json({ error: "Coach account required" });
    return;
  }

  const { days, activeTimes, sessionDurationMins } = req.body as {
    days?: Record<string, boolean>;
    activeTimes?: Record<string, boolean>;
    sessionDurationMins?: number;
  };

  if (!days || typeof days !== "object") {
    res.status(400).json({ error: "days object is required" });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.json({ success: true });
    return;
  }

  try {
    const payload = JSON.stringify({
      days,
      activeTimes: activeTimes ?? {},
      sessionDurationMins: sessionDurationMins ?? 60,
    });
    await db.execute(sql`
      UPDATE coach_applications
      SET weekly_availability = ${payload}, updated_at = NOW()
      WHERE user_id = ${userId}
    `);
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to update coach availability");
    res.status(500).json({ error: "Failed to update availability" });
  }
});

export default router;
