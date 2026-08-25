/**
 * Coaches marketplace tab — merges AppContext (curated) coaches with
 * API-approved coaches fetched from /coaches.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useApp, Coach } from '@/context/AppContext';
import { CoachCard } from '@/components/CoachCard';

// ─── API helpers ──────────────────────────────────────────────────────────────

const getApiBase = () =>
  process.env.EXPO_PUBLIC_API_BASE ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const COACH_COLORS = ['#2F80FF', '#9C27B0', '#35C98A', '#FF6B35', '#00BCD4', '#E91E8C'];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return COACH_COLORS[Math.abs(h) % COACH_COLORS.length];
}

function inferCoachType(specialties: string[], services: string[]): Coach['coachType'] {
  const all = [...specialties, ...services].join(' ').toLowerCase();
  if (all.includes('nutrition') || all.includes('diet')) return 'nutrition';
  if (all.includes('strength') || all.includes('lifting') || all.includes('power')) return 'strength';
  if (all.includes('speed') || all.includes('cardio') || all.includes('running')) return 'speed';
  if (all.includes('rehab') || all.includes('injury') || all.includes('mobility')) return 'rehab';
  return 'personal';
}

function normalizeApiCoach(raw: any): Coach {
  const nameParts = (raw.name as string).split(' ');
  const initials = nameParts.map((p: string) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
  // weeklyAvailability is normalised to { days, activeTimes, sessionDurationMins } by the API
  const avail = (raw.weeklyAvailability?.days ?? {}) as Record<string, boolean>;
  const dayLabels: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
    Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };
  const availability = Object.keys(avail)
    .filter((d) => avail[d])
    .map((d) => dayLabels[d] ?? d);

  const prices = raw.prices as { session30?: number | null; session60?: number | null } ?? {};

  return {
    id: raw.id as string,                    // already "api_N"
    name: raw.name,
    title: raw.title || 'Certified Coach',
    bio: raw.bio || '',
    initials,
    color: hashColor(raw.id),
    isPremium: false,
    rating: 4.9,
    clients: 0,
    experience: Number(raw.experienceYears) || 1,
    coachType: inferCoachType(raw.specialties ?? [], raw.services ?? []),
    specialties: (raw.specialties as string[]) ?? [],
    specialty: ((raw.specialties as string[]) ?? [])[0] ?? '',
    credentials: raw.certifications
      ? String(raw.certifications).split(/,\s*/).filter(Boolean)
      : [],
    availability: availability.length ? availability : ['Mon', 'Wed', 'Fri'],
    session30Price: prices.session30 ?? 55,
    session60Price: prices.session60 ?? 90,
    reviews: [],
  } as Coach;
}

// ─── Filter chips ─────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { label: 'All Coaches',       value: 'all' },
  { label: 'Personal Training', value: 'personal' },
  { label: 'Speed & Cardio',    value: 'speed' },
  { label: 'Strength',          value: 'strength' },
  { label: 'Nutrition',         value: 'nutrition' },
  { label: 'Rehab',             value: 'rehab' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CoachesTabScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { coaches: localCoaches } = useApp();
  const [apiCoaches, setApiCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 : insets.bottom + 84;

  // ── Fetch approved coaches from API ───────────────────────────────────────
  const fetchApiCoaches = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${getApiBase()}/coaches`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const normalized = (data.coaches as any[]).map(normalizeApiCoach);
      setApiCoaches(normalized);
    } catch {
      // silently fall back to local-only coaches
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApiCoaches(); }, [fetchApiCoaches]);

  // ── Merge: API coaches first (newest), then local curated ─────────────────
  const allCoaches: Coach[] = [
    ...apiCoaches,
    // Exclude any local coaches whose IDs collide with API coaches (unlikely but safe)
    ...localCoaches.filter((lc) => !apiCoaches.some((ac) => ac.id === lc.id)),
  ];

  const filtered =
    filter === 'all' ? allCoaches : allCoaches.filter((c) => c.coachType === filter);

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Coaches</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Book live 1-on-1 sessions with certified coaches
          </Text>
        </View>
        {loading && <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginRight: 8 }} />}
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fetchApiCoaches(); }}
          style={[styles.refreshBtn, { borderColor: colors.border }]}
        >
          <Feather name="refresh-cw" size={15} color={colors.primary} />
        </Pressable>
      </View>

      {/* Live session banner */}
      <View style={[styles.banner, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
        <MaterialCommunityIcons name="video" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Live Video Sessions</Text>
          <Text style={[styles.bannerSub, { color: colors.mutedForeground }]}>
            Book a real-time coaching session from anywhere
          </Text>
        </View>
        {apiCoaches.length > 0 && (
          <View style={[styles.livePill, { backgroundColor: '#35C98A22', borderColor: '#35C98A55' }]}>
            <View style={[styles.liveDot, { backgroundColor: '#35C98A' }]} />
            <Text style={[styles.livePillText, { color: '#35C98A' }]}>{apiCoaches.length} live</Text>
          </View>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {TYPE_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilter(f.value); }}
            style={[
              styles.chip,
              {
                backgroundColor: filter === f.value ? colors.primary : colors.card,
                borderColor: filter === f.value ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: filter === f.value ? colors.primaryForeground : colors.mutedForeground }]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Coach list */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.list, { paddingBottom: botPad }]}>
        {/* API coaches section header */}
        {apiCoaches.length > 0 && (filter === 'all' || apiCoaches.some((c) => c.coachType === filter)) && (
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.sectionDot, { backgroundColor: '#35C98A' }]} />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Verified Coaches</Text>
          </View>
        )}

        {/* Show API coaches */}
        {(filter === 'all' ? apiCoaches : apiCoaches.filter((c) => c.coachType === filter)).map((coach) => (
          <CoachCard
            key={coach.id}
            coach={coach}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/coach/${encodeURIComponent(coach.id)}`); }}
          />
        ))}

        {/* Curated coaches section header */}
        {localCoaches.length > 0 && (
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border, marginTop: apiCoaches.length > 0 ? 8 : 0 }]}>
            <View style={[styles.sectionDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Foster Coaches</Text>
          </View>
        )}

        {/* Show local/curated coaches */}
        {(filter === 'all' ? localCoaches : localCoaches.filter((c) => c.coachType === filter)).map((coach) => (
          <CoachCard
            key={coach.id}
            coach={coach}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/coach/${coach.id}`); }}
          />
        ))}

        {filtered.length === 0 && (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="account-search" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No coaches in this category yet
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20,
    paddingBottom: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  refreshBtn: { padding: 8, borderRadius: 10, borderWidth: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, padding: 12, borderRadius: 14, borderWidth: 1 },
  bannerTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  bannerSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  livePillText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottomWidth: 1, marginBottom: 8 },
  sectionDot: { width: 7, height: 7, borderRadius: 3.5 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, textTransform: 'uppercase' },
  empty: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
