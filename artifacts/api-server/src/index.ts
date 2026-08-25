import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, resolveAndCacheStripeMode } from "./stripeClient";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { SEED_RECIPES } from "./routes/nutrition";

/**
 * Ensures user auth tables exist.
 */
async function ensureAuthTables() {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id                     SERIAL        PRIMARY KEY,
        email                  TEXT          NOT NULL UNIQUE,
        name                   TEXT          NOT NULL,
        password_hash          TEXT          NOT NULL,
        account_type           TEXT          NOT NULL DEFAULT 'member',
        onboarding_complete    BOOLEAN       NOT NULL DEFAULT false,
        goal                   TEXT,
        level                  TEXT,
        is_premium             BOOLEAN       NOT NULL DEFAULT false,
        subscription_status    TEXT,
        subscription_plan      TEXT,
        subscription_end_date  TEXT,
        stripe_customer_id     TEXT,
        stripe_subscription_id TEXT,
        streak_days            INTEGER       NOT NULL DEFAULT 0,
        total_workouts         INTEGER       NOT NULL DEFAULT 0,
        created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coach_applications (
        id                   SERIAL       PRIMARY KEY,
        user_id              INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        full_name            TEXT,
        phone                TEXT,
        professional_title   TEXT,
        biography            TEXT,
        experience_years     INTEGER,
        certifications       TEXT,
        specialties          TEXT,
        services             TEXT,
        session_lengths      TEXT,
        prices               TEXT,
        weekly_availability  TEXT,
        virtual_sessions     BOOLEAN      NOT NULL DEFAULT true,
        in_person_sessions   BOOLEAN      NOT NULL DEFAULT false,
        service_location     TEXT,
        professional_links   TEXT,
        profile_photo_url    TEXT,
        resume_url           TEXT,
        agreed_to_terms      BOOLEAN      NOT NULL DEFAULT false,
        status               TEXT         NOT NULL DEFAULT 'Incomplete',
        admin_notes          TEXT,
        submitted_at         TIMESTAMPTZ,
        reviewed_at          TIMESTAMPTZ,
        created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key        TEXT        PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coach_programs (
        id             TEXT        PRIMARY KEY,
        coach_user_id  INTEGER     NOT NULL,
        title          TEXT        NOT NULL,
        description    TEXT        NOT NULL DEFAULT '',
        category       TEXT        NOT NULL DEFAULT 'Fitness',
        price_cents    INTEGER     NOT NULL DEFAULT 0,
        status         TEXT        NOT NULL DEFAULT 'draft',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS member_subscriptions (
        id                      TEXT        PRIMARY KEY,
        user_id                 TEXT        NOT NULL,
        user_email              TEXT,
        user_name               TEXT,
        stripe_customer_id      TEXT        NOT NULL,
        stripe_subscription_id  TEXT        UNIQUE,
        plan                    TEXT        NOT NULL,
        status                  TEXT        NOT NULL,
        current_period_end      TIMESTAMPTZ,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Idempotent column additions
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`);
    // Password reset tokens (time-limited, single-use OTPs)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         SERIAL      PRIMARY KEY,
        user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT        NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at    TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Auth tables ready");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to ensure auth tables (non-fatal)");
  }
}

/**
 * Ensures the conversations and messages tables exist for server-backed in-app messaging.
 */
async function ensureMessagingTables() {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id              TEXT        PRIMARY KEY,
        member_user_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        coach_api_id    TEXT        NOT NULL,
        coach_name      TEXT        NOT NULL DEFAULT '',
        member_name     TEXT        NOT NULL DEFAULT '',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(member_user_id, coach_api_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id               TEXT        PRIMARY KEY,
        conversation_id  TEXT        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id        INTEGER     NOT NULL,
        sender_name      TEXT        NOT NULL DEFAULT '',
        sender_role      TEXT        NOT NULL CHECK (sender_role IN ('member', 'coach')),
        body             TEXT        NOT NULL,
        read_by_member   BOOLEAN     NOT NULL DEFAULT FALSE,
        read_by_coach    BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Messaging tables ready");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to ensure auth tables (non-fatal)");
  }
}

/**
 * Ensures the application bookings table exists.
 * Uses CREATE TABLE IF NOT EXISTS so it is safe to run on every startup
 * and does not depend on drizzle-kit push having been run manually.
 */
async function ensureBookingsTable() {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id                       TEXT        PRIMARY KEY,
        coach_id                 TEXT        NOT NULL,
        coach_name               TEXT        NOT NULL,
        coach_initials           TEXT        NOT NULL,
        coach_color              TEXT        NOT NULL,
        session_length           INTEGER     NOT NULL,
        price                    INTEGER     NOT NULL,
        date                     TEXT        NOT NULL,
        time                     TEXT        NOT NULL,
        status                   TEXT        NOT NULL DEFAULT 'upcoming',
        athlete_email            TEXT,
        athlete_name             TEXT,
        stripe_payment_intent_id TEXT,
        stripe_payment_status    TEXT,
        video_room_url           TEXT,
        created_at               TIMESTAMP   NOT NULL DEFAULT NOW()
      )
    `);
    // Add unique constraint idempotently (safe if it already exists).
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'bookings_stripe_payment_intent_id_unique'
            AND conrelid = 'bookings'::regclass
        ) THEN
          ALTER TABLE bookings
            ADD CONSTRAINT bookings_stripe_payment_intent_id_unique
            UNIQUE (stripe_payment_intent_id);
        END IF;
      END $$
    `);
    logger.info("Bookings table ready");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to ensure bookings table — payment endpoint may fail");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Creates nutrition tables and seeds the recipe library.
 */
async function ensureNutritionTables() {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS nutrition_profiles (
        id                   SERIAL       PRIMARY KEY,
        user_id              INTEGER      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        goal                 TEXT,
        secondary_goals      TEXT         DEFAULT '[]',
        daily_calories       INTEGER      NOT NULL DEFAULT 2000,
        protein_target       INTEGER      NOT NULL DEFAULT 150,
        carbs_target         INTEGER      NOT NULL DEFAULT 200,
        fat_target           INTEGER      NOT NULL DEFAULT 65,
        fiber_target         INTEGER      NOT NULL DEFAULT 30,
        water_target_ml      INTEGER      NOT NULL DEFAULT 2500,
        tracking_mode        TEXT         NOT NULL DEFAULT 'guided',
        dietary_pattern      TEXT         NOT NULL DEFAULT 'omnivore',
        allergies            TEXT         DEFAULT '[]',
        intolerances         TEXT         DEFAULT '[]',
        activity_level       TEXT         NOT NULL DEFAULT 'moderately_active',
        meal_frequency       TEXT         NOT NULL DEFAULT 'three_plus_snacks',
        onboarding_complete  BOOLEAN      NOT NULL DEFAULT false,
        created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS recipes (
        id               TEXT        PRIMARY KEY,
        title            TEXT        NOT NULL,
        description      TEXT,
        category         TEXT        NOT NULL DEFAULT 'General',
        goal_tags        TEXT        DEFAULT '[]',
        dietary_tags     TEXT        DEFAULT '[]',
        allergy_tags     TEXT        DEFAULT '[]',
        prep_time_mins   INTEGER     NOT NULL DEFAULT 10,
        cook_time_mins   INTEGER     NOT NULL DEFAULT 20,
        servings         INTEGER     NOT NULL DEFAULT 2,
        difficulty       TEXT        NOT NULL DEFAULT 'Easy',
        calories         INTEGER     NOT NULL DEFAULT 0,
        protein          REAL        NOT NULL DEFAULT 0,
        carbs            REAL        NOT NULL DEFAULT 0,
        fat              REAL        NOT NULL DEFAULT 0,
        fiber            REAL        NOT NULL DEFAULT 0,
        sodium           REAL        NOT NULL DEFAULT 0,
        cost_per_serving REAL        NOT NULL DEFAULT 0,
        ingredients      TEXT        DEFAULT '[]',
        instructions     TEXT        DEFAULT '[]',
        storage          TEXT,
        reheat           TEXT,
        equipment        TEXT        DEFAULT '[]',
        is_published     BOOLEAN     NOT NULL DEFAULT true,
        created_by       TEXT        NOT NULL DEFAULT 'system',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS saved_recipes (
        id         SERIAL      PRIMARY KEY,
        user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id  TEXT        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, recipe_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS food_logs (
        id             TEXT        PRIMARY KEY,
        user_id        INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_category  TEXT        NOT NULL DEFAULT 'Meal',
        food_name      TEXT        NOT NULL,
        brand          TEXT,
        calories       REAL        NOT NULL DEFAULT 0,
        protein        REAL        NOT NULL DEFAULT 0,
        carbs          REAL        NOT NULL DEFAULT 0,
        fat            REAL        NOT NULL DEFAULT 0,
        fiber          REAL        NOT NULL DEFAULT 0,
        serving_amount REAL        NOT NULL DEFAULT 1,
        serving_unit   TEXT        NOT NULL DEFAULT 'serving',
        notes          TEXT,
        recipe_id      TEXT,
        logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS water_logs (
        id         SERIAL      PRIMARY KEY,
        user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_ml  INTEGER     NOT NULL DEFAULT 250,
        logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grocery_lists (
        id         TEXT        PRIMARY KEY,
        user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title      TEXT        NOT NULL DEFAULT 'My Grocery List',
        is_active  BOOLEAN     NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grocery_items (
        id            TEXT        PRIMARY KEY,
        list_id       TEXT        NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
        category      TEXT        NOT NULL DEFAULT 'Other',
        name          TEXT        NOT NULL,
        amount        TEXT        NOT NULL DEFAULT '',
        unit          TEXT        NOT NULL DEFAULT '',
        is_checked    BOOLEAN     NOT NULL DEFAULT false,
        custom_added  BOOLEAN     NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Nutrition tables ready");

    // Seed recipes if none exist
    const existing = await db.execute(sql`SELECT COUNT(*) as cnt FROM recipes`);
    const count = Number((existing.rows[0] as any)?.cnt ?? 0);
    if (count === 0) {
      logger.info("Seeding recipe library…");
      for (const recipe of SEED_RECIPES) {
        await db.execute(sql`
          INSERT INTO recipes (id, title, description, category, goal_tags, dietary_tags, allergy_tags,
            prep_time_mins, cook_time_mins, servings, difficulty, calories, protein, carbs, fat, fiber,
            sodium, cost_per_serving, ingredients, instructions, storage, reheat, equipment)
          VALUES (
            ${recipe.id}, ${recipe.title}, ${recipe.description}, ${recipe.category},
            ${recipe.goal_tags}, ${recipe.dietary_tags}, ${recipe.allergy_tags},
            ${recipe.prep_time_mins}, ${recipe.cook_time_mins}, ${recipe.servings}, ${recipe.difficulty},
            ${recipe.calories}, ${recipe.protein}, ${recipe.carbs}, ${recipe.fat}, ${recipe.fiber},
            ${recipe.sodium}, ${recipe.cost_per_serving},
            ${recipe.ingredients}, ${recipe.instructions}, ${recipe.storage}, ${recipe.reheat}, ${recipe.equipment}
          )
          ON CONFLICT (id) DO NOTHING
        `);
      }
      logger.info({ count: SEED_RECIPES.length }, "Recipes seeded");
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to ensure nutrition tables (non-fatal)");
  }
}

/**
 * Creates all leaderboard, streak, points, league, challenge, and achievement tables.
 */
async function ensureLeaderboardTables() {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS streaks (
        user_id             INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        current_streak      INTEGER     NOT NULL DEFAULT 0,
        longest_streak      INTEGER     NOT NULL DEFAULT 0,
        last_activity_date  TEXT,
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS streak_history (
        id        SERIAL      PRIMARY KEY,
        user_id   INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date      TEXT        NOT NULL,
        completed BOOLEAN     NOT NULL DEFAULT FALSE,
        frozen    BOOLEAN     NOT NULL DEFAULT FALSE,
        UNIQUE(user_id, date)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fp_points (
        user_id    INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        total      INTEGER     NOT NULL DEFAULT 0,
        weekly     INTEGER     NOT NULL DEFAULT 0,
        week_start TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS point_transactions (
        id            SERIAL      PRIMARY KEY,
        user_id       INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_type TEXT        NOT NULL,
        points        INTEGER     NOT NULL,
        date          TEXT        NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, activity_type, date)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS leagues (
        id    SERIAL  PRIMARY KEY,
        name  TEXT    NOT NULL UNIQUE,
        tier  INTEGER NOT NULL UNIQUE,
        color TEXT    NOT NULL DEFAULT '#9AA3B5',
        emoji TEXT    NOT NULL DEFAULT '⚡'
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS league_memberships (
        user_id    INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        league_id  INTEGER     NOT NULL REFERENCES leagues(id),
        joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS friendships (
        id         SERIAL      PRIMARY KEY,
        user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status     TEXT        NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, friend_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS leaderboard_privacy (
        user_id      INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        display_mode TEXT        NOT NULL DEFAULT 'first_name',
        display_name TEXT,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS challenges (
        id             TEXT        PRIMARY KEY,
        title          TEXT        NOT NULL,
        description    TEXT,
        challenge_type TEXT        NOT NULL DEFAULT 'workout',
        duration_days  INTEGER     NOT NULL DEFAULT 7,
        start_date     TEXT        NOT NULL,
        end_date       TEXT        NOT NULL,
        created_by     INTEGER     REFERENCES users(id),
        is_featured    BOOLEAN     NOT NULL DEFAULT FALSE,
        invite_code    TEXT        UNIQUE,
        status         TEXT        NOT NULL DEFAULT 'active',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS challenge_members (
        id           SERIAL      PRIMARY KEY,
        challenge_id TEXT        NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
        user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        points       INTEGER     NOT NULL DEFAULT 0,
        UNIQUE(challenge_id, user_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS achievements (
        id              TEXT    PRIMARY KEY,
        title           TEXT    NOT NULL,
        description     TEXT    NOT NULL,
        icon            TEXT    NOT NULL DEFAULT 'trophy',
        color           TEXT    NOT NULL DEFAULT '#D6A84B',
        category        TEXT    NOT NULL DEFAULT 'general',
        condition_type  TEXT    NOT NULL,
        condition_value INTEGER NOT NULL DEFAULT 1
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id             SERIAL      PRIMARY KEY,
        user_id        INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        achievement_id TEXT        NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
        earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, achievement_id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS streak_freezes (
        id            SERIAL      PRIMARY KEY,
        user_id       INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        used_at       TIMESTAMPTZ,
        used_for_date TEXT,
        earned_via    TEXT        NOT NULL DEFAULT 'premium',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Leaderboard tables ready");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to ensure leaderboard tables (non-fatal)");
  }
}

/**
 * Initialize Stripe schema and sync data on startup.
 * This is non-fatal: if Stripe is not connected, the server starts anyway
 * and the booking endpoint returns a clear 503 instead of silently failing.
 */
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    logger.info("Initializing Stripe schema…");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    logger.info("Stripe webhook configured");

    // Run backfill in background — don't block startup
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data sync complete"))
      .catch((err) => logger.error({ err: err.message }, "Stripe sync error"));
  } catch (err: any) {
    // Log clearly — don't crash. Booking endpoint will surface a 503.
    logger.warn(
      { err: err.message },
      "Stripe initialization skipped — connect Stripe via the Integrations tab to enable payments"
    );
  }
}

/**
 * Ensures the member subscriptions table exists.
 * Non-fatal — server starts even if this fails.
 */
async function ensureSubscriptionsTable() {
  if (!process.env.DATABASE_URL) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS member_subscriptions (
        id                       TEXT        PRIMARY KEY,
        user_id                  TEXT        NOT NULL,
        user_email               TEXT,
        user_name                TEXT,
        stripe_customer_id       TEXT,
        stripe_subscription_id   TEXT        UNIQUE,
        plan                     TEXT        NOT NULL DEFAULT 'monthly',
        status                   TEXT        NOT NULL DEFAULT 'active',
        current_period_end       TIMESTAMPTZ,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("Subscriptions table ready");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to ensure subscriptions table (non-fatal)");
  }
}

await ensureAuthTables();
await ensureMessagingTables();
await ensureBookingsTable();
await ensureSubscriptionsTable();
await ensureNutritionTables();
await ensureLeaderboardTables();
await initStripe();
// Resolve and cache Stripe mode (test vs live) for synchronous use in middleware.
// Must be called after initStripe so credentials are available.
await resolveAndCacheStripeMode();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
