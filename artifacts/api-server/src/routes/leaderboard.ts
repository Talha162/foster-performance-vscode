import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthRequest } from "../middleware/requireAuth";
import { Response } from "express";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in UTC. */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the Monday of the current ISO week as YYYY-MM-DD (UTC). */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + diff);
  return mon.toISOString().slice(0, 10);
}

/** Default point values — overridden by platform_settings rows. */
const DEFAULT_POINTS: Record<string, number> = {
  workout:          50,
  run_walk:         40,
  nutrition_goals:  30,
  water_goal:       15,
  recovery:         20,
  checkin:          10,
};

const BONUS_STREAK_7  = 100;
const BONUS_STREAK_30 = 500;

/** Fetch point config from platform_settings (falls back to defaults). */
async function getPointConfig(): Promise<Record<string, number>> {
  try {
    const rows = (await db.execute(sql`
      SELECT key, value FROM platform_settings
      WHERE key LIKE 'points_%'
    `)).rows as { key: string; value: string }[];

    const cfg = { ...DEFAULT_POINTS };
    for (const r of rows) {
      const shortKey = r.key.replace("points_", "");
      const v = Number(r.value);
      if (!Number.isNaN(v) && shortKey in cfg) cfg[shortKey] = v;
    }
    return cfg;
  } catch {
    return { ...DEFAULT_POINTS };
  }
}

/** Get or create the streak row for a user. */
async function getOrCreateStreak(userId: number) {
  const res = await db.execute(sql`
    SELECT * FROM streaks WHERE user_id = ${userId}
  `);
  if (res.rows.length) return res.rows[0] as any;
  await db.execute(sql`
    INSERT INTO streaks (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING
  `);
  return (await db.execute(sql`SELECT * FROM streaks WHERE user_id = ${userId}`)).rows[0] as any;
}

/** Get or create fp_points row, resetting weekly total if week changed. */
async function getOrCreatePoints(userId: number) {
  const weekStart = currentWeekStart();
  await db.execute(sql`
    INSERT INTO fp_points (user_id, total, weekly, week_start)
    VALUES (${userId}, 0, 0, ${weekStart})
    ON CONFLICT (user_id) DO NOTHING
  `);
  // Reset weekly if a new week has started
  await db.execute(sql`
    UPDATE fp_points SET weekly = 0, week_start = ${weekStart}
    WHERE user_id = ${userId} AND week_start <> ${weekStart}
  `);
  return (await db.execute(sql`SELECT * FROM fp_points WHERE user_id = ${userId}`)).rows[0] as any;
}

/** Ensure a user has a league membership (default = Starter, tier 1). */
async function ensureLeagueMembership(userId: number) {
  await db.execute(sql`
    INSERT INTO league_memberships (user_id, league_id)
    SELECT ${userId}, id FROM leagues WHERE tier = 1
    ON CONFLICT (user_id) DO NOTHING
  `);
}

/** Compute display name for a user respecting privacy settings. */
function resolveDisplayName(
  name: string,
  privacyMode: string | null,
  customName: string | null,
): string {
  switch (privacyMode) {
    case "anonymous":    return "Anonymous";
    case "custom":       return customName || name.split(" ")[0];
    case "first_name":   return name.split(" ")[0];
    case "private":      return "—";
    default:             return name;
  }
}

/** Check and award achievement if newly earned. Returns new achievement ids. */
async function checkAchievements(
  userId: number,
  streak: number,
  workoutCount: number,
  nutritionCount: number,
  recoveryCount: number,
  waterCount: number,
): Promise<string[]> {
  const earned: string[] = [];
  try {
    const all = (await db.execute(sql`SELECT * FROM achievements`)).rows as any[];
    const existing = new Set(
      ((await db.execute(sql`
        SELECT achievement_id FROM user_achievements WHERE user_id = ${userId}
      `)).rows as any[]).map((r: any) => r.achievement_id)
    );

    for (const ach of all) {
      if (existing.has(ach.id)) continue;
      let qualifies = false;
      switch (ach.condition_type) {
        case "streak_days":       qualifies = streak >= ach.condition_value; break;
        case "workout_count":     qualifies = workoutCount >= ach.condition_value; break;
        case "nutrition_count":   qualifies = nutritionCount >= ach.condition_value; break;
        case "recovery_count":    qualifies = recoveryCount >= ach.condition_value; break;
        case "water_count":       qualifies = waterCount >= ach.condition_value; break;
      }
      if (qualifies) {
        await db.execute(sql`
          INSERT INTO user_achievements (user_id, achievement_id)
          VALUES (${userId}, ${ach.id}) ON CONFLICT DO NOTHING
        `);
        earned.push(ach.id);
      }
    }
  } catch { /* non-fatal */ }
  return earned;
}

// ─── Seed leagues & achievements on first use ─────────────────────────────────

