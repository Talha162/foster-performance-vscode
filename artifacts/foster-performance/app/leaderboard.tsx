import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useLeaderboard, type LeaderboardEntry, type Challenge } from '@/context/LeaderboardContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'league' | 'friends' | 'global' | 'challenges';
type Filter = 'points' | 'streak' | 'workouts' | 'weekly';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'league',     label: 'League',     icon: 'shield-star-outline' },
  { id: 'friends',    label: 'Friends',    icon: 'account-group-outline' },
  { id: 'global',     label: 'Global',     icon: 'earth' },
  { id: 'challenges', label: 'Challenges', icon: 'flag-outline' },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'points',   label: 'FP Points' },
  { id: 'weekly',   label: 'This Week' },
  { id: 'streak',   label: 'Streak' },
  { id: 'workouts', label: 'Workouts' },
];

const CHALLENGE_ICONS: Record<string, string> = {
  workout:   'dumbbell',
  nutrition: 'food-apple-outline',
  hydration: 'water-outline',
  steps:     'walk',
  recovery:  'meditation',
};

// ─── Row Component ─────────────────────────────────────────────────────────────

function RankRow({ entry, showZone }: { entry: LeaderboardEntry; showZone?: boolean }) {
  const colors = useColors();
  const zoneColor = entry.zone === 'promotion' ? colors.success : entry.zone === 'relegation' ? '#FF5050' : 'transparent';
  return (
    <View style={[
      styles.row,
      {
        backgroundColor: entry.isMe ? colors.primary + '18' : colors.card,
        borderColor: entry.isMe ? colors.primary + '66' : colors.border,
      },
    ]}>
      {showZone && (
        <View style={[styles.zoneBar, { backgroundColor: zoneColor }]} />
      )}
      <Text style={[styles.rankNum, { color: entry.rank <= 3 ? '#D6A84B' : colors.mutedForeground }]}>
        {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
      </Text>
      <View style={styles.rowInfo}>
        <View style={styles.rowNameRow}>
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
            {entry.displayName}
            {entry.isMe && <Text style={{ color: colors.primary }}> (you)</Text>}
          </Text>
          <Text style={{ fontSize: 13 }}>{entry.league.emoji}</Text>
        </View>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowMetaText, { color: colors.mutedForeground }]}>
            {entry.points.weekly.toLocaleString()} pts this week
          </Text>
          {entry.streak > 0 && (
            <Text style={[styles.rowMetaText, { color: '#FF6B35' }]}>
              🔥 {entry.streak}
            </Text>
          )}
        </View>
      </View>
      <Text style={[styles.rowTotal, { color: colors.primary }]}>
        {entry.points.total.toLocaleString()}
      </Text>
    </View>
  );
}

// ─── Challenge Card ─────────────────────────────────────────────────────────────

