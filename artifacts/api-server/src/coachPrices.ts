/**
 * Authoritative server-side coach price list.
 * Prices are derived here — never trusted from client payloads.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const COACH_PRICES: Record<string, { session30Price: number; session60Price: number }> = {
  c1: { session30Price: 75,  session60Price: 140 },
  c2: { session30Price: 65,  session60Price: 120 },
  c3: { session30Price: 95,  session60Price: 175 },
  c4: { session30Price: 70,  session60Price: 130 },
  c5: { session30Price: 85,  session60Price: 155 },
  c6: { session30Price: 90,  session60Price: 165 },
  c7: { session30Price: 100, session60Price: 185 },
  c8: { session30Price: 80,  session60Price: 145 },
};

export function getSessionPrice(coachId: string, sessionLength: 30 | 60): number | null {
  const prices = COACH_PRICES[coachId];
  if (!prices) return null;
  return sessionLength === 30 ? prices.session30Price : prices.session60Price;
}

/**
 * Async price lookup that covers both static AppContext coaches (c1–c8)
 * and API coaches whose prices are stored in the coach_applications table.
 *
 * API coach IDs are prefixed "api_N" where N is the coach_applications.id.
 * Returns null for unknown coaches.
 */
export async function getSessionPriceForCoach(
  coachId: string,
  sessionLength: 30 | 60
): Promise<number | null> {
  // Fast path: static lookup for AppContext coaches
  const staticPrice = getSessionPrice(coachId, sessionLength);
  if (staticPrice !== null) return staticPrice;

  // DB lookup for API coaches
  if (coachId.startsWith("api_") && process.env.DATABASE_URL) {
    const numericId = Number(coachId.replace("api_", ""));
    if (isNaN(numericId)) return null;
    try {
      const result = await db.execute(
        sql`SELECT prices FROM coach_applications WHERE id = ${numericId} AND status = 'Approved' LIMIT 1`
      );
      const row = result.rows[0] as Record<string, any> | undefined;
      if (!row?.prices) return null;
      const prices = JSON.parse(row.prices as string) as {
        session30?: number;
        session60?: number;
      };
      return (sessionLength === 30 ? prices.session30 : prices.session60) ?? null;
    } catch {
      return null;
    }
  }

  return null;
}