let leaderboardSeeded = false;
async function ensureLeaderboardSeeds() {
  if (leaderboardSeeded) return;
  leaderboardSeeded = true;
  try {
    const leagueCount = Number(
      ((await db.execute(sql`SELECT COUNT(*) as cnt FROM leagues`)).rows[0] as any)?.cnt ?? 0
    );
    if (leagueCount === 0) {
      const leagues = [
        { name: "Starter",  tier: 1, color: "#9AA3B5", emoji: "⚡" },
        { name: "Bronze",   tier: 2, color: "#CD7F32", emoji: "🥉" },
        { name: "Silver",   tier: 3, color: "#A8A9AD", emoji: "🥈" },
        { name: "Gold",     tier: 4, color: "#D6A84B", emoji: "🥇" },
        { name: "Platinum", tier: 5, color: "#2F80FF", emoji: "💎" },
        { name: "Diamond",  tier: 6, color: "#35C98A", emoji: "💠" },
        { name: "Elite",    tier: 7, color: "#E91E8C", emoji: "🏆" },
      ];
      for (const l of leagues) {
        await db.execute(sql`
          INSERT INTO leagues (name, tier, color, emoji)
          VALUES (${l.name}, ${l.tier}, ${l.color}, ${l.emoji})
          ON CONFLICT (name) DO NOTHING
        `);
      }
    }

    const achCount = Number(
      ((await db.execute(sql`SELECT COUNT(*) as cnt FROM achievements`)).rows[0] as any)?.cnt ?? 0
    );
    if (achCount === 0) {
      const achs = [
        { id: "first_workout",  title: "First Rep", description: "Complete your first workout", icon: "dumbbell", color: "#2F80FF", category: "workout", condition_type: "workout_count", condition_value: 1 },
        { id: "first_nutrition",title: "Fuel Up",   description: "Hit your first nutrition goal", icon: "food-apple", color: "#35C98A", category: "nutrition", condition_type: "nutrition_count", condition_value: 1 },
        { id: "streak_3",       title: "Hat Trick", description: "3-day streak", icon: "fire", color: "#FF6B35", category: "streak", condition_type: "streak_days", condition_value: 3 },
        { id: "streak_7",       title: "Week Warrior", description: "7-day streak", icon: "fire", color: "#FF6B35", category: "streak", condition_type: "streak_days", condition_value: 7 },
        { id: "streak_14",      title: "Two Weeks Strong", description: "14-day streak", icon: "fire", color: "#FF6B35", category: "streak", condition_type: "streak_days", condition_value: 14 },
        { id: "streak_30",      title: "Consistency Champion", description: "30-day streak", icon: "trophy", color: "#D6A84B", category: "streak", condition_type: "streak_days", condition_value: 30 },
        { id: "streak_100",     title: "Legend", description: "100-day streak", icon: "crown", color: "#E91E8C", category: "streak", condition_type: "streak_days", condition_value: 100 },
        { id: "workouts_5",     title: "Getting Started", description: "5 workouts completed", icon: "dumbbell", color: "#2F80FF", category: "workout", condition_type: "workout_count", condition_value: 5 },
        { id: "workouts_25",    title: "Quarter Century", description: "25 workouts completed", icon: "dumbbell", color: "#9C27B0", category: "workout", condition_type: "workout_count", condition_value: 25 },
        { id: "workouts_100",   title: "Century Club", description: "100 workouts completed", icon: "trophy", color: "#D6A84B", category: "workout", condition_type: "workout_count", condition_value: 100 },
        { id: "hydration_champ",title: "Hydration Champion", description: "Hit water goal 7 times", icon: "water", color: "#00BCD4", category: "hydration", condition_type: "water_count", condition_value: 7 },
        { id: "meal_prep",      title: "Meal Prep Starter", description: "Log meals 3 times", icon: "chef-hat", color: "#35C98A", category: "nutrition", condition_type: "nutrition_count", condition_value: 3 },
        { id: "recovery_focus", title: "Recovery Focused", description: "5 recovery sessions", icon: "meditation", color: "#00BCD4", category: "recovery", condition_type: "recovery_count", condition_value: 5 },
        { id: "weekend_warrior",title: "Weekend Warrior", description: "10 workouts on weekends", icon: "calendar-star", color: "#FF6B35", category: "workout", condition_type: "workout_count", condition_value: 10 },
      ];
      for (const a of achs) {
        await db.execute(sql`
          INSERT INTO achievements (id, title, description, icon, color, category, condition_type, condition_value)
          VALUES (${a.id}, ${a.title}, ${a.description}, ${a.icon}, ${a.color}, ${a.category}, ${a.condition_type}, ${a.condition_value})
          ON CONFLICT (id) DO NOTHING
        `);
      }
    }
  } catch { /* non-fatal */ }
}

// ─── POST /leaderboard/activity ──────────────────────────────────────────────

