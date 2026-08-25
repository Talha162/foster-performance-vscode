import { Response, NextFunction } from "express";
import { requireAuth, AuthRequest } from "./requireAuth";

/**
 * Middleware that requires an authenticated owner_admin.
 * The owner_admin role can only be set via the OWNER_ADMIN_EMAIL env var —
 * it is never assignable through the public API.
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  requireAuth(req, res, () => {
    if (req.authUser?.accountType !== "owner_admin") {
      res.status(403).json({ error: "Owner admin access required" });
      return;
    }
    next();
  });
}
