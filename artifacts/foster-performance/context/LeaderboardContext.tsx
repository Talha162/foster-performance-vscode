import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType = 'workout' | 'run_walk' | 'nutrition_goals' | 'water_goal' | 'recovery' | 'checkin';

export interface LeaderboardStreak {
  current: number;
  longest: number;
  lastActivityDate: string | null;
  daysThisWeek: number;
  freezeCount: number;
}

export interface LeaderboardPoints {
  total: number;
  weekly: number;
  weekStart: string;
}

export interface LeaderboardLeague {
  id: number;
  name: string;
  tier: number;
  color: string;
  emoji: string;
}

export interface LeaderboardRank {
  league: number;
  global: number;
}

export interface LeaderboardAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  earned: boolean;
  earnedAt: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  displayName: string;
  isMe: boolean;
  points: { total: number; weekly: number };
  streak: number;
  league: { name: string; color: string; emoji: string };
  zone?: 'promotion' | 'safe' | 'relegation';
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: string;
  durationDays: number;
  startDate: string;
  endDate: string;
  memberCount: number;
  isFeatured: boolean;
  isJoined: boolean;
  myPoints: number;
  inviteCode: string | null;
}

export interface LeaderboardProfile {
  streak: LeaderboardStreak;
  points: LeaderboardPoints;
  league: LeaderboardLeague;
  rank: LeaderboardRank;
  todayActivities: ActivityType[];
  achievements: LeaderboardAchievement[];
}

interface LeaderboardContextValue {
  profile: LeaderboardProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  recordActivity: (type: ActivityType) => Promise<{ pointsAwarded: number; newAchievements: string[]; isDuplicate: boolean }>;
  fetchGlobal: (filter?: string) => Promise<LeaderboardEntry[]>;
  fetchLeague: () => Promise<{ leaderboard: LeaderboardEntry[]; meta: any }>;
  fetchFriends: () => Promise<{ leaderboard: LeaderboardEntry[]; pendingRequests: any[] }>;
  fetchChallenges: () => Promise<Challenge[]>;
  fetchAchievements: () => Promise<LeaderboardAchievement[]>;
  fetchStreakDetail: () => Promise<any>;
  addFriend: (email: string) => Promise<void>;
  acceptFriend: (requestId: string) => Promise<void>;
  useStreakFreeze: () => Promise<void>;
  updatePrivacy: (mode: string, customName?: string) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null);

export function useLeaderboard() {
  const ctx = useContext(LeaderboardContext);
  if (!ctx) throw new Error('useLeaderboard must be used inside LeaderboardProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LeaderboardProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<LeaderboardProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  const apiBase = () =>
    process.env.EXPO_PUBLIC_API_BASE ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  const authHeaders = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const resp = await fetch(`${apiBase()}/leaderboard/me`, { headers: authHeaders() });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => null);
      if (mounted.current && data) setProfile(data);
    } catch { /* non-fatal */ } finally {
      if (mounted.current) setLoading(false);
    }
  }, [token, authHeaders]);

  // Load on mount (members only — not coaches/admins)
  useEffect(() => {
    mounted.current = true;
    if (user?.accountType === 'member') refresh();
    return () => { mounted.current = false; };
  }, [token, user?.accountType]);

  const recordActivity = useCallback(async (activityType: ActivityType) => {
    const resp = await fetch(`${apiBase()}/leaderboard/activity`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ activityType }),
    });
    const data = await resp.json().catch(() => ({ pointsAwarded: 0, newAchievements: [], isDuplicate: true }));
    if (resp.ok) refresh();
    return { pointsAwarded: data.pointsAwarded ?? 0, newAchievements: data.newAchievements ?? [], isDuplicate: data.isDuplicate ?? false };
  }, [authHeaders, refresh]);

  const fetchGlobal = useCallback(async (filter = 'points') => {
    const resp = await fetch(`${apiBase()}/leaderboard/global?filter=${filter}`, { headers: authHeaders() });
    const data = await resp.json().catch(() => ({ leaderboard: [] }));
    return data.leaderboard ?? [];
  }, [authHeaders]);

  const fetchLeague = useCallback(async () => {
    const resp = await fetch(`${apiBase()}/leaderboard/league`, { headers: authHeaders() });
    const data = await resp.json().catch(() => ({ leaderboard: [], meta: {} }));
    return { leaderboard: data.leaderboard ?? [], meta: data.meta ?? {} };
  }, [authHeaders]);

  const fetchFriends = useCallback(async () => {
    const resp = await fetch(`${apiBase()}/leaderboard/friends`, { headers: authHeaders() });
    const data = await resp.json().catch(() => ({ leaderboard: [], pendingRequests: [] }));
    return { leaderboard: data.leaderboard ?? [], pendingRequests: data.pendingRequests ?? [] };
  }, [authHeaders]);

  const fetchChallenges = useCallback(async () => {
    const resp = await fetch(`${apiBase()}/leaderboard/challenges`, { headers: authHeaders() });
    const data = await resp.json().catch(() => ({ challenges: [] }));
    return data.challenges ?? [];
  }, [authHeaders]);

  const fetchAchievements = useCallback(async () => {
    const resp = await fetch(`${apiBase()}/leaderboard/achievements`, { headers: authHeaders() });
    const data = await resp.json().catch(() => ({ achievements: [] }));
    return data.achievements ?? [];
  }, [authHeaders]);

  const fetchStreakDetail = useCallback(async () => {
    const resp = await fetch(`${apiBase()}/leaderboard/streak`, { headers: authHeaders() });
    return resp.json().catch(() => null);
  }, [authHeaders]);

  const addFriend = useCallback(async (email: string) => {
    const resp = await fetch(`${apiBase()}/leaderboard/friends`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ friendEmail: email }),
    });
    if (!resp.ok) throw new Error('Could not send friend request');
  }, [authHeaders]);

  const acceptFriend = useCallback(async (requestId: string) => {
    const resp = await fetch(`${apiBase()}/leaderboard/friends/${encodeURIComponent(requestId)}/accept`, {
      method: 'PUT',
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error('Could not accept friend request');
  }, [authHeaders]);

  const useStreakFreeze = useCallback(async () => {
    await fetch(`${apiBase()}/leaderboard/streak/freeze`, { method: 'POST', headers: authHeaders() });
    refresh();
  }, [authHeaders, refresh]);

  const updatePrivacy = useCallback(async (mode: string, customName?: string) => {
    await fetch(`${apiBase()}/leaderboard/privacy`, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify({ displayMode: mode, displayName: customName }),
    });
  }, [authHeaders]);

  return (
    <LeaderboardContext.Provider value={{
      profile, loading, refresh,
      recordActivity, fetchGlobal, fetchLeague, fetchFriends,
      fetchChallenges, fetchAchievements, fetchStreakDetail,
       addFriend, acceptFriend, useStreakFreeze, updatePrivacy,
    }}>
      {children}
    </LeaderboardContext.Provider>
  );
}
