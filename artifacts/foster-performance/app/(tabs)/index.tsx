import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { PremiumBanner } from '@/components/PremiumBanner';
import { useLeaderboard } from '@/context/LeaderboardContext';

// ─── Animation hook ──────────────────────────────────────────────────────────

function useFadeSlide(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(22)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statPill,
        {
          backgroundColor: accent ? colors.primary : colors.card,
          borderColor: accent ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.statPillIcon}>{icon}</View>
      <Text
        style={[
          styles.statPillValue,
          { color: accent ? '#FFFFFF' : colors.foreground },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statPillLabel,
          { color: accent ? 'rgba(255,255,255,0.75)' : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Nav card ─────────────────────────────────────────────────────────────────

function NavCard({
  iconName,
  label,
  sub,
  color,
  locked,
  onPress,
}: {
  iconName: string;
  label: string;
  sub: string;
  color: string;
  locked?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.navCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      {/* Top row: icon + lock */}
      <View style={styles.navCardTop}>
        <View style={[styles.navIconCircle, { backgroundColor: color + '20' }]}>
          <MaterialCommunityIcons name={iconName as any} size={24} color={color} />
        </View>
        {locked && (
          <View style={[styles.navLockBadge, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="lock" size={9} color="#0A0A0A" />
          </View>
        )}
      </View>
      {/* Labels */}
      <Text style={[styles.navCardLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <Text style={[styles.navCardSub, { color: colors.mutedForeground }]}>
        {sub}
      </Text>
      {/* Bottom arrow */}
      <View style={[styles.navArrowRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.navArrowText, { color: color }]}>Open</Text>
        <MaterialCommunityIcons name="arrow-right" size={13} color={color} />
      </View>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { workoutPrograms, workoutLogs, activeWorkoutId } = useApp();
  const { profile: lbProfile } = useLeaderboard();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const activeProgram = workoutPrograms.find((p) => p.id === activeWorkoutId);

  // Recommended program: matched to the user's selected goal
  const GOAL_TYPE_MAP: Record<string, string[]> = {
    'Lose Weight':            ['fitness'],
    'Gain Weight':            ['fitness', 'strength'],
    'Build Muscle':           ['fitness', 'strength'],
    'Build Strength':         ['strength'],
    'Improve Overall Fitness':['fitness'],
    'Improve Health':         ['fitness', 'recovery'],
    'Increase Mobility':      ['recovery'],
    'Increase Flexibility':   ['recovery'],
    'Improve Endurance':      ['running'],
    'Running':                ['running'],
    'Walking':                ['running'],
    'Cross-Training':         ['fitness'],
    'Functional Fitness':     ['fitness', 'strength'],
    'General Wellness':       ['recovery', 'fitness'],
  };

  const recommendedProgram = useMemo(() => {
    if (user?.goal) {
      const types = GOAL_TYPE_MAP[user.goal] ?? [];
      return workoutPrograms.find(
        (p) => types.includes(p.trainingType) && p.id !== activeWorkoutId
      ) ?? null;
    }
    return workoutPrograms.find((p) => p.id !== activeWorkoutId) ?? null;
  }, [activeWorkoutId, user?.goal, workoutPrograms]);

  const recommendedLabel = user?.goal ? `Based on your goal` : 'Recommended for you';

  const { thisWeekLogs, recentLogs, totalDone, progressPercent, progressWeek } = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = workoutLogs.filter((l) => new Date(l.completedAt) >= weekAgo);
    const total = user?.totalWorkouts ?? workoutLogs.length;
    const completed = activeProgram
      ? workoutLogs.filter((log) => log.programId === activeProgram.id).length
      : 0;
    const weeks = activeProgram?.weeks ?? 0;
    const targetSessions = weeks > 0 ? Math.max(1, weeks * activeProgram!.daysPerWeek) : 1;
    const percent = activeProgram ? Math.min(100, Math.round((completed / targetSessions) * 100)) : 0;
    return {
      thisWeekLogs: thisWeek,
      recentLogs: workoutLogs.slice(0, 3),
      totalDone: Math.max(0, total),
      progressPercent: percent,
      progressWeek: activeProgram ? Math.min(activeProgram.weeks || 1, Math.max(1, Math.ceil((completed + 1) / activeProgram.daysPerWeek))) : 0,
    };
  }, [activeProgram, user?.totalWorkouts, workoutLogs]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  const todayLabel = (() => {
    const g = user?.goal;
    if (g === 'Lose Weight')             return "Today's Fat Loss Workout";
    if (g === 'Gain Weight')             return "Today's Mass Building Session";
    if (g === 'Build Muscle')            return "Today's Muscle Building Session";
    if (g === 'Build Strength')          return "Today's Strength Session";
    if (g === 'Improve Overall Fitness') return "Today's Fitness Session";
    if (g === 'Improve Health')          return "Today's Health Session";
    if (g === 'Increase Mobility')       return "Today's Mobility Session";
    if (g === 'Increase Flexibility')    return "Today's Flexibility Session";
    if (g === 'Improve Endurance')       return "Today's Endurance Session";
    if (g === 'Running')                 return "Today's Run";
    if (g === 'Walking')                 return "Today's Walk";
    if (g === 'Cross-Training')          return "Today's Cross-Training Session";
    if (g === 'Functional Fitness')      return "Today's Functional Session";
    if (g === 'General Wellness')        return "Today's Wellness Session";
    return "Today's Workout";
  })();

  const firstName = user?.name?.split(' ')[0] ?? 'Friend';

  // Staggered entrance animations
  const anim0 = useFadeSlide(0);    // header
  const anim1 = useFadeSlide(90);   // stats
  const anim2 = useFadeSlide(180);  // today's workout
  const anim3 = useFadeSlide(270);  // training hub
  const anim4 = useFadeSlide(360);  // bottom sections

  return (
    <View style={styles.root}>
      <BackgroundLayer />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
          anim0,
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {greeting}
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {firstName} 👊
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/subscription');
          }}
          style={({ pressed }) => [
            styles.premiumChip,
            {
              backgroundColor: user?.isPremium
                ? colors.accent
                : 'rgba(47,128,255,0.10)',
              borderColor: user?.isPremium ? colors.accent : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="crown"
            size={12}
            color={user?.isPremium ? '#0A0A0A' : colors.primary}
          />
          <Text
            style={[
              styles.premiumChipText,
              { color: user?.isPremium ? '#0A0A0A' : colors.primary },
            ]}
          >
            {user?.isPremium ? 'PREMIUM' : 'UPGRADE'}
          </Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === 'web' ? 110 : 110 },
        ]}
      >
        {/* ── Hero Banner ─────────────────────────────────────────────── */}
        <Animated.View style={[styles.heroBannerWrapper, anim1]}>
          <ImageBackground
            source={require('@/assets/images/hero-banner.jpg')}
            style={styles.heroBanner}
            resizeMode="cover"
          >
            <View style={styles.heroBannerOverlay} />
            <Text style={styles.heroBannerText}>FOSTER PERFORMANCE</Text>
          </ImageBackground>
        </Animated.View>

        {/* ── Stat Strip ─────────────────────────────────────────────── */}
        <Animated.View style={[styles.section, anim1]}>
          <View style={styles.statRow}>
            <StatPill
              accent
              icon={
                <MaterialCommunityIcons name="fire" size={16} color="#FFFFFF" />
              }
              value={user?.streakDays ?? 0}
              label="Day Streak"
            />
            <StatPill
              icon={
                <MaterialCommunityIcons
                  name="dumbbell"
                  size={16}
                  color={colors.primary}
                />
              }
              value={thisWeekLogs.length}
              label="This Week"
            />
            <StatPill
              icon={
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={16}
                  color={colors.success}
                />
              }
              value={totalDone}
              label="Total Done"
            />
          </View>
        </Animated.View>

        {/* ── Recommended for You ─────────────────────────────────────── */}
        {recommendedProgram && (
          <Animated.View style={[styles.section, anim2]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                Recommended for You
              </Text>
              <View style={[styles.positionBadge, { backgroundColor: recommendedProgram.imageColor + '22', borderColor: recommendedProgram.imageColor }]}>
                <Text style={[styles.positionBadgeText, { color: recommendedProgram.imageColor }]}>
                  {user?.goal ? user.goal.split(' ').slice(0, 2).join(' ') : 'Recommended'}
                </Text>
              </View>
            </View>
            <Text style={[styles.recommendedSub, { color: colors.mutedForeground }]}>
              {recommendedLabel}
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(`/workout/${recommendedProgram.id}`);
              }}
              style={({ pressed }) => [
                styles.recommendedCard,
                {
                  backgroundColor: colors.card,
                  borderColor: recommendedProgram.imageColor,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={[styles.recommendedAccentBar, { backgroundColor: recommendedProgram.imageColor }]} />
              <View style={styles.recommendedBody}>
                <View style={styles.recommendedTop}>
                  <View style={[styles.recommendedIconCircle, { backgroundColor: recommendedProgram.imageColor + '22' }]}>
                    <MaterialCommunityIcons name="star" size={16} color={recommendedProgram.imageColor} />
                  </View>
                  <Text style={[styles.recommendedTag, { color: recommendedProgram.imageColor }]}>
                    RECOMMENDED
                  </Text>
                </View>
                <Text style={[styles.recommendedTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {recommendedProgram.title}
                </Text>
                <View style={styles.workoutMetaRow}>
                  {[
                    { icon: 'calendar-outline', text: `${recommendedProgram.weeks}w` },
                    { icon: 'lightning-bolt', text: `${recommendedProgram.daysPerWeek}x/week` },
                    { icon: 'signal', text: recommendedProgram.level },
                  ].map((m) => (
                    <View key={m.icon} style={styles.metaChip}>
                      <MaterialCommunityIcons name={m.icon as any} size={12} color={colors.mutedForeground} />
                      <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>{m.text}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.recommendedCta, { borderTopColor: colors.border }]}>
                  <Text style={[styles.recommendedCtaText, { color: recommendedProgram.imageColor }]}>View Program</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color={recommendedProgram.imageColor} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Today's Workout ─────────────────────────────────────────── */}
        <Animated.View style={[styles.section, anim2]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {todayLabel}
          </Text>

          {activeProgram ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(`/workout/${activeProgram.id}`);
              }}
              style={({ pressed }) => [
                styles.workoutHeroCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              {/* Color accent bar */}
              <View
                style={[
                  styles.workoutAccentBar,
                  { backgroundColor: activeProgram.imageColor },
                ]}
              />
              <View style={styles.workoutHeroBody}>
                {/* Top row */}
                <View style={styles.workoutHeroTop}>
                  <View style={styles.workoutHeroMeta}>
                    <View
                      style={[
                        styles.activeDot,
                        { backgroundColor: colors.success },
                      ]}
                    />
                    <Text
                      style={[
                        styles.workoutHeroTag,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      ACTIVE PROGRAM
                    </Text>
                  </View>
                  {/* Play button */}
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push(`/workout/${activeProgram.id}`);
                    }}
                    style={[
                      styles.playBtn,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="play"
                      size={20}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>

                {/* Program title */}
                <Text
                  style={[
                    styles.workoutHeroTitle,
                    { color: colors.foreground },
                  ]}
                  numberOfLines={2}
                >
                  {activeProgram.title}
                </Text>

                {/* Meta row */}
                <View style={styles.workoutMetaRow}>
                  {[
                    {
                      icon: 'calendar-outline',
                      text: `${activeProgram.weeks}w`,
                    },
                    {
                      icon: 'lightning-bolt',
                      text: `${activeProgram.daysPerWeek}x/week`,
                    },
                    { icon: 'signal', text: activeProgram.level },
                    {
                      icon: 'human-male-female',
                      text: activeProgram.subcategory ?? activeProgram.category,
                    },
                  ].map((m) => (
                    <View key={m.icon} style={styles.metaChip}>
                      <MaterialCommunityIcons
                        name={m.icon as any}
                        size={12}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.metaChipText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {m.text}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Progress bar */}
                <View style={styles.progressSection}>
                  <View
                    style={[
                      styles.progressBg,
                      { backgroundColor: colors.secondary },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: colors.primary,
                          width: `${progressPercent}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.progressLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {activeProgram.weeks > 0
                      ? `Week ${progressWeek} of ${activeProgram.weeks} · ${progressPercent}% complete`
                      : `${progressPercent}% complete`}
                  </Text>
                </View>

                {/* Next exercises preview */}
                <View
                  style={[
                    styles.exercisesPreview,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.exercisesLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    NEXT UP
                  </Text>
                  {activeProgram.exercises.slice(0, 2).map((ex) => (
                    <View key={ex.id} style={styles.exerciseRow}>
                      <View
                        style={[
                          styles.exerciseDot,
                          { backgroundColor: activeProgram.imageColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.exerciseName,
                          { color: colors.foreground },
                        ]}
                      >
                        {ex.name}
                      </Text>
                      <Text
                        style={[
                          styles.exerciseDetail,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {ex.sets} × {ex.reps}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Pressable>
          ) : (
            /* No active program — CTA card */
            <Pressable
              onPress={() => router.push({ pathname: '/(tabs)/workouts', params: { tab: 'fitness' } })}
              style={({ pressed }) => [
                styles.startProgramCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.startProgramIcon,
                  { backgroundColor: 'rgba(47,128,255,0.14)' },
                ]}
              >
                <MaterialCommunityIcons
                  name="dumbbell"
                  size={32}
                  color={colors.primary}
                />
              </View>
              <Text
                style={[styles.startProgramTitle, { color: colors.foreground }]}
              >
                Start Your First Program
              </Text>
              <Text
                style={[
                  styles.startProgramSub,
                  { color: colors.mutedForeground },
                ]}
              >
                Choose from dozens of programs matched to your goal
              </Text>
              <View
                style={[
                  styles.startProgramBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.startProgramBtnText}>Browse Programs</Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={16}
                  color="#FFF"
                />
              </View>
            </Pressable>
          )}
        </Animated.View>

        {/* ── Training Hub ─────────────────────────────────────────────── */}
        <Animated.View style={[styles.section, anim3]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Training Hub
          </Text>
          <View style={styles.navGrid}>
            <NavCard
              iconName="heart-pulse"
              label="Fitness"
              sub="Weight loss, muscle, HIIT & more"
              color="#FF6B35"
              onPress={() => router.push({ pathname: '/(tabs)/workouts', params: { tab: 'strength' } })}
            />
            <NavCard
              iconName="dumbbell"
              label="Strength"
              sub="Lifting, powerlifting & Olympic"
              color="#9C27B0"
              onPress={() => router.push({ pathname: '/(tabs)/workouts', params: { tab: 'cardio', filter: 'Running' } })}
            />
            <NavCard
              iconName="run-fast"
              label="Running"
              sub="5K to marathon & sprint training"
              color="#35C98A"
              onPress={() => router.push({ pathname: '/(tabs)/workouts', params: { tab: 'cardio' } })}
            />
            <NavCard
              iconName="walk"
              label="Cardio"
              sub="Running, walking & cross-training"
              color={colors.primary}
              onPress={() => router.push({ pathname: '/(tabs)/workouts', params: { tab: 'recovery' } })}
            />
            <NavCard
              iconName="heart-plus"
              label="Recovery"
              sub="Mobility, stretching & rehab"
              color="#00BCD4"
              onPress={() => router.push('/(tabs)/workouts')}
            />
            <NavCard
              iconName="food-apple-outline"
              label="Nutrition"
              sub="Goal-matched meal plans"
              color={colors.accent}
              onPress={() => {
                try { router.navigate('/(tabs)/nutrition'); } catch { router.push('/(tabs)/nutrition'); }
              }}
            />
          </View>
        </Animated.View>

        {/* ── Bottom sections ───────────────────────────────────────────── */}
        <Animated.View style={anim4}>
          {/* Premium Banner */}
          {!user?.isPremium && (
            <View style={styles.section}>
              <PremiumBanner />
            </View>
          )}

          {/* Become a Coach CTA — members only */}
          {user?.accountType === 'member' && (
            <View style={styles.section}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/become-coach-intro');
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row' as const,
                  alignItems: 'center' as const,
                  gap: 14,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: 'rgba(214,168,75,0.5)',
                  backgroundColor: 'rgba(214,168,75,0.08)',
                  padding: 18,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(214,168,75,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name="whistle" size={26} color="#D6A84B" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#D6A84B' }}>
                    Become a Coach
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9AA3B5', lineHeight: 17 }}>
                    Earn income coaching members 1-on-1 on your schedule
                  </Text>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#D6A84B" />
              </Pressable>
            </View>
          )}

          {/* ── Leaderboard Card ─────────────────────────────────────────── */}
          {lbProfile && (
            <View style={styles.section}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  try { router.push('/leaderboard'); } catch { /* ignore */ }
                }}
                style={({ pressed }) => [
                  styles.lbCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: lbProfile.league.color + '55',
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                {/* accent bar */}
                <View style={[styles.lbAccent, { backgroundColor: lbProfile.league.color }]} />
                <View style={styles.lbBody}>
                  {/* top row */}
                  <View style={styles.lbTopRow}>
                    <Text style={[styles.lbLeague, { color: lbProfile.league.color }]}>
                      {lbProfile.league.emoji} {lbProfile.league.name} League
                    </Text>
                    <View style={styles.lbRankBadge}>
                      <Text style={[styles.lbRankText, { color: colors.primary }]}>#{lbProfile.rank.league}</Text>
                    </View>
                  </View>
                  {/* stats row */}
                  <View style={styles.lbStatsRow}>
                    <View style={styles.lbStat}>
                      <Text style={[styles.lbStatValue, { color: '#FF6B35' }]}>🔥 {lbProfile.streak.current}</Text>
                      <Text style={[styles.lbStatLabel, { color: colors.mutedForeground }]}>Streak</Text>
                    </View>
                    <View style={[styles.lbStatDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.lbStat}>
                      <Text style={[styles.lbStatValue, { color: colors.primary }]}>{lbProfile.points.weekly.toLocaleString()}</Text>
                      <Text style={[styles.lbStatLabel, { color: colors.mutedForeground }]}>Weekly pts</Text>
                    </View>
                    <View style={[styles.lbStatDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.lbStat}>
                      <Text style={[styles.lbStatValue, { color: colors.accent }]}>{lbProfile.points.total.toLocaleString()}</Text>
                      <Text style={[styles.lbStatLabel, { color: colors.mutedForeground }]}>FP Points</Text>
                    </View>
                  </View>
                  {/* cta */}
                  <View style={[styles.lbCta, { borderTopColor: colors.border }]}>
                    <Text style={[styles.lbCtaText, { color: lbProfile.league.color }]}>View Leaderboard</Text>
                    <MaterialCommunityIcons name="arrow-right" size={14} color={lbProfile.league.color} />
                  </View>
                </View>
              </Pressable>
            </View>
          )}

          {/* Find a Coach */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Find a Coach</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                try { router.navigate('/(tabs)/coaches'); } catch { router.push('/(tabs)/coaches'); }
              }}
              style={({ pressed }) => ({
                flexDirection: 'row' as const,
                alignItems: 'center' as const,
                gap: 14,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: 'rgba(47,128,255,0.45)',
                backgroundColor: 'rgba(47,128,255,0.08)',
                padding: 18,
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(47,128,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="account-search-outline" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                  Browse Coaches
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, lineHeight: 17 }}>
                  Book 1-on-1 sessions with certified coaches
                </Text>
              </View>
              <MaterialCommunityIcons name="arrow-right" size={20} color={colors.primary} />
            </Pressable>
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: colors.foreground }]}
            >
              Recent Activity
            </Text>
            {recentLogs.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="dumbbell"
                  size={30}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: colors.foreground },
                  ]}
                >
                  No sessions yet
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Complete your first workout to see your history here.
                </Text>
              </View>
            ) : (
              recentLogs.map((log, i) => {
                const prog = workoutPrograms.find(
                  (p) => p.id === log.programId
                );
                return (
                  <View
                    key={i}
                    style={[
                      styles.logRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.logColorDot,
                        {
                          backgroundColor:
                            prog?.imageColor ?? colors.primary,
                        },
                      ]}
                    />
                    <View style={styles.logInfo}>
                      <Text
                        style={[
                          styles.logTitle,
                          { color: colors.foreground },
                        ]}
                      >
                        {prog?.title ?? 'Workout Session'}
                      </Text>
                      <Text
                        style={[
                          styles.logDate,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {new Date(log.completedAt).toLocaleDateString(
                          undefined,
                          { weekday: 'short', month: 'short', day: 'numeric' }
                        )}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={18}
                      color={colors.success}
                    />
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { gap: 1 },
  greeting: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  name: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  premiumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  premiumChipText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },

  // Hero banner
  heroBannerWrapper: { marginHorizontal: -18, marginTop: -22, marginBottom: 22 },
  heroBanner: {
    height: 160,
    justifyContent: 'flex-end',
    padding: 18,
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroBannerText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2.5,
    opacity: 0.9,
  },

  // Scroll
  scroll: { paddingHorizontal: 18, paddingTop: 22, gap: 0 },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginBottom: 14,
    letterSpacing: 0.2,
  },

  // Stat strip
  statRow: { flexDirection: 'row', gap: 10 },
  statPill: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 3,
  },
  statPillIcon: { marginBottom: 2 },
  statPillValue: { fontSize: 22, fontFamily: 'Inter_700Bold', lineHeight: 26 },
  statPillLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },

  // Section header row
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  positionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  positionBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  recommendedSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 14,
  },
  recommendedCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  recommendedAccentBar: { width: 4 },
  recommendedBody: { flex: 1, padding: 14, gap: 8 },
  recommendedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  recommendedIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedTag: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  recommendedTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
  },
  recommendedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 2,
  },
  recommendedCtaText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },

  // Today's workout hero card
  workoutHeroCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  workoutAccentBar: { width: 5 },
  workoutHeroBody: { flex: 1, padding: 16, gap: 10 },
  workoutHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutHeroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  workoutHeroTag: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutHeroTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    lineHeight: 26,
  },
  workoutMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  metaChipText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  progressSection: { gap: 6 },
  progressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  exercisesPreview: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 8,
  },
  exercisesLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseDot: { width: 6, height: 6, borderRadius: 3 },
  exerciseName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  exerciseDetail: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  // Start program CTA (no active program)
  startProgramCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  startProgramIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  startProgramTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  startProgramSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  startProgramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  startProgramBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },

  // Training hub nav grid
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  navCard: {
    width: '47.5%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  navCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  navIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLockBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCardLabel: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    lineHeight: 18,
  },
  navCardSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 15,
  },
  navArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 4,
  },
  navArrowText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Empty state
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },

  // Leaderboard card
  lbCard: {
    borderRadius: 18, borderWidth: 1.5,
    overflow: 'hidden', flexDirection: 'row',
  },
  lbAccent: { width: 4 },
  lbBody: { flex: 1, padding: 14, gap: 10 },
  lbTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lbLeague: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  lbRankBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: 'rgba(47,128,255,0.12)' },
  lbRankText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  lbStatsRow: { flexDirection: 'row', alignItems: 'center' },
  lbStat: { flex: 1, alignItems: 'center', gap: 2 },
  lbStatDivider: { width: 1, height: 30, alignSelf: 'center' },
  lbStatValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  lbStatLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  lbCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2,
  },
  lbCtaText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Recent activity
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 13,
    borderWidth: 1,
    padding: 13,
    marginBottom: 8,
  },
  logColorDot: { width: 10, height: 10, borderRadius: 5 },
  logInfo: { flex: 1, gap: 2 },
  logTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  logDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
