import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useApp, WorkoutProgram } from '@/context/AppContext';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'fitness',   label: 'Fitness',   icon: 'heart-pulse',  color: '#FF6B35' },
  { key: 'strength',  label: 'Strength',  icon: 'dumbbell',     color: '#9C27B0' },
  { key: 'cardio',    label: 'Cardio',    icon: 'run-fast',     color: '#35C98A' },
  { key: 'recovery',  label: 'Recovery',  icon: 'heart-plus',   color: '#00BCD4' },
] as const;

type TabKey = typeof TABS[number]['key'];

const TAB_KEYS = new Set<TabKey>(TABS.map((tab) => tab.key));
const normalizeLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const isTabKey = (value: string): value is TabKey => TAB_KEYS.has(value as TabKey);

const TAB_CHIPS: Record<TabKey, string[]> = {
  fitness:  ['All', 'Beginner Programs', 'Weight Loss', 'Muscle Building', 'HIIT', 'Functional Fitness', 'Home Workouts', 'Gym Workouts'],
  strength: ['All', 'Weightlifting', 'Functional Strength', 'Powerlifting', 'Olympic Lifting', 'Strength & Conditioning'],
  cardio:   ['All', 'Running', 'Walking', 'Cross-Training', 'Beginner Running', '5K', '10K', 'Half Marathon', 'Marathon'],
  recovery: ['All', 'Mobility', 'Stretching', 'Foam Rolling', 'Recovery Sessions', 'Injury Prevention'],
};

const TAB_DESC: Record<TabKey, string> = {
  fitness:  'Beginner programs, weight loss, muscle building, HIIT, and functional fitness',
  strength: 'Weightlifting, functional strength, powerlifting, and Olympic lifting',
  cardio:   'Running plans, walking programs, cross-training, and endurance workouts',
  recovery: 'Mobility flows, stretching, foam rolling, and active recovery sessions',
};