router.post("/leaderboard/activity", requireAuth, async (req: AuthRequest, res: Response) => {
  await ensureLeaderboardSeeds();
  const userId = req.authUser!.userId;
  const { activityType } = req.body as { activityType?: string };

  const validTypes = ["workout", "run_walk", "nutrition_goals", "water_goal", "recovery", "checkin"];
  if (!activityType || !validTypes.includes(activityType)) {
    res.status(400).json({ error: "Invalid activityType" });
    return;
  }

  try {
    const today = utcToday();
    const weekStart = currentWeekStart();
    const cfg = await getPointConfig();
    const pointsToAward = cfg[activityType] ?? 10;

    // Dedup: try to insert the transaction (UNIQUE on user_id, activity_type, date)
    const txResult = await db.execute(sql`
      INSERT INTO point_transactions (user_id, activity_type, points, date)
      VALUES (${userId}, ${activityType}, ${pointsToAward}, ${today})
      ON CONFLICT (user_id, activity_type, date) DO NOTHING
      RETURNING id
    `);
    const isNew = txResult.rows.length > 0;

    // Upsert fp_points
    await db.execute(sql`
      INSERT INTO fp_points (user_id, total, weekly, week_start)
      VALUES (${userId}, 0, 0, ${weekStart})
      ON CONFLICT (user_id) DO NOTHING
    `);
    // Reset weekly if new week
    await db.execute(sql`
      UPDATE fp_points SET weekly = 0, week_start = ${weekStart}
      WHERE user_id = ${userId} AND week_start <> ${weekStart}
    `);
    if (isNew) {
      await db.execute(sql`
        UPDATE fp_points SET total = total + ${pointsToAward}, weekly = weekly + ${pointsToAward}, updated_at = NOW()
        WHERE user_id = ${userId}
      `);
    }

    // ── Streak update ──
    await db.execute(sql`
      INSERT INTO streaks (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING
    `);
    const streakRow = (await db.execute(sql`SELECT * FROM streaks WHERE user_id = ${userId}`)).rows[0] as any;

    let currentStreak = Number(streakRow?.current_streak ?? 0);
    let longestStreak = Number(streakRow?.longest_streak ?? 0);
    const lastDate: string | null = streakRow?.last_activity_date ?? null;

    if (lastDate !== today) {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      if (lastDate === yesterdayStr) {
        currentStreak += 1;
      } else if (lastDate === null || lastDate < yesterdayStr) {
        currentStreak = 1;
      }
      if (currentStreak > longestStreak) longestStreak = currentStreak;

      await db.execute(sql`
        UPDATE streaks SET current_streak = ${currentStreak}, longest_streak = ${longestStreak},
          last_activity_date = ${today}, updated_at = NOW()
        WHERE user_id = ${userId}
      `);

      // Record in streak_history
      await db.execute(sql`
        INSERT INTO streak_history (user_id, date, completed)
        VALUES (${userId}, ${today}, true)
        ON CONFLICT (user_id, date) DO UPDATE SET completed = true
      `);
    }

    // ── Streak milestone bonuses ──
    let bonusAwarded = 0;
    if (isNew) {
      const streakBonusKey7  = `bonus_streak_7_${weekStart}`;
      const streakBonusKey30 = `bonus_streak_30_${weekStart}`;

      if (currentStreak === 7) {
        const b7 = await db.execute(sql`
          INSERT INTO point_transactions (user_id, activity_type, points, date)
          VALUES (${userId}, ${streakBonusKey7}, ${BONUS_STREAK_7}, ${today})
          ON CONFLICT (user_id, activity_type, date) DO NOTHING
          RETURNING id
        `);
        if (b7.rows.length) {
          bonusAwarded += BONUS_STREAK_7;
          await db.execute(sql`
            UPDATE fp_points SET total = total + ${BONUS_STREAK_7}, weekly = weekly + ${BONUS_STREAK_7}
            WHERE user_id = ${userId}
          `);
        }
      }
      if (currentStreak === 30) {
        const b30 = await db.execute(sql`
          INSERT INTO point_transactions (user_id, activity_type, points, date)
          VALUES (${userId}, ${streakBonusKey30}, ${BONUS_STREAK_30}, ${today})
          ON CONFLICT (user_id, activity_type, date) DO NOTHING
          RETURNING id
        `);
        if (b30.rows.length) {
          bonusAwarded += BONUS_STREAK_30;
          await db.execute(sql`
            UPDATE fp_points SET total = total + ${BONUS_STREAK_30}, weekly = weekly + ${BONUS_STREAK_30}
            WHERE user_id = ${userId}
          `);
        }
      }
    }

    // ── Ensure league membership ──
    await ensureLeagueMembership(userId);

    // ── Check achievements ──
    const txCounts = (await db.execute(sql`
      SELECT activity_type, COUNT(*) as cnt FROM point_transactions
      WHERE user_id = ${userId} GROUP BY activity_type
    `)).rows as any[];
    const countOf = (type: string) =>
      Number(txCounts.find((r: any) => r.activity_type === type)?.cnt ?? 0);

    const newAchievements = await checkAchievements(
      userId, currentStreak,
      countOf("workout"), countOf("nutrition_goals"), countOf("recovery"), countOf("water_goal")
    );

    const points = (await db.execute(sql`SELECT * FROM fp_points WHERE user_id = ${userId}`)).rows[0] as any;

    res.json({
      pointsAwarded: isNew ? pointsToAward + bonusAwarded : 0,
      isDuplicate: !isNew,
      streak: { current: currentStreak, longest: longestStreak },
      points: { total: Number(points?.total ?? 0), weekly: Number(points?.weekly ?? 0) },
      newAchievements,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record activity" });
  }
});

// ─── GET /leaderboard/me ─────────────────────────────────────────────────────

router.get("/leaderboard/me", requireAuth, async (req: AuthRequest, res: Response) => {
  await ensureLeaderboardSeeds();
  const userId = req.authUser!.userId;

  try {
    await ensureLeagueMembership(userId);
    const points = await getOrCreatePoints(userId);
    const streak = await getOrCreateStreak(userId);

    // League
    const leagueMembership = (await db.execute(sql`
      SELECT lm.*, l.name, l.tier, l.color, l.emoji
      FROM league_memberships lm
      JOIN leagues l ON l.id = lm.league_id
      WHERE lm.user_id = ${userId}
    `)).rows[0] as any;

    // Rank in league (by weekly points)
    const weekStart = currentWeekStart();
    const leagueRank = (await db.execute(sql`
      SELECT COUNT(*) + 1 as rank FROM fp_points fp
      JOIN league_memberships lm ON lm.user_id = fp.user_id AND lm.league_id = ${leagueMembership?.league_id}
      WHERE fp.weekly > ${Number(points?.weekly ?? 0)}
        AND (fp.week_start = ${weekStart} OR fp.week_start IS NULL)
    `)).rows[0] as any;

    // Global rank (by all-time total)
    const globalRank = (await db.execute(sql`
      SELECT COUNT(*) + 1 as rank FROM fp_points WHERE total > ${Number(points?.total ?? 0)}
    `)).rows[0] as any;

    // Today's completed activities
    const today = utcToday();
    const todayTx = (await db.execute(sql`
      SELECT activity_type FROM point_transactions
      WHERE user_id = ${userId} AND date = ${today}
        AND activity_type IN ('workout','run_walk','nutrition_goals','water_goal','recovery','checkin')
    `)).rows as any[];

    // Achievements
    const achievements = (await db.execute(sql`
      SELECT a.*, ua.earned_at FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      WHERE ua.user_id = ${userId}
      ORDER BY ua.earned_at DESC
    `)).rows;

    // Freeze count
    const freezeCount = Number(
      ((await db.execute(sql`
        SELECT COUNT(*) as cnt FROM streak_freezes WHERE user_id = ${userId} AND used_at IS NULL
      `)).rows[0] as any)?.cnt ?? 0
    );

    // Days active this week
    const daysThisWeek = Number(
      ((await db.execute(sql`
        SELECT COUNT(DISTINCT date) as cnt FROM streak_history
        WHERE user_id = ${userId} AND date >= ${weekStart} AND completed = true
      `)).rows[0] as any)?.cnt ?? 0
    );

    res.json({
      streak: {
        current: Number(streak?.current_streak ?? 0),
        longest: Number(streak?.longest_streak ?? 0),
        lastActivityDate: streak?.last_activity_date ?? null,
        daysThisWeek,
        freezeCount,
      },
      points: {
        total: Number(points?.total ?? 0),
        weekly: Number(points?.weekly ?? 0),
        weekStart,
      },
      league: leagueMembership ? {
        id: Number(leagueMembership.league_id),
        name: leagueMembership.name,
        tier: Number(leagueMembership.tier),
        color: leagueMembership.color,
        emoji: leagueMembership.emoji,
      } : { id: 1, name: "Starter", tier: 1, color: "#9AA3B5", emoji: "⚡" },
      rank: {
        league: Number(leagueRank?.rank ?? 1),
        global: Number(globalRank?.rank ?? 1),
      },
      todayActivities: todayTx.map((r: any) => r.activity_type),
      achievements,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load leaderboard profile" });
  }
});

// ─── GET /leaderboard/global ─────────────────────────────────────────────────

router.get("/leaderboard/global", requireAuth, async (req: AuthRequest, res: Response) => {
  await ensureLeaderboardSeeds();
  const userId = req.authUser!.userId;
  const filter = (req.query.filter as string) ?? "points";

  try {
    let orderCol = "fp.total";
    if (filter === "streak") orderCol = "s.current_streak";
    else if (filter === "workouts") orderCol = "tx.workout_count";
    else if (filter === "weekly") orderCol = "fp.weekly";

    const rows = (await db.execute(sql`
      SELECT
        u.id, u.name,
        COALESCE(fp.total, 0) as total_points,
        COALESCE(fp.weekly, 0) as weekly_points,
        COALESCE(s.current_streak, 0) as streak,
        COALESCE(l.name, 'Starter') as league_name,
        COALESCE(l.color, '#9AA3B5') as league_color,
        COALESCE(l.emoji, '⚡') as league_emoji,
        COALESCE(lp.display_mode, 'first_name') as display_mode,
        lp.display_name as custom_name,
        COALESCE(workout_tx.cnt, 0) as workout_count
      FROM users u
      LEFT JOIN fp_points fp ON fp.user_id = u.id
      LEFT JOIN streaks s ON s.user_id = u.id
      LEFT JOIN league_memberships lm ON lm.user_id = u.id
      LEFT JOIN leagues l ON l.id = lm.league_id
      LEFT JOIN leaderboard_privacy lp ON lp.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as cnt FROM point_transactions
        WHERE activity_type = 'workout' GROUP BY user_id
      ) workout_tx ON workout_tx.user_id = u.id
      WHERE COALESCE(lp.display_mode, 'first_name') != 'private'
        AND u.account_type = 'member'
      ORDER BY COALESCE(fp.total, 0) DESC
      LIMIT 100
    `)).rows as any[];

    const withRank = rows.map((r: any, i: number) => ({
      rank: i + 1,
      userId: Number(r.id),
      displayName: resolveDisplayName(r.name, r.display_mode, r.custom_name),
      isMe: Number(r.id) === userId,
      points: { total: Number(r.total_points), weekly: Number(r.weekly_points) },
      streak: Number(r.streak),
      league: { name: r.league_name, color: r.league_color, emoji: r.league_emoji },
      workoutCount: Number(r.workout_count),
    }));

    res.json({ leaderboard: withRank });
  } catch {
    res.status(500).json({ error: "Failed to load global leaderboard" });
  }
});

// ─── GET /leaderboard/league ─────────────────────────────────────────────────

router.get("/leaderboard/league", requireAuth, async (req: AuthRequest, res: Response) => {
  await ensureLeaderboardSeeds();
  const userId = req.authUser!.userId;

  try {
    await ensureLeagueMembership(userId);
    const myMembership = (await db.execute(sql`
      SELECT league_id FROM league_memberships WHERE user_id = ${userId}
    `)).rows[0] as any;

    const leagueId = myMembership?.league_id ?? 1;
    const weekStart = currentWeekStart();

    const rows = (await db.execute(sql`
      SELECT
        u.id, u.name,
        COALESCE(fp.weekly, 0) as weekly_points,
        COALESCE(fp.total, 0) as total_points,
        COALESCE(s.current_streak, 0) as streak,
        COALESCE(lp.display_mode, 'first_name') as display_mode,
        lp.display_name as custom_name
      FROM league_memberships lm
      JOIN users u ON u.id = lm.user_id
      LEFT JOIN fp_points fp ON fp.user_id = u.id
      LEFT JOIN streaks s ON s.user_id = u.id
      LEFT JOIN leaderboard_privacy lp ON lp.user_id = u.id
      WHERE lm.league_id = ${leagueId}
        AND COALESCE(lp.display_mode, 'first_name') != 'private'
      ORDER BY COALESCE(fp.weekly, 0) DESC
      LIMIT 50
    `)).rows as any[];

    const total = rows.length;
    const promotionCutoff = Math.ceil(total * 0.3);
    const relegationCutoff = Math.floor(total * 0.8);

    const withRank = rows.map((r: any, i: number) => {
      const rank = i + 1;
      let zone: "promotion" | "safe" | "relegation" = "safe";
      if (rank <= promotionCutoff) zone = "promotion";
      else if (rank > relegationCutoff) zone = "relegation";

      return {
        rank,
        userId: Number(r.id),
        displayName: resolveDisplayName(r.name, r.display_mode, r.custom_name),
        isMe: Number(r.id) === userId,
        points: { weekly: Number(r.weekly_points), total: Number(r.total_points) },
        streak: Number(r.streak),
        zone,
      };
    });

    // Points to next rank / promotion zone
    const myEntry = withRank.find((r) => r.isMe);
    const aboveMe = myEntry ? withRank[withRank.indexOf(myEntry) - 1] : null;
    const pointsToAdvance = aboveMe ? Math.max(0, aboveMe.points.weekly - (myEntry?.points.weekly ?? 0) + 1) : 0;

    res.json({
      leaderboard: withRank,
      meta: {
        weekStart,
        promotionCutoff,
        relegationCutoff,
        pointsToAdvance,
        myRank: myEntry?.rank ?? null,
        myZone: myEntry?.zone ?? "safe",
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to load league leaderboard" });
  }
});

// ─── GET /leaderboard/friends ────────────────────────────────────────────────

router.get("/leaderboard/friends", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;

  try {
    const rows = (await db.execute(sql`
      SELECT
        u.id, u.name,
        COALESCE(fp.total, 0) as total_points,
        COALESCE(fp.weekly, 0) as weekly_points,
        COALESCE(s.current_streak, 0) as streak,
        COALESCE(l.name, 'Starter') as league_name,
        COALESCE(l.color, '#9AA3B5') as league_color,
        COALESCE(l.emoji, '⚡') as league_emoji,
        COALESCE(lp.display_mode, 'first_name') as display_mode,
        lp.display_name as custom_name
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      LEFT JOIN fp_points fp ON fp.user_id = u.id
      LEFT JOIN streaks s ON s.user_id = u.id
      LEFT JOIN league_memberships lm ON lm.user_id = u.id
      LEFT JOIN leagues l ON l.id = lm.league_id
      LEFT JOIN leaderboard_privacy lp ON lp.user_id = u.id
      WHERE f.user_id = ${userId} AND f.status = 'accepted'
        AND COALESCE(lp.display_mode, 'first_name') NOT IN ('private', 'friends_only')
      UNION ALL
      SELECT
        u.id, u.name,
        COALESCE(fp.total, 0), COALESCE(fp.weekly, 0),
        COALESCE(s.current_streak, 0),
        COALESCE(l.name, 'Starter'), COALESCE(l.color, '#9AA3B5'), COALESCE(l.emoji, '⚡'),
        'public', NULL
      FROM users u
      LEFT JOIN fp_points fp ON fp.user_id = u.id
      LEFT JOIN streaks s ON s.user_id = u.id
      LEFT JOIN league_memberships lm ON lm.user_id = u.id
      LEFT JOIN leagues l ON l.id = lm.league_id
      WHERE u.id = ${userId}
      ORDER BY total_points DESC
    `)).rows as any[];

    const withRank = rows.map((r: any, i: number) => ({
      rank: i + 1,
      userId: Number(r.id),
      displayName: resolveDisplayName(r.name, r.display_mode, r.custom_name),
      isMe: Number(r.id) === userId,
      points: { total: Number(r.total_points), weekly: Number(r.weekly_points) },
      streak: Number(r.streak),
      league: { name: r.league_name, color: r.league_color, emoji: r.league_emoji },
    }));

    // Pending friend requests
    const pending = (await db.execute(sql`
      SELECT f.id, u.name, u.id as from_user_id
      FROM friendships f JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ${userId} AND f.status = 'pending'
    `)).rows as any[];

    res.json({ leaderboard: withRank, pendingRequests: pending });
  } catch {
    res.status(500).json({ error: "Failed to load friends leaderboard" });
  }
});

// ─── POST /leaderboard/friends ───────────────────────────────────────────────

router.post("/leaderboard/friends", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const { friendEmail } = req.body as { friendEmail?: string };

  if (!friendEmail) { res.status(400).json({ error: "friendEmail required" }); return; }

  try {
    const friend = (await db.execute(sql`
      SELECT id FROM users WHERE email = ${friendEmail.toLowerCase()} AND id != ${userId}
    `)).rows[0] as any;

    if (!friend) { res.status(404).json({ error: "No user found with that email" }); return; }

    await db.execute(sql`
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES (${userId}, ${Number(friend.id)}, 'pending')
      ON CONFLICT (user_id, friend_id) DO NOTHING
    `);

    res.json({ success: true, message: "Friend request sent" });
  } catch {
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

// ─── PUT /leaderboard/friends/:id/accept ─────────────────────────────────────

router.put("/leaderboard/friends/:id/accept", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const fromId = Number(req.params.id);

  try {
    await db.execute(sql`
      UPDATE friendships SET status = 'accepted'
      WHERE user_id = ${fromId} AND friend_id = ${userId} AND status = 'pending'
    `);
    // Create reverse friendship
    await db.execute(sql`
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES (${userId}, ${fromId}, 'accepted')
      ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'
    `);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to accept friend request" });
  }
});

// ─── GET /leaderboard/challenges ─────────────────────────────────────────────

router.get("/leaderboard/challenges", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const today = utcToday();

  try {
    const challenges = (await db.execute(sql`
      SELECT c.*,
        (SELECT COUNT(*) FROM challenge_members cm WHERE cm.challenge_id = c.id) as member_count,
        (SELECT points FROM challenge_members cm WHERE cm.challenge_id = c.id AND cm.user_id = ${userId}) as my_points,
        EXISTS(SELECT 1 FROM challenge_members cm WHERE cm.challenge_id = c.id AND cm.user_id = ${userId}) as is_joined
      FROM challenges c
      WHERE c.status = 'active' AND c.end_date >= ${today}
      ORDER BY c.is_featured DESC, c.start_date ASC
      LIMIT 30
    `)).rows as any[];

    res.json({ challenges: challenges.map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.challenge_type,
      durationDays: Number(c.duration_days),
      startDate: c.start_date,
      endDate: c.end_date,
      memberCount: Number(c.member_count),
      isFeatured: Boolean(c.is_featured),
      isJoined: Boolean(c.is_joined),
      myPoints: Number(c.my_points ?? 0),
      inviteCode: c.invite_code,
    })) });
  } catch {
    res.status(500).json({ error: "Failed to load challenges" });
  }
});

// ─── POST /leaderboard/challenges/:id/join ───────────────────────────────────

router.post("/leaderboard/challenges/:id/join", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const challengeId = req.params.id;

  try {
    await db.execute(sql`
      INSERT INTO challenge_members (challenge_id, user_id)
      VALUES (${challengeId}, ${userId})
      ON CONFLICT (challenge_id, user_id) DO NOTHING
    `);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to join challenge" });
  }
});

// ─── GET /leaderboard/streak ─────────────────────────────────────────────────

router.get("/leaderboard/streak", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;

  try {
    const streak = await getOrCreateStreak(userId);

    // 30-day calendar
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
    const fromDate = thirtyDaysAgo.toISOString().slice(0, 10);

    const historyRows = (await db.execute(sql`
      SELECT date, completed, frozen FROM streak_history
      WHERE user_id = ${userId} AND date >= ${fromDate}
      ORDER BY date ASC
    `)).rows as any[];

    const calendar: Record<string, "completed" | "frozen" | "empty"> = {};
    const today = utcToday();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (29 - i));
      calendar[d.toISOString().slice(0, 10)] = "empty";
    }
    for (const r of historyRows) {
      if (r.frozen) calendar[r.date] = "frozen";
      else if (r.completed) calendar[r.date] = "completed";
    }

    // Next milestone
    const curr = Number(streak?.current_streak ?? 0);
    const milestones = [3, 7, 14, 30, 60, 100, 365];
    const nextMilestone = milestones.find((m) => m > curr) ?? null;

    // Freeze count
    const freezeCount = Number(
      ((await db.execute(sql`
        SELECT COUNT(*) as cnt FROM streak_freezes WHERE user_id = ${userId} AND used_at IS NULL
      `)).rows[0] as any)?.cnt ?? 0
    );

    res.json({
      current: curr,
      longest: Number(streak?.longest_streak ?? 0),
      lastActivityDate: streak?.last_activity_date ?? null,
      nextMilestone,
      daysToMilestone: nextMilestone ? nextMilestone - curr : 0,
      freezeCount,
      calendar,
    });
  } catch {
    res.status(500).json({ error: "Failed to load streak data" });
  }
});