function ChallengeCard({ challenge, onJoin }: { challenge: Challenge; onJoin: (id: string) => void }) {
  const colors = useColors();
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onJoin(challenge.id); }}
      style={({ pressed }) => [
        styles.challengeCard,
        { backgroundColor: colors.card, borderColor: challenge.isFeatured ? '#D6A84B66' : colors.border, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      {challenge.isFeatured && (
        <View style={[styles.featuredBadge, { backgroundColor: '#D6A84B22' }]}>
          <MaterialCommunityIcons name="star" size={10} color="#D6A84B" />
          <Text style={[styles.featuredText, { color: '#D6A84B' }]}>FEATURED</Text>
        </View>
      )}
      <View style={styles.challengeTop}>
        <View style={[styles.challengeIcon, { backgroundColor: colors.primary + '22' }]}>
          <MaterialCommunityIcons name={(CHALLENGE_ICONS[challenge.type] ?? 'flag') as any} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.challengeTitle, { color: colors.foreground }]} numberOfLines={1}>{challenge.title}</Text>
          <Text style={[styles.challengeSub, { color: colors.mutedForeground }]} numberOfLines={2}>{challenge.description}</Text>
        </View>
      </View>
      <View style={[styles.challengeMeta, { borderTopColor: colors.border }]}>
        <View style={styles.challengeStatItem}>
          <MaterialCommunityIcons name="account-group-outline" size={13} color={colors.mutedForeground} />
          <Text style={[styles.challengeStatText, { color: colors.mutedForeground }]}>{challenge.memberCount} members</Text>
        </View>
        <View style={styles.challengeStatItem}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={colors.mutedForeground} />
          <Text style={[styles.challengeStatText, { color: colors.mutedForeground }]}>{daysLeft}d left</Text>
        </View>
        {challenge.isJoined ? (
          <View style={[styles.joinedBadge, { backgroundColor: colors.success + '22' }]}>
            <Feather name="check" size={11} color={colors.success} />
            <Text style={[styles.joinedText, { color: colors.success }]}>Joined</Text>
          </View>
        ) : (
          <View style={[styles.joinBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.joinBtnText}>Join</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, fetchGlobal, fetchLeague, fetchFriends, fetchChallenges, addFriend, acceptFriend } = useLeaderboard();
  const { user } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>('league');
  const [filter, setFilter] = useState<Filter>('points');
  const [leagueData, setLeagueData] = useState<{ leaderboard: LeaderboardEntry[]; meta: any } | null>(null);
  const [globalData, setGlobalData] = useState<LeaderboardEntry[]>([]);
  const [friendsData, setFriendsData] = useState<{ leaderboard: LeaderboardEntry[]; pendingRequests: any[] } | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendMsg, setFriendMsg] = useState('');
  const [acceptingRequest, setAcceptingRequest] = useState<string | null>(null);

  const loadTab = useCallback(async (tab: Tab, f?: Filter) => {
    setLoadingTab(true);
    try {
      if (tab === 'league') {
        const data = await fetchLeague();
        setLeagueData(data);
      } else if (tab === 'global') {
        const data = await fetchGlobal(f ?? filter);
        setGlobalData(data);
      } else if (tab === 'friends') {
        const data = await fetchFriends();
        setFriendsData(data);
      } else if (tab === 'challenges') {
        const data = await fetchChallenges();
        setChallenges(data);
      }
    } catch { /* non-fatal */ } finally {
      setLoadingTab(false);
    }
  }, [fetchLeague, fetchGlobal, fetchFriends, fetchChallenges, filter]);

  useEffect(() => { loadTab(activeTab); }, [activeTab]);

  const switchFilter = (f: Filter) => {
    setFilter(f);
    loadTab('global', f);
  };

  const handleAddFriend = async () => {
    if (!friendEmail.trim()) return;
    setAddingFriend(true);
    setFriendMsg('');
    try {
      await addFriend(friendEmail.trim());
      setFriendMsg('Friend request sent!');
      setFriendEmail('');
      loadTab('friends');
    } catch {
      setFriendMsg('Could not send request. Check the email and try again.');
    } finally {
      setAddingFriend(false);
    }
  };

  const handleJoinChallenge = useCallback(async (challengeId: string) => {
    if (!user) return;
    const { error } = await supabase.from('challenge_members').upsert({ challenge_id: challengeId, user_id: user.id });
    if (error) throw error;
    loadTab('challenges');
  }, [loadTab, user]);

  const handleAcceptFriend = async (requestId: string) => {
    setAcceptingRequest(requestId);
    try {
      await acceptFriend(requestId);
      await loadTab('friends');
    } catch {
      setFriendMsg('Could not accept this request. Please try again.');
    } finally {
      setAcceptingRequest(null);
    }
  };

  // Motivational message based on league position
  const motivationalMessage = (() => {
    if (!leagueData?.meta || !profile) return null;
    const { myRank, myZone, pointsToAdvance } = leagueData.meta;
    if (myZone === 'promotion') return "🎉 You're in the promotion zone — keep it up!";
    if (myZone === 'relegation') return "💪 A few more points today will keep you safe!";
    if (pointsToAdvance > 0) return `You're ${pointsToAdvance} pts away from the promotion zone.`;
    return null;
  })();

  const league = profile?.league;

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Leaderboard</Text>
          {league && (
            <Text style={[styles.subtitle, { color: league.color }]}>
              {league.emoji} {league.name} League
            </Text>
          )}
        </View>
        {profile && (
          <View style={styles.myStats}>
            <Text style={[styles.myStatValue, { color: '#FF6B35' }]}>🔥{profile.streak.current}</Text>
            <Text style={[styles.myStatValue, { color: colors.primary }]}>
              {profile.points.weekly.toLocaleString()} pts
            </Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab.id); }}
              style={[styles.tabBtn, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <MaterialCommunityIcons name={tab.icon as any} size={16} color={active ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 20 }]}>

        {/* Global filter row */}
        {activeTab === 'global' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); switchFilter(f.id); }}
                style={[styles.filterChip, { backgroundColor: filter === f.id ? colors.primary : colors.card, borderColor: filter === f.id ? colors.primary : colors.border }]}
              >
                <Text style={[styles.filterChipText, { color: filter === f.id ? '#FFF' : colors.mutedForeground }]}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* League zone legend */}
        {activeTab === 'league' && leagueData && (
          <View style={[styles.zoneLegend, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: 'Promotion Zone — top 30%', color: colors.success },
              { label: 'Safe Zone',                color: colors.mutedForeground },
              { label: 'Relegation Zone — bottom 20%', color: '#FF5050' },
            ].map((z) => (
              <View key={z.label} style={styles.zoneLegendRow}>
                <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
                <Text style={[styles.zoneLegendText, { color: colors.mutedForeground }]}>{z.label}</Text>
              </View>
            ))}
            {motivationalMessage && (
              <Text style={[styles.motivMsg, { color: colors.primary }]}>{motivationalMessage}</Text>
            )}
          </View>
        )}

        {/* Loading */}
        {loadingTab && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}

        {/* League leaderboard */}
        {activeTab === 'league' && !loadingTab && leagueData && (
          <View style={styles.list}>
            {leagueData.leaderboard.map((entry) => (
              <RankRow key={entry.userId} entry={entry} showZone />
            ))}
            {leagueData.leaderboard.length === 0 && (
              <EmptyState icon="shield-star-outline" message="No members in your league yet.\nComplete an activity to get started!" colors={colors} />
            )}
          </View>
        )}

        {/* Global leaderboard */}
        {activeTab === 'global' && !loadingTab && (
          <View style={styles.list}>
            {globalData.map((entry) => (
              <RankRow key={entry.userId} entry={entry} />
            ))}
            {globalData.length === 0 && (
              <EmptyState icon="earth" message="No global rankings yet.\nBe the first to complete an activity!" colors={colors} />
            )}
          </View>
        )}

        {/* Friends leaderboard */}
        {activeTab === 'friends' && !loadingTab && (
          <View style={{ gap: 16 }}>
            {/* Add friend */}
            <View style={[styles.addFriendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.addFriendTitle, { color: colors.foreground }]}>Add a Friend</Text>
              <Text style={[styles.addFriendSub, { color: colors.mutedForeground }]}>Enter their email address to send a friend request.</Text>
              <View style={styles.addFriendRow}>
                <TextInput
                  style={[styles.addFriendInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="friend@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={friendEmail}
                  onChangeText={setFriendEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={handleAddFriend}
                  disabled={addingFriend || !friendEmail.trim()}
                  style={({ pressed }) => [styles.addFriendBtn, { backgroundColor: colors.primary, opacity: pressed || addingFriend ? 0.7 : 1 }]}
                >
                  {addingFriend ? <ActivityIndicator color="#FFF" size="small" /> : <Feather name="user-plus" size={16} color="#FFF" />}
                </Pressable>
              </View>
              {!!friendMsg && <Text style={[styles.friendMsg, { color: friendMsg.includes('!') ? colors.success : '#FF5050' }]}>{friendMsg}</Text>}
            </View>

            {/* Pending requests */}
            {(friendsData?.pendingRequests ?? []).length > 0 && (
              <View style={[styles.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.pendingTitle, { color: colors.foreground }]}>Pending Requests</Text>
                {friendsData!.pendingRequests.map((r: any) => (
                  <View key={r.id} style={styles.pendingRow}>
                    <Text style={[styles.pendingName, { color: colors.foreground }]}>{r.name}</Text>
                    <Pressable
                      onPress={() => handleAcceptFriend(String(r.id))}
                      disabled={acceptingRequest === String(r.id)}
                      style={({ pressed }) => [styles.acceptBtn, { backgroundColor: colors.primary, opacity: acceptingRequest === String(r.id) || pressed ? 0.7 : 1 }]}
                    >
                      {acceptingRequest === String(r.id) ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.acceptBtnText}>Accept</Text>}
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.list}>
              {(friendsData?.leaderboard ?? []).map((entry) => (
                <RankRow key={entry.userId} entry={entry} />
              ))}
              {(friendsData?.leaderboard ?? []).length === 0 && (
                <EmptyState icon="account-group-outline" message="Add friends to compete together!" colors={colors} />
              )}
            </View>
          </View>
        )}

        {/* Challenges */}
        {activeTab === 'challenges' && !loadingTab && (
          <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 12 }}>
            {challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} onJoin={handleJoinChallenge} />
            ))}
            {challenges.length === 0 && (
              <EmptyState icon="flag-outline" message="No active challenges right now.\nCheck back soon for new ones!" colors={colors} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function EmptyState({ icon, message, colors }: { icon: string; message: string; colors: any }) {
  return (
    <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon as any} size={36} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{message}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
  myStats: { alignItems: 'flex-end', gap: 2 },
  myStatValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },

  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  filterRow: { flexGrow: 0 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  scroll: { paddingTop: 12 },
  list: { gap: 8, paddingHorizontal: 16, paddingTop: 4 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 12,
    overflow: 'hidden',
  },
  zoneBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  rankNum: { fontSize: 15, fontFamily: 'Inter_700Bold', width: 36, textAlign: 'center' },
  rowInfo: { flex: 1, gap: 3 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  rowTotal: { fontSize: 15, fontFamily: 'Inter_700Bold' },

  zoneLegend: {
    marginHorizontal: 16, marginBottom: 10, padding: 12,
    borderRadius: 12, borderWidth: 1, gap: 6,
  },
  zoneLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneLegendText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  motivMsg: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 4 },

  challengeCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  featuredText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  challengeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  challengeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  challengeTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', lineHeight: 20 },
  challengeSub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  challengeMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  challengeStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  challengeStatText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  joinedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  joinedText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  joinBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  joinBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFF' },

  addFriendCard: { margin: 16, padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  addFriendTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  addFriendSub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  addFriendRow: { flexDirection: 'row', gap: 8 },
  addFriendInput: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, fontFamily: 'Inter_400Regular',
  },
  addFriendBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  friendMsg: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  pendingCard: { marginHorizontal: 16, padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  pendingTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  acceptBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  acceptBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFF' },

  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10, margin: 16 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
