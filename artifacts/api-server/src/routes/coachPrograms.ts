/**
 * Coach Programs API
 *
 * Coaches can create, list, and delete their own training programs.
 * Programs are stored in the coach_programs table.
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth, type AuthRequest } from "../middleware/requireAuth";

const router: IRouter = Router();

// ── POST /coach-programs ──────────────────────────────────────────────────────
// Create a new coach program. Requires coach or owner_admin role.
router.post("/coach-programs", requireAuth, async (req: AuthRequest, res) => {
  const { accountType, userId } = req.authUser!;

  if (accountType !== "coach" && accountType !== "owner_admin") {
    res.status(403).json({ error: "Coach account required" });
    return;
  }

  const { title, description, category, priceCents, status } = req.body as Record<string, any>;

  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const id = randomUUID();
  const safeTitle = title.trim().slice(0, 120);
  const safeDescription = (description ?? "").toString().trim().slice(0, 1000);
  const safeCategory = (category ?? "Fitness").toString().trim().slice(0, 60);
  const safePriceCents = typeof priceCents === "number" && priceCents >= 0 ? Math.round(priceCents) : 0;
  const safeStatus = status === "published" ? "published" : "draft";

  if (!process.env.DATABASE_URL) {
    res.status(201).json({ id, title: safeTitle, description: safeDescription, category: safeCategory, priceCents: safePriceCents, status: safeStatus, coachUserId: userId });
    return;
  }

  try {
    await db.execute(sql`
      INSERT INTO coach_programs (id, coach_user_id, title, description, category, price_cents, status)
      VALUES (${id}, ${userId}, ${safeTitle}, ${safeDescription}, ${safeCategory}, ${safePriceCents}, ${safeStatus})
    `);
    res.status(201).json({ id, title: safeTitle, description: safeDescription, category: safeCategory, priceCents: safePriceCents, status: safeStatus });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to create coach program");
    res.status(500).json({ error: "Failed to create program" });
  }
});

// ── GET /coach-programs ───────────────────────────────────────────────────────
// List all programs for the authenticated coach.
// Members can also fetch a specific coach's programs via ?coachUserId=N (public view, published only).
router.get("/coach-programs", requireAuth, async (req: AuthRequest, res) => {
  const { accountType, userId } = req.authUser!;
  const { coachUserId } = req.query as { coachUserId?: string };

  if (!process.env.DATABASE_URL) {
    res.json({ programs: [] });
    return;
  }

  try {
    let result;
    if (coachUserId && accountType !== "coach" && accountType !== "owner_admin") {
      // Members see only published programs for a given coach
      const targetId = Number(coachUserId);
      result = await db.execute(sql`
        SELECT * FROM coach_programs
        WHERE coach_user_id = ${targetId} AND status = 'published'
        ORDER BY created_at DESC
      `);
    } else {
      // Coaches see their own programs
      result = await db.execute(sql`
        SELECT * FROM coach_programs
        WHERE coach_user_id = ${userId}
        ORDER BY created_at DESC
      `);
    }
    res.json({ programs: result.rows });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to fetch coach programs");
    res.status(500).json({ error: "Failed to fetch programs" });
  }
});

// ── PATCH /coach-programs/:id ─────────────────────────────────────────────────
// Update title, description, category, priceCents, or status.
router.patch("/coach-programs/:id", requireAuth, async (req: AuthRequest, res) => {
  const { accountType, userId } = req.authUser!;
  const { id } = req.params;

  if (accountType !== "coach" && accountType !== "owner_admin") {
    res.status(403).json({ error: "Coach account required" });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.json({ success: true });
    return;
  }

  try {
    const existing = await db.execute(sql`
      SELECT id FROM coach_programs WHERE id = ${id} AND coach_user_id = ${userId} LIMIT 1
    `);
    if (!existing.rows.length) {
      res.status(404).json({ error: "Program not found" });
      return;
    }

    const { title, description, category, priceCents, status } = req.body as Record<string, any>;

    // Validate status and price if provided — same rules as POST
    if (status !== undefined && status !== "published" && status !== "draft") {
      res.status(400).json({ error: 'status must be "published" or "draft"' });
      return;
    }
    if (priceCents !== undefined && (typeof priceCents !== "number" || priceCents < 0)) {
      res.status(400).json({ error: "priceCents must be a non-negative number" });
      return;
    }

    const safeTitle = title != null ? title.toString().trim().slice(0, 120) : null;
    const safeDescription = description != null ? description.toString().trim().slice(0, 1000) : null;
    const safeCategory = category != null ? category.toString().trim().slice(0, 60) : null;
    const safePriceCents = priceCents != null ? Math.round(priceCents) : null;
    const safeStatus = status ?? null;

    await db.execute(sql`
      UPDATE coach_programs SET
        title = COALESCE(${safeTitle}, title),
        description = COALESCE(${safeDescription}, description),
        category = COALESCE(${safeCategory}, category),
        price_cents = COALESCE(${safePriceCents}, price_cents),
        status = COALESCE(${safeStatus}, status),
        updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to update coach program");
    res.status(500).json({ error: "Failed to update program" });
  }
});

// ── DELETE /coach-programs/:id ────────────────────────────────────────────────
router.delete("/coach-programs/:id", requireAuth, async (req: AuthRequest, res) => {
  const { accountType, userId } = req.authUser!;
  const { id } = req.params;

  if (accountType !== "coach" && accountType !== "owner_admin") {
    res.status(403).json({ error: "Coach account required" });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.json({ success: true });
    return;
  }

  try {
    await db.execute(sql`
      DELETE FROM coach_programs WHERE id = ${id} AND coach_user_id = ${userId}
    `);
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to delete coach program");
    res.status(500).json({ error: "Failed to delete program" });
  }
});

export default router;
