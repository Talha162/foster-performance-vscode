import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey(),
  coachId: text("coach_id").notNull(),
  coachName: text("coach_name").notNull(),
  coachInitials: text("coach_initials").notNull(),
  coachColor: text("coach_color").notNull(),
  sessionLength: integer("session_length").notNull(),
  price: integer("price").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("upcoming"),
  athleteEmail: text("athlete_email"),
  athleteName: text("athlete_name"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripePaymentStatus: text("stripe_payment_status"),
  videoRoomUrl: text("video_room_url"),
  /**
   * High-entropy cancellation token generated at booking time.
   * Returned once in the booking response; required to call the cancel endpoint.
   * Acts as a per-booking bearer credential so the cancel endpoint cannot be
   * invoked by anyone who only knows the booking ID.
   */
  cancellationToken: text("cancellation_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertBooking = typeof bookingsTable.$inferInsert;
export type Booking = typeof bookingsTable.$inferSelect;
