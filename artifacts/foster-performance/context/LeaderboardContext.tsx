import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

export type ActivityType = 'workout' | 'run_walk' | 'nutrition_goals' | 'water_goal' | 'recovery' | 'checkin';
export interface LeaderboardStreak { current: number; longest: number; lastActivityDate: string | null; daysThisWeek: number; freezeCount: number; }
export interface LeaderboardPoints { total: number; weekly: number; weekStart: string; }
export interface LeaderboardLeague { id: number; name: string; tier: number; color: string; emoji: string; }
export interface LeaderboardRank { league: number; global: number; }
export interface LeaderboardAchievement { id: string; title: string; description: string; icon: string; color: string; category: string; earned: boolean; earnedAt: string | null; }
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  isMe: boolean;
  points: { total: number; weekly: number };
  streak: number;
  league: { name: string; color: string; emoji: string };
  zone?: 'promotion' | 'safe' | 'relegation';
}
export interface Challenge {
  id: string; title: string; description: string; type: string; durationDays: number;
  startDate: string; endDate: string; memberCount: number; isFeatured: boolean;
  isJoined: boolean; myPoints: number; inviteCode: string | null;
}
export interface LeaderboardProfile {
  streak: LeaderboardStreak;
  points: LeaderboardPoints;
  league: LeaderboardLeague;
  rank: LeaderboardRank;
  todayActivities: ActivityType[];
  achievements: LeaderboardAchievement[];
}

interface LeaderboardMeta {
  league: LeaderboardLeague;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  from_user_name: string;
  created_at: string;
}

interface StreakDetail {
  streak: LeaderboardStreak | undefined;
  history: Array<{ activity_date: string; activities_count: number }>;
}

interface LeaderboardContextValue {
  profile: LeaderboardProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  recordActivity: (type: ActivityType) => Promise<{ pointsAwarded: number; newAchievements: string[]; isDuplicate: boolean }>;
  fetchGlobal: (filter?: string) => Promise<LeaderboardEntry[]>;
  fetchLeague: () => Promise<{ leaderboard: LeaderboardEntry[]; meta: LeaderboardMeta }>;
  fetchFriends: () => Promise<{ leaderboard: LeaderboardEntry[]; pendingRequests: FriendRequest[] }>;
  fetchChallenges: () => Promise<Challenge[]>;
  fetchAchievements: () => Promise<LeaderboardAchievement[]>;
  fetchStreakDetail: () => Promise<StreakDetail | null>;
  addFriend: (email: string) => Promise<void>;
  acceptFriend: (requestId: string) => Promise<void>;
  useStreakFreeze: () => Promise<void>;
  updatePrivacy: (mode: string, customName?: string) => Promise<void>;
}

const LeaderboardContext = createContext<LeaderboardContextValue | null>(null);
const fallbackLeague: LeaderboardLeague = { id: 1, name: 'Rookie', tier: 1, color: '#9AA3B5', emoji: '⚡' };