const LEVEL_COLORS: Record<string, string> = {
  Beginner: '#35C98A', Intermediate: '#2F80FF', Advanced: '#FF6B35',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetaPill({
  icon, label, colors,
}: {
  icon: string; label: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.metaPill, { backgroundColor: colors.muted }]}>
      <MaterialCommunityIcons name={icon as any} size={10} color={colors.mutedForeground} />
      <Text style={[styles.metaPillText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ProgramCard({
  program, isActive, colors,
}: {
  program: WorkoutProgram; isActive: boolean; colors: ReturnType<typeof useColors>;
}) {
  const levelColor = LEVEL_COLORS[program.level] ?? colors.primary;
  const moduleCount = program.modules?.length ?? 0;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push(`/workout/${program.id}`);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? program.imageColor : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.cardAccent, { backgroundColor: program.imageColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.cardTags}>
            {program.isPremium && (
              <View style={[styles.premiumTag, { backgroundColor: colors.accent }]}>
                <MaterialCommunityIcons name="crown" size={9} color={colors.accentForeground} />
                <Text style={[styles.premiumTagText, { color: colors.accentForeground }]}>PRO</Text>
              </View>
            )}
            {isActive && (
              <View style={[styles.activeTag, { backgroundColor: colors.success + '22', borderColor: colors.success }]}>
                <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.activeTagText, { color: colors.success }]}>ACTIVE</Text>
              </View>
            )}
            <View style={[styles.levelTag, { backgroundColor: levelColor + '18' }]}>
              <Text style={[styles.levelTagText, { color: levelColor }]}>{program.level}</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>

        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {program.title}
        </Text>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {program.description}
        </Text>

        <View style={styles.cardMeta}>
          <MetaPill icon="clock-outline" label={`${program.duration}m`} colors={colors} />
          <MetaPill icon="calendar-range" label={program.weeks > 0 ? `${program.weeks}wk` : 'Ongoing'} colors={colors} />
          <MetaPill icon="lightning-bolt" label={`${program.daysPerWeek}×/wk`} colors={colors} />
          {moduleCount > 0 && (
            <MetaPill icon="view-module" label={`${moduleCount} modules`} colors={colors} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function WorkoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { workoutPrograms, activeWorkoutId } = useApp();
  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const requestedTab = typeof params.tab === 'string' ? params.tab.toLowerCase() : '';
  const requestedFilter = typeof params.filter === 'string' ? params.filter : '';
  const initialTab = isTabKey(requestedTab) ? requestedTab : 'fitness';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [filters, setFilters] = useState<Record<TabKey, string>>({
    fitness: 'All', strength: 'All', cardio: 'All', recovery: 'All',
  });

  useEffect(() => {
    if (!isTabKey(requestedTab)) return;
    setActiveTab(requestedTab);
    if (requestedFilter && TAB_CHIPS[requestedTab].some((chip) => normalizeLabel(chip) === normalizeLabel(requestedFilter))) {
      const filter = TAB_CHIPS[requestedTab].find((chip) => normalizeLabel(chip) === normalizeLabel(requestedFilter)) ?? 'All';
      setFilters((prev) => ({ ...prev, [requestedTab]: filter }));
    }
  }, [requestedTab, requestedFilter]);

  const currentTab = TABS.find((t) => t.key === activeTab)!;
  const currentFilter = filters[activeTab];
  const chips = TAB_CHIPS[activeTab];

  const getPrograms = (tab: TabKey, filter: string) => {
    const normalizedFilter = normalizeLabel(filter);
    const matchesFilter = (p: WorkoutProgram) => {
      if (filter === 'All') return true;
      const subcategory = normalizeLabel(p.subcategory ?? '');
      const trainingType = normalizeLabel(p.trainingType);
      return subcategory === normalizedFilter
        || subcategory.includes(normalizedFilter)
        || normalizedFilter.includes(subcategory)
        || trainingType === normalizedFilter
        || (normalizedFilter === 'crosstraining' && trainingType === 'crosstraining');
    };
    switch (tab) {
      case 'fitness':
        return workoutPrograms.filter((p) => p.trainingType === 'fitness' && matchesFilter(p));
      case 'strength':
        return workoutPrograms.filter((p) => p.trainingType === 'strength' && matchesFilter(p));
      case 'cardio':
        return workoutPrograms.filter(
          (p) =>
            (p.trainingType === 'running' || (p as any).trainingType === 'walking' || (p as any).trainingType === 'crosstraining') &&
            matchesFilter(p)
        );
      case 'recovery':
        return workoutPrograms.filter((p) => p.trainingType === 'recovery' && matchesFilter(p));
      default:
        return [];
    }
  };

  const displayed = useMemo(() => getPrograms(activeTab, currentFilter), [activeTab, currentFilter, workoutPrograms]);

  const setFilter = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilters((prev) => ({ ...prev, [activeTab]: value }));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.headerIcon, { backgroundColor: currentTab.color + '20' }]}>
            <MaterialCommunityIcons name={currentTab.icon as any} size={20} color={currentTab.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Training Library</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {workoutPrograms.length} programs · {TABS.length} categories
            </Text>
          </View>
        </View>

        {/* ── Category Tab Row ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          style={styles.tabsScroll}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.key);
                }}
                style={[
                  styles.tabBtn,
                  {
                    borderColor: active ? tab.color : colors.border,
                    backgroundColor: active ? tab.color + '18' : colors.card,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={13}
                  color={active ? tab.color : colors.mutedForeground}
                />
                <Text style={[styles.tabBtnText, { color: active ? tab.color : colors.mutedForeground }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Filter Chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={[styles.chipsScroll, { borderBottomColor: colors.border }]}
      >
        {chips.map((chip) => {
          const active = currentFilter === chip;
          return (
            <Pressable
              key={chip}
              onPress={() => setFilter(chip)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? currentTab.color : colors.card,
                  borderColor: active ? currentTab.color : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.mutedForeground }]}>
                {chip}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
      >
        {/* Tab description */}
        <View style={[styles.tabDesc, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name={currentTab.icon as any} size={13} color={currentTab.color} />
          <Text style={[styles.tabDescText, { color: colors.mutedForeground }]}>
            {currentFilter === 'All'
              ? `${displayed.length} ${currentTab.label.toLowerCase()} program${displayed.length !== 1 ? 's' : ''} — select a category to filter`
              : `${displayed.length} program${displayed.length !== 1 ? 's' : ''} · ${currentFilter}`}
          </Text>
        </View>

        {displayed.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No programs found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {currentFilter === 'All'
                ? 'More programs are coming soon for this category.'
                : 'Try selecting a different filter or browse all programs.'}
            </Text>
          </View>
        ) : (
          displayed.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              isActive={program.id === activeWorkoutId}
              colors={colors}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },

  // Category tabs
  tabsScroll: { marginHorizontal: -16 },
  tabsRow: { paddingHorizontal: 16, gap: 8 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  tabBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  // Filter chips
  chipsScroll: { borderBottomWidth: 1 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  // Content
  content: { padding: 12 },
  tabDesc: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12,
  },
  tabDescText: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 },

  // Program card
  card: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden',
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 12, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  premiumTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
  },
  premiumTagText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  activeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1,
  },
  activeDot: { width: 5, height: 5, borderRadius: 3 },
  activeTagText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  levelTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  levelTagText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', lineHeight: 20 },
  cardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  cardMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  metaPillText: { fontSize: 10, fontFamily: 'Inter_500Medium' },

  // Empty state
  emptyState: {
    borderRadius: 14, borderWidth: 1, padding: 32,
    alignItems: 'center', gap: 8, marginTop: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
