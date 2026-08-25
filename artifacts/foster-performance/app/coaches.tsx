import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useApp } from '@/context/AppContext';
import { Coach } from '@/context/AppContext';

const TYPE_FILTERS = [
  { label: 'All Coaches', value: 'all' },
  { label: 'Personal Training', value: 'personal' },
  { label: 'Speed & Cardio', value: 'speed' },
  { label: 'Strength', value: 'strength' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'Rehab', value: 'rehab' },
];

const TYPE_ICONS: Record<string, string> = {
  position: 'account-star',
  speed: 'run-fast',
  strength: 'dumbbell',
  nutrition: 'food-apple',
  rehab: 'bandage',
};

export default function CoachesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { coaches } = useApp();
  const [filter, setFilter] = useState('all');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const filtered = filter === 'all' ? coaches : coaches.filter((c) => c.coachType === filter);

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>1-on-1 Pro Coaching</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Live sessions with certified personal coaches
          </Text>
        </View>
      </View>

      {/* Private Coaching Banner */}
      <View style={[styles.coachingBanner, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
        <MaterialCommunityIcons name="video" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Live Video Sessions</Text>
          <Text style={[styles.bannerSub, { color: colors.mutedForeground }]}>
            30 or 60 minutes · Billed per session · Separate from Pro membership
          </Text>
        </View>
      </View>

      {/* Type filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {TYPE_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilter(f.value);
            }}
            style={[
              styles.filterPill,
              {
                backgroundColor: filter === f.value ? colors.primary : colors.card,
                borderColor: filter === f.value ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f.value ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 50 : 40 }]}
      >
        {filtered.map((coach) => (
          <CoachListCard
            key={coach.id}
            coach={coach}
            onPress={() => router.push(`/coach/${coach.id}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function CoachListCard({ coach, onPress }: { coach: Coach; onPress: () => void }) {
  const colors = useColors();
  const typeIcon = TYPE_ICONS[coach.coachType] ?? 'account';

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {/* Color bar */}
      <View style={[styles.cardBar, { backgroundColor: coach.color }]} />

      <View style={styles.cardInner}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: coach.color + '22' }]}>
          <Text style={[styles.avatarText, { color: coach.color }]}>{coach.initials}</Text>
          {coach.isPremium && (
            <View style={[styles.premiumDot, { backgroundColor: colors.accent }]}>
              <MaterialCommunityIcons name="crown" size={8} color={colors.accentForeground} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.coachName, { color: colors.foreground }]}>{coach.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: coach.color + '18', borderColor: coach.color + '44' }]}>
              <MaterialCommunityIcons name={typeIcon as any} size={11} color={coach.color} />
              <Text style={[styles.typeBadgeText, { color: coach.color }]}>
                {coach.coachType.charAt(0).toUpperCase() + coach.coachType.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={[styles.coachTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {coach.title}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="star" size={12} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{coach.rating}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <MaterialCommunityIcons name="account-group" size={12} color={colors.mutedForeground} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{coach.clients} clients</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <MaterialCommunityIcons name="clock-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{coach.experience} yrs</Text>
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.pricingRow}>
            <View style={[styles.pricePill, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>30 min</Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>${coach.session30Price}</Text>
            </View>
            <View style={[styles.pricePill, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>60 min</Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>${coach.session60Price}</Text>
            </View>
            <View style={styles.availChips}>
              {coach.availability.slice(0, 3).map((day) => (
                <View key={day} style={[styles.dayChip, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.dayChipText, { color: colors.mutedForeground }]}>{day}</Text>
                </View>
              ))}
              {coach.availability.length > 3 && (
                <Text style={[styles.moreAvail, { color: colors.mutedForeground }]}>
                  +{coach.availability.length - 3}
                </Text>
              )}
            </View>
          </View>
        </View>

        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  coachingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    marginBottom: 0,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  bannerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardBar: { width: 4 },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  premiumDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachName: { flex: 1, fontSize: 15, fontFamily: 'Inter_700Bold' },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  coachTitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  statDivider: { width: 1, height: 10 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  priceLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  priceValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  availChips: { flex: 1, flexDirection: 'row', gap: 3, justifyContent: 'flex-end' },
  dayChip: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  dayChipText: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  moreAvail: { fontSize: 10, fontFamily: 'Inter_400Regular', alignSelf: 'center' },
});