export function LeaderboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LeaderboardProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  const fetchAchievements = useCallback(async (): Promise<LeaderboardAchievement[]> => {
    if (!user) return [];
    const [catalog, earned] = await Promise.all([
      supabase.from('achievements').select('*').order('condition_value'),
      supabase.from('user_achievements').select('achievement_id, earned_at').eq('user_id', user.id),
    ]);
    if (catalog.error || earned.error) throw new Error(catalog.error?.message ?? earned.error?.message);
    const earnedMap = new Map((earned.data ?? []).map((row) => [row.achievement_id, row.earned_at]));
    return (catalog.data ?? []).map((row) => ({
      id: row.id, title: row.title, description: row.description, icon: row.icon,
      color: row.color, category: row.category, earned: earnedMap.has(row.id),
      earnedAt: earnedMap.get(row.id) ?? null,
    }));
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const [streakResult, pointsResult, membershipResult, activityResult, freezesResult, achievements] = await Promise.all([
        supabase.from('streaks').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('fp_points').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('league_memberships').select('league:leagues(*)').eq('user_id', user.id).maybeSingle(),
        supabase.from('point_transactions').select('activity_type').eq('user_id', user.id).eq('activity_date', today),
        supabase.from('streak_freezes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('used_at', null),
        fetchAchievements(),
      ]);
      const error = streakResult.error ?? pointsResult.error ?? membershipResult.error ?? activityResult.error ?? freezesResult.error;
      if (error) throw new Error(error.message);
      const globalRows = await fetchLeaderboardRows('total');
      const currentGlobal = globalRows.findIndex((entry) => entry.userId === user.id) + 1;
      const league = ((membershipResult.data as any)?.league ?? fallbackLeague) as LeaderboardLeague;
      const leagueRows = globalRows.filter((entry) => entry.league.name === league.name);
      const currentLeague = leagueRows.findIndex((entry) => entry.userId === user.id) + 1;
      if (mounted.current) setProfile({
        streak: {
          current: streakResult.data?.current_streak ?? 0,
          longest: streakResult.data?.longest_streak ?? 0,
          lastActivityDate: streakResult.data?.last_activity_date ?? null,
          daysThisWeek: 0,
          freezeCount: freezesResult.count ?? 0,
        },
        points: {
          total: pointsResult.data?.total ?? 0,
          weekly: pointsResult.data?.weekly ?? 0,
          weekStart: pointsResult.data?.week_start ?? weekStart.toISOString().slice(0, 10),
        },
        league,
        rank: { global: currentGlobal || globalRows.length + 1, league: currentLeague || leagueRows.length + 1 },
        todayActivities: (activityResult.data ?? []).map((row) => row.activity_type as ActivityType),
        achievements,
      });
    } catch (error) {
      console.error('[LeaderboardContext] Failed to refresh leaderboard:', error);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [fetchAchievements, user]);

  useEffect(() => {
    mounted.current = true;
    if (user?.accountType === 'member') void refresh().catch((error: any) => console.error('[LeaderboardContext] Initial load failed:', error));
    return () => { mounted.current = false; };
  }, [refresh, user?.accountType]);

  const recordActivity = useCallback(async (activityType: ActivityType) => {
    const { data, error } = await supabase.rpc('record_activity', { p_activity_type: activityType });
    if (error) throw new Error(error.message);
    await refresh();
    return data as { pointsAwarded: number; newAchievements: string[]; isDuplicate: boolean };
  }, [refresh]);

  const fetchGlobal = useCallback(async (filter = 'points') => fetchLeaderboardRows(filter === 'weekly' ? 'weekly' : 'total'), []);

  const fetchLeague = useCallback(async () => {
    const all = await fetchLeaderboardRows('weekly');
    const leagueName = profile?.league.name ?? fallbackLeague.name;
    const leaderboard = all.filter((entry) => entry.league.name === leagueName).map((entry, index, rows) => ({
      ...entry,
      rank: index + 1,
      zone: index < 3 ? 'promotion' as const : index >= Math.max(3, rows.length - 3) ? 'relegation' as const : 'safe' as const,
    }));
    return { leaderboard, meta: { league: profile?.league ?? fallbackLeague } };
  }, [profile]);

  const fetchFriends = useCallback(async () => {
    if (!user) return { leaderboard: [], pendingRequests: [] };
    const { data, error } = await supabase.from('friendships').select('*').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (error) throw new Error(error.message);
    const acceptedIds = (data ?? []).filter((row) => row.status === 'accepted').map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id);
    const pendingRequests = (data ?? []).filter((row) => row.status === 'pending' && row.addressee_id === user.id);
    const all = await fetchLeaderboardRows('weekly');
    return { leaderboard: all.filter((entry) => entry.userId === user.id || acceptedIds.includes(entry.userId)), pendingRequests };
  }, [user]);

  const fetchChallenges = useCallback(async () => {
    if (!user) return [];
    const { data, error } = await supabase.from('challenges').select('*, challenge_members(user_id, points)').in('status', ['active', 'completed']).order('start_date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => {
      const mine = row.challenge_members.find((member: any) => member.user_id === user.id);
      return {
        id: row.id, title: row.title, description: row.description ?? '', type: row.challenge_type,
        durationDays: row.duration_days, startDate: row.start_date, endDate: row.end_date,
        memberCount: row.challenge_members.length, isFeatured: row.is_featured,
        isJoined: Boolean(mine), myPoints: mine?.points ?? 0, inviteCode: row.invite_code,
      };
    });
  }, [user]);

  const fetchStreakDetail = useCallback(async () => {
    if (!user) return null;
    const { data, error } = await supabase.from('streak_history').select('*').eq('user_id', user.id).order('activity_date', { ascending: false }).limit(90);
    if (error) throw new Error(error.message);
    return { streak: profile?.streak, history: data ?? [] };
  }, [profile, user]);

  const addFriend = useCallback(async (email: string) => {
    if (!user) return;
    const profileResult = await supabase.from('profiles').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (profileResult.error || !profileResult.data) throw new Error('No Foster Performance member uses that email.');
    const { error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: profileResult.data.id });
    if (error) throw new Error(error.code === '23505' ? 'A friend request already exists.' : error.message);
  }, [user]);

  const acceptFriend = useCallback(async (requestId: string) => {
    const { error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId });
    if (error) throw new Error(error.message);
  }, []);

  const useStreakFreeze = useCallback(async () => {
    if (!user) return;
    const freeze = await supabase.from('streak_freezes').select('id').eq('user_id', user.id).is('used_at', null).limit(1).maybeSingle();
    if (freeze.error || !freeze.data) throw new Error('No streak freeze is available.');
    const { error } = await supabase.from('streak_freezes').update({ used_at: new Date().toISOString(), used_for_date: new Date().toISOString().slice(0, 10) }).eq('id', freeze.data.id);
    if (error) throw new Error(error.message);
    await refresh();
  }, [refresh, user]);

  const updatePrivacy = useCallback(async (display_mode: string, display_name?: string) => {
    if (!user) return;
    const { error } = await supabase.from('leaderboard_privacy').upsert({ user_id: user.id, display_mode, display_name });
    if (error) throw new Error(error.message);
  }, [user]);

  return <LeaderboardContext.Provider value={{
    profile, loading, refresh, recordActivity, fetchGlobal, fetchLeague, fetchFriends,
    fetchChallenges, fetchAchievements, fetchStreakDetail, addFriend, acceptFriend,
    useStreakFreeze, updatePrivacy,
  }}>{children}</LeaderboardContext.Provider>;
}

async function fetchLeaderboardRows(orderColumn: 'total' | 'weekly'): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('fp_points')
    .select('user_id, total, weekly, profile:profiles!fp_points_user_id_fkey(full_name), streak:streaks!streaks_user_id_fkey(current_streak), membership:league_memberships!league_memberships_user_id_fkey(league:leagues(*))')
    .order(orderColumn, { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const { data: authData } = await supabase.auth.getUser();
  return (data ?? []).map((row: any, index) => ({
    rank: index + 1,
    userId: row.user_id,
    displayName: row.profile?.full_name ?? 'Member',
    isMe: row.user_id === authData.user?.id,
    points: { total: row.total, weekly: row.weekly },
    streak: row.streak?.current_streak ?? 0,
    league: row.membership?.league ?? fallbackLeague,
  }));
}

export function useLeaderboard() {
  const context = useContext(LeaderboardContext);
  if (!context) throw new Error('useLeaderboard must be used inside LeaderboardProvider');
  return context;
}
