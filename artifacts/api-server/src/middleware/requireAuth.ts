import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../lib/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface AuthRequest extends Request {
  authUser?: TokenPayload;
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token. Please sign in again." });
    return;
  }

  // Enforce suspension + token version on every authenticated request.
  // Fail-closed: DB unavailable → 503 rather than silently granting access.
  (async () => {
    try {
      const result = await db.execute(
        sql`SELECT is_suspended, token_version FROM users WHERE id = ${payload.userId} LIMIT 1`
      );
      const row = result.rows[0] as any;
      if (!row) {
        res.status(401).json({ error: "Account not found. Please sign in again." });
        return;
      }
      if (row.is_suspended) {
        res.status(403).json({ error: "Account suspended. Contact support." });
        return;
      }
      // Token version check — logout-all increments this, invalidating older JWTs.
      const dbVersion = Number(row.token_version ?? 0);
      const jwtVersion = Number(payload.tokenVersion ?? 0);
      if (jwtVersion < dbVersion) {
        res.status(401).json({ error: "Your session has expired. Please sign in again." });
        return;
      }
    } catch {
      res.status(503).json({ error: "Service temporarily unavailable" });
      return;
    }
    req.authUser = payload;
    next();
  })();
}
