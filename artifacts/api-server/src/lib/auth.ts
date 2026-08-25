import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  "foster-dev-secret-change-in-prod";

const OWNER_ADMIN_EMAIL = process.env.OWNER_ADMIN_EMAIL?.toLowerCase().trim();

// ─── Password ─────────────────────────────────────────────────────────────────

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Returns null if the password meets all requirements, else a human-readable error. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8)
    return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return "Password must contain at least one special character";
  return null;
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  userId: number;
  accountType: string;
  email: string;
  tokenVersion?: number;
}

export function signToken(payload: TokenPayload): string {
  return (jwt as any).sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return (jwt as any).verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// ─── Owner Admin ──────────────────────────────────────────────────────────────

/**
 * Returns 'owner_admin' if the email matches the OWNER_ADMIN_EMAIL env var.
 * Otherwise returns the stored role unchanged.
 * The owner_admin role can only be assigned this way — never through the app.
 */
export function getEffectiveRole(email: string, storedRole: string): string {
  if (OWNER_ADMIN_EMAIL && email.toLowerCase() === OWNER_ADMIN_EMAIL) {
    return "owner_admin";
  }
  return storedRole;
}

export { OWNER_ADMIN_EMAIL };
