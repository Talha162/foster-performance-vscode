/**
 * Messaging API
 *
 * Conversations are uniquely identified by (member_user_id, coach_api_id).
 * Only participants (the member or that coach) can read/send messages.
 * Coaches are identified by looking up their coach_applications row.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth, type AuthRequest } from "../middleware/requireAuth";
import { randomUUID } from "crypto";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Look up the api_N identifier for an approved coach user. */
async function getCoachApiId(userId: number): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT id FROM coach_applications
      WHERE user_id = ${userId} AND status = 'Approved'
      LIMIT 1
    `);
    if (!(result.rows as any[]).length) return null;
    return `api_${(result.rows[0] as any).id}`;
  } catch {
    return null;
  }
}

/**
 * Verify the calling user is a participant in the conversation.
 * Returns { allowed, isCoach, coachApiId? }.
 */
async function assertParticipant(
  convId: string,
  userId: number,
  accountType: string
): Promise<{ allowed: boolean; isCoach: boolean; coachApiId?: string }> {
  try {
    const conv = await db.execute(sql`
      SELECT member_user_id, coach_api_id FROM conversations WHERE id = ${convId} LIMIT 1
    `);
    if (!(conv.rows as any[]).length) return { allowed: false, isCoach: false };
    const row = conv.rows[0] as any;

    if (accountType === "member") {
      return { allowed: Number(row.member_user_id) === userId, isCoach: false };
    }
    // Coach or owner_admin
    const coachApiId = await getCoachApiId(userId);
    if (!coachApiId) return { allowed: false, isCoach: true };
    return { allowed: row.coach_api_id === coachApiId, isCoach: true, coachApiId };
  } catch {
    return { allowed: false, isCoach: false };
  }
}

// ─── POST /conversations ─────────────────────────────────────────────────────
// Create or find an existing conversation between a member and a coach.

router.post("/conversations", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;
  const { memberUserId, memberName, coachApiId } = req.body as any;

  if (!memberUserId || !coachApiId) {
    res.status(400).json({ error: "memberUserId and coachApiId are required" });
    return;
  }

  // Only api_N coaches (approved platform coaches) support server-backed messaging.
  // Static/mock coach IDs (c1, c2, …) have no DB record and no authenticated recipient.
  if (!String(coachApiId).startsWith("api_")) {
    res.status(400).json({ error: "Messaging is only available for platform coaches" });
    return;
  }

  const isCoach = accountType === "coach" || accountType === "owner_admin";

  // Authorization: the caller must be the member or the coach in this conversation.
  if (!isCoach && Number(memberUserId) !== userId) {
    res.status(403).json({ error: "Cannot create a conversation for another member" });
    return;
  }
  if (isCoach) {
    const myApiId = await getCoachApiId(userId);
    if (!myApiId || myApiId !== coachApiId) {
      res.status(403).json({ error: "Cannot create a conversation as another coach" });
      return;
    }
  }

  // Validate the coach exists, is approved, and is not suspended.
  // Always look up the coach name from the DB — never trust the client-supplied value.
  const numericCoachId = String(coachApiId).replace("api_", "");
  let verifiedCoachName = "";
  try {
    const coachCheck = await db.execute(sql`
      SELECT ca.full_name, u.name AS user_name, u.is_suspended
      FROM coach_applications ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.id = ${numericCoachId}
        AND ca.status = 'Approved'
        AND u.is_suspended = FALSE
      LIMIT 1
    `);
    if (!(coachCheck.rows as any[]).length) {
      res.status(400).json({ error: "Coach is not available for messaging" });
      return;
    }
    const row = coachCheck.rows[0] as any;
    verifiedCoachName = row.full_name || row.user_name || "";
  } catch (err: any) {
    logger.error({ err: err.message }, "POST /conversations — coach validation failed");
    res.status(503).json({ error: "Could not verify coach. Please try again." });
    return;
  }

  // Verify that the member account exists.
  let verifiedMemberName = "";
  try {
    const memberCheck = await db.execute(sql`
      SELECT name FROM users WHERE id = ${Number(memberUserId)} LIMIT 1
    `);
    if (!(memberCheck.rows as any[]).length) {
      res.status(400).json({ error: "Member not found" });
      return;
    }
    verifiedMemberName = (memberCheck.rows[0] as any).name || memberName || "";
  } catch (err: any) {
    logger.error({ err: err.message }, "POST /conversations — member lookup failed");
    res.status(503).json({ error: "Could not verify member. Please try again." });
    return;
  }

  try {
    // Return existing conversation if it already exists.
    const existing = await db.execute(sql`
      SELECT id FROM conversations
      WHERE member_user_id = ${Number(memberUserId)} AND coach_api_id = ${coachApiId}
      LIMIT 1
    `);
    if ((existing.rows as any[]).length) {
      res.json({ conversationId: (existing.rows[0] as any).id });
      return;
    }

    const id = `conv_${memberUserId}_${coachApiId}`;
    await db.execute(sql`
      INSERT INTO conversations (id, member_user_id, coach_api_id, coach_name, member_name)
      VALUES (${id}, ${Number(memberUserId)}, ${coachApiId}, ${verifiedCoachName}, ${verifiedMemberName})
      ON CONFLICT (member_user_id, coach_api_id) DO NOTHING
    `);

    // Re-fetch to handle any race condition.
    const created = await db.execute(sql`
      SELECT id FROM conversations
      WHERE member_user_id = ${Number(memberUserId)} AND coach_api_id = ${coachApiId}
      LIMIT 1
    `);
    res.json({ conversationId: (created.rows[0] as any)?.id ?? id });
  } catch (err: any) {
    logger.error({ err: err.message }, "POST /conversations failed");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// ─── GET /conversations ───────────────────────────────────────────────────────
// List conversations for the current authenticated user.

router.get("/conversations", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;

  try {
    let rows: any[] = [];

    if (accountType === "member") {
      const result = await db.execute(sql`
        SELECT
          c.id,
          c.member_user_id,
          c.coach_api_id,
          c.coach_name,
          c.member_name,
          c.updated_at,
          (SELECT body  FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
          (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_timestamp,
          (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.read_by_member = FALSE AND m.sender_role = 'coach') AS unread_for_member
        FROM conversations c
        WHERE c.member_user_id = ${userId}
        ORDER BY c.updated_at DESC
      `);
      rows = result.rows as any[];
    } else if (accountType === "coach" || accountType === "owner_admin") {
      const coachApiId = await getCoachApiId(userId);
      if (!coachApiId) {
        res.json({ conversations: [] });
        return;
      }
      const result = await db.execute(sql`
        SELECT
          c.id,
          c.member_user_id,
          c.coach_api_id,
          c.coach_name,
          c.member_name,
          c.updated_at,
          (SELECT body  FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
          (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_timestamp,
          (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.read_by_coach = FALSE AND m.sender_role = 'member') AS unread_for_coach
        FROM conversations c
        WHERE c.coach_api_id = ${coachApiId}
        ORDER BY c.updated_at DESC
      `);
      rows = result.rows as any[];
    }

    const conversations = rows.map((r) => ({
      id: r.id,
      memberUserId: String(r.member_user_id),
      memberName: r.member_name,
      coachApiId: r.coach_api_id,
      coachName: r.coach_name,
      lastMessage: r.last_message ?? "",
      lastTimestamp: r.last_timestamp ?? r.updated_at,
      unreadForMember: Number(r.unread_for_member ?? 0),
      unreadForCoach: Number(r.unread_for_coach ?? 0),
    }));
    res.json({ conversations });
  } catch (err: any) {
    logger.error({ err: err.message }, "GET /conversations failed");
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// ─── GET /conversations/:convId/messages ──────────────────────────────────────

router.get("/conversations/:convId/messages", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;
  const convId = req.params["convId"] as string;

  const { allowed } = await assertParticipant(convId, userId, accountType);
  if (!allowed) {
    res.status(403).json({ error: "Not a participant in this conversation" });
    return;
  }

  try {
    const result = await db.execute(sql`
      SELECT id, conversation_id, sender_id, sender_name, sender_role, body AS text, created_at
      FROM messages
      WHERE conversation_id = ${convId}
      ORDER BY created_at ASC
      LIMIT 500
    `);
    const messages = (result.rows as any[]).map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      senderId: String(r.sender_id),
      senderName: r.sender_name,
      senderRole: r.sender_role as "member" | "coach",
      text: r.text,
      timestamp: r.created_at,
    }));
    res.json({ messages });
  } catch (err: any) {
    logger.error({ err: err.message }, "GET /conversations/:convId/messages failed");
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// ─── POST /conversations/:convId/messages ─────────────────────────────────────

router.post("/conversations/:convId/messages", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;
  const convId = req.params["convId"] as string;
  const { text } = req.body as any;

  if (!text?.trim()) {
    res.status(400).json({ error: "Message text is required" });
    return;
  }

  const { allowed, isCoach } = await assertParticipant(convId, userId, accountType);
  if (!allowed) {
    res.status(403).json({ error: "Not a participant in this conversation" });
    return;
  }

  // Derive sender name from the DB — never trust client-supplied identity.
  let verifiedSenderName = "";
  try {
    if (isCoach) {
      const result = await db.execute(sql`
        SELECT ca.full_name, u.name AS user_name
        FROM coach_applications ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.user_id = ${userId} AND ca.status = 'Approved'
        LIMIT 1
      `);
      const row = result.rows[0] as any;
      verifiedSenderName = row?.full_name || row?.user_name || "";
    } else {
      const result = await db.execute(sql`SELECT name FROM users WHERE id = ${userId} LIMIT 1`);
      verifiedSenderName = (result.rows[0] as any)?.name || "";
    }
  } catch {
    // If the name lookup fails, use an empty string rather than failing the send.
    verifiedSenderName = "";
  }

  const senderRole: "member" | "coach" = isCoach ? "coach" : "member";
  const msgId = randomUUID();
  const trimmed = (text as string).trim();

  try {
    await db.execute(sql`
      INSERT INTO messages (id, conversation_id, sender_id, sender_name, sender_role, body)
      VALUES (${msgId}, ${convId}, ${userId}, ${verifiedSenderName}, ${senderRole}, ${trimmed})
    `);
    await db.execute(sql`
      UPDATE conversations SET updated_at = NOW() WHERE id = ${convId}
    `);

    res.json({
      message: {
        id: msgId,
        conversationId: convId,
        senderId: String(userId),
        senderName: verifiedSenderName,
        senderRole,
        text: trimmed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "POST /conversations/:convId/messages failed");
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ─── PATCH /conversations/:convId/read ────────────────────────────────────────
// Mark all incoming messages in the conversation as read for the caller.

router.patch("/conversations/:convId/read", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;
  const convId = req.params["convId"] as string;

  const { allowed, isCoach } = await assertParticipant(convId, userId, accountType);
  if (!allowed) {
    res.status(403).json({ error: "Not a participant in this conversation" });
    return;
  }

  try {
    if (isCoach) {
      await db.execute(sql`
        UPDATE messages SET read_by_coach = TRUE
        WHERE conversation_id = ${convId} AND sender_role = 'member'
      `);
    } else {
      await db.execute(sql`
        UPDATE messages SET read_by_member = TRUE
        WHERE conversation_id = ${convId} AND sender_role = 'coach'
      `);
    }
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err: err.message }, "PATCH /conversations/:convId/read failed");
    res.status(500).json({ error: "Failed to mark read" });
  }
});

export default router;