// ─── POST /leaderboard/streak/freeze ─────────────────────────────────────────

router.post("/leaderboard/streak/freeze", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const today = utcToday();

  try {
    // Must have unused freeze
    const freeze = (await db.execute(sql`
      SELECT id FROM streak_freezes WHERE user_id = ${userId} AND used_at IS NULL LIMIT 1
    `)).rows[0] as any;

    if (!freeze) {
      res.status(400).json({ error: "No streak freezes available" });
      return;
    }

    // Mark freeze used
    await db.execute(sql`
      UPDATE streak_freezes SET used_at = NOW(), used_for_date = ${today}
      WHERE id = ${freeze.id}
    `);

    // Record in streak_history as frozen (preserves streak)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    await db.execute(sql`
      INSERT INTO streak_history (user_id, date, completed, frozen)
      VALUES (${userId}, ${yesterdayStr}, false, true)
      ON CONFLICT (user_id, date) DO UPDATE SET frozen = true
    `);

    // Update last_activity_date so streak continues from yesterday
    const streakRow = await getOrCreateStreak(userId);
    const lastDate = streakRow?.last_activity_date;
    if (!lastDate || lastDate < yesterdayStr) {
      await db.execute(sql`
        UPDATE streaks SET last_activity_date = ${yesterdayStr}, updated_at = NOW()
        WHERE user_id = ${userId}
      `);
    }

    res.json({ success: true, message: "Streak Freeze applied for yesterday" });
  } catch {
    res.status(500).json({ error: "Failed to apply Streak Freeze" });
  }
});

// ─── GET/PUT /leaderboard/privacy ────────────────────────────────────────────

router.get("/leaderboard/privacy", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;

  try {
    const row = (await db.execute(sql`
      SELECT * FROM leaderboard_privacy WHERE user_id = ${userId}
    `)).rows[0] as any;

    res.json({
      displayMode: row?.display_mode ?? "first_name",
      displayName: row?.display_name ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to load privacy settings" });
  }
});

router.put("/leaderboard/privacy", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const { displayMode, displayName } = req.body as { displayMode?: string; displayName?: string };

  const validModes = ["public", "first_name", "custom", "anonymous", "friends_only", "private"];
  if (displayMode && !validModes.includes(displayMode)) {
    res.status(400).json({ error: "Invalid displayMode" });
    return;
  }

  try {
    await db.execute(sql`
      INSERT INTO leaderboard_privacy (user_id, display_mode, display_name)
      VALUES (${userId}, ${displayMode ?? "first_name"}, ${displayName ?? null})
      ON CONFLICT (user_id) DO UPDATE SET
        display_mode = EXCLUDED.display_mode,
        display_name = EXCLUDED.display_name,
        updated_at = NOW()
    `);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update privacy settings" });
  }
});

// ─── GET /leaderboard/achievements ───────────────────────────────────────────

router.get("/leaderboard/achievements", requireAuth, async (req: AuthRequest, res: Response) => {
  await ensureLeaderboardSeeds();
  const userId = req.authUser!.userId;

  try {
    const all = (await db.execute(sql`SELECT * FROM achievements ORDER BY category, condition_value`)).rows as any[];
    const earned = new Map(
      ((await db.execute(sql`
        SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ${userId}
      `)).rows as any[]).map((r: any) => [r.achievement_id, r.earned_at])
    );

    res.json({
      achievements: all.map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        icon: a.icon,
        color: a.color,
        category: a.category,
        earned: earned.has(a.id),
        earnedAt: earned.get(a.id) ?? null,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to load achievements" });
  }
});

// ─── GET /leaderboard/point-config (admin) ───────────────────────────────────

router.get("/leaderboard/point-config", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const user = (await db.execute(sql`SELECT account_type FROM users WHERE id = ${userId}`)).rows[0] as any;
  if (user?.account_type !== "owner") { res.status(403).json({ error: "Admin only" }); return; }

  const cfg = await getPointConfig();
  res.json({ config: cfg });
});

router.put("/leaderboard/point-config", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const user = (await db.execute(sql`SELECT account_type FROM users WHERE id = ${userId}`)).rows[0] as any;
  if (user?.account_type !== "owner") { res.status(403).json({ error: "Admin only" }); return; }

  const { config } = req.body as { config?: Record<string, number> };
  if (!config || typeof config !== "object") { res.status(400).json({ error: "config object required" }); return; }

  try {
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "number" && value >= 0) {
        await db.execute(sql`
          INSERT INTO platform_settings (key, value) VALUES (${"points_" + key}, ${String(value)})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `);
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update point config" });
  }
});

// ─── Admin: POST /leaderboard/challenges (create featured challenge) ──────────

router.post("/leaderboard/challenges", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const user = (await db.execute(sql`SELECT account_type FROM users WHERE id = ${userId}`)).rows[0] as any;
  if (!["owner", "coach"].includes(user?.account_type ?? "")) {
    res.status(403).json({ error: "Coaches and admins only" });
    return;
  }

  const { title, description, challengeType, durationDays, startDate } = req.body as any;
  if (!title || !challengeType || !startDate) {
    res.status(400).json({ error: "title, challengeType, and startDate required" });
    return;
  }

  try {
    const duration = Number(durationDays) || 7;
    const start = new Date(startDate);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + duration - 1);

    const id = randomUUID();
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();

    await db.execute(sql`
      INSERT INTO challenges (id, title, description, challenge_type, duration_days, start_date, end_date, created_by, is_featured, invite_code)
      VALUES (${id}, ${title}, ${description ?? ""}, ${challengeType}, ${duration},
        ${start.toISOString().slice(0, 10)}, ${end.toISOString().slice(0, 10)},
        ${userId}, ${user.account_type === "owner"}, ${inviteCode})
    `);

    res.status(201).json({ id, inviteCode });
  } catch {
    res.status(500).json({ error: "Failed to create challenge" });
  }
});

// ─── Admin: grant streak freeze ───────────────────────────────────────────────

router.post("/leaderboard/streak-freeze/grant", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.authUser!.userId;
  const user = (await db.execute(sql`SELECT account_type FROM users WHERE id = ${userId}`)).rows[0] as any;
  if (user?.account_type !== "owner") { res.status(403).json({ error: "Admin only" }); return; }

  const { targetUserId, earnedVia } = req.body as { targetUserId?: number; earnedVia?: string };
  if (!targetUserId) { res.status(400).json({ error: "targetUserId required" }); return; }

  try {
    await db.execute(sql`
      INSERT INTO streak_freezes (user_id, earned_via)
      VALUES (${targetUserId}, ${earnedVia ?? "admin"})
    `);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to grant streak freeze" });
  }
});

export default router;
