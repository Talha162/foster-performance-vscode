import React, { useState } from 'react';
import {
  Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { ScreenState } from '@/components/ScreenState';
import { TargetMuscleAvatar, TargetMuscleMap } from '@/components/TargetMuscleAvatar';
import { useApp, TrainingModule } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

const LEVEL_COLORS: Record<string, string> = {
  Beginner: '#35C98A',
  Intermediate: '#2F80FF',
  Advanced: '#FF6B35',
  College: '#9C27B0',
  Professional: '#D6A84B',
};

const DAY_TYPE_COLORS: Record<string, string> = {
  strength: '#2F80FF',
  speed: '#D6A84B',
  skill: '#9C27B0',
  conditioning: '#35C98A',
  recovery: '#607D8B',
  rest: '#2A3040',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.heroBadge}>
      <MaterialCommunityIcons name={icon as any} size={12} color="rgba(255,255,255,0.85)" />
      <Text style={styles.heroBadgeText}>{label}</Text>
    </View>
  );
}

function ModuleCard({
  module,
  accent,
  colors,
}: {
  module: TrainingModule;
  accent: string;
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.moduleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded((v) => !v);
        }}
        style={styles.moduleHeader}
      >
        <View style={[styles.moduleIconWrap, { backgroundColor: accent + '20' }]}>
          <MaterialCommunityIcons name={module.icon as any} size={16} color={accent} />
        </View>
        <View style={styles.moduleInfo}>
          <Text style={[styles.moduleTitle, { color: colors.foreground }]}>{module.title}</Text>
          <Text style={[styles.moduleFocus, { color: colors.mutedForeground }]}>{module.focus}</Text>
        </View>
        <View style={[styles.moduleDrillCount, { backgroundColor: colors.muted }]}>
          <Text style={[styles.moduleDrillCountText, { color: colors.mutedForeground }]}>
            {module.drills.length} drills
          </Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>

      {expanded && (
        <View style={[styles.moduleDrills, { borderTopColor: colors.border }]}>
          {/* Coach note */}
          <View style={[styles.coachNoteInline, { backgroundColor: accent + '10', borderColor: accent + '25' }]}>
            <MaterialCommunityIcons name="whistle" size={12} color={accent} />
            <Text style={[styles.coachNoteInlineText, { color: colors.mutedForeground }]}>
              {module.coachNote}
            </Text>
          </View>

          {module.drills.map((drill, i) => (
            <View
              key={drill.id}
              style={[
                styles.drillRow,
                { borderBottomColor: colors.border },
                i === module.drills.length - 1 && styles.drillRowLast,
              ]}
            >
              <View style={[styles.drillNum, { backgroundColor: accent + '18' }]}>
                <Text style={[styles.drillNumText, { color: accent }]}>{i + 1}</Text>
              </View>
              <View style={styles.drillInfo}>
                <Text style={[styles.drillName, { color: colors.foreground }]}>{drill.name}</Text>
                {drill.notes && (
                  <Text style={[styles.drillNotes, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {drill.notes}
                  </Text>
                )}
              </View>
              <View style={styles.drillStats}>
                <DrillStat label="Sets" value={String(drill.sets)} colors={colors} />
                <DrillStat label="Reps" value={drill.reps} colors={colors} />
                <DrillStat label="Rest" value={drill.rest} colors={colors} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DrillStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.drillStat}>
      <Text style={[styles.drillStatVal, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.drillStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function ExerciseRow({
  exercise,
  index,
  accent,
  colors,
}: {
  exercise: any;
  index: number;
  accent: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.exRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.exMain}>
        <View style={[styles.exNum, { backgroundColor: accent + '20' }]}>
          <Text style={[styles.exNumText, { color: accent }]}>{index + 1}</Text>
        </View>
        <TargetMuscleAvatar muscleGroup={exercise.muscleGroup} size={38} accent={accent} showLabel={false} />
        <View style={styles.exInfo}>
          <Text style={[styles.exName, { color: colors.foreground }]}>{exercise.name}</Text>
          <View style={styles.exMeta}>
            <Text style={[styles.exMuscle, { color: accent }]}>{exercise.muscleGroup}</Text>
            {exercise.weight && (
              <>
                <View style={[styles.exDot, { backgroundColor: colors.mutedForeground }]} />
                <MaterialCommunityIcons name="dumbbell" size={10} color={colors.mutedForeground} />
                <Text style={[styles.exMuscle, { color: colors.mutedForeground }]}>{exercise.weight}</Text>
              </>
            )}
            {exercise.distance && (
              <>
                <View style={[styles.exDot, { backgroundColor: colors.mutedForeground }]} />
                <MaterialCommunityIcons name="map-marker-distance" size={10} color={colors.mutedForeground} />
                <Text style={[styles.exMuscle, { color: colors.mutedForeground }]}>{exercise.distance}</Text>
              </>
            )}
          </View>
          {exercise.notes && (
            <Text style={[styles.exNotes, { color: colors.mutedForeground }]} numberOfLines={3}>
              {exercise.notes}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.exStats, { backgroundColor: colors.muted }]}>
        <ExStat label="sets" value={String(exercise.sets)} colors={colors} />
        <View style={[styles.exDiv, { backgroundColor: colors.border }]} />
        <ExStat label="reps" value={exercise.reps} colors={colors} />
        <View style={[styles.exDiv, { backgroundColor: colors.border }]} />
        <ExStat label="rest" value={exercise.rest} colors={colors} />
      </View>
    </View>
  );
}

function ExStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.exStat}>
      <Text style={[styles.exStatVal, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.exStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workoutPrograms, activeWorkoutId, setActiveWorkout } = useApp();
  const { user } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const program = workoutPrograms.find((p) => p.id === id);

  if (!program) {
    return (
      <ScreenState
        icon="dumbbell"
        title="Program not found"
        message="This training program is no longer available. Browse the library to choose another one."
        onBack={() => router.back()}
        actionLabel="Browse Programs"
        onAction={() => router.replace('/(tabs)/workouts')}
      />
    );
  }

  const isActive = activeWorkoutId === program.id;
  const isLocked = program.isPremium && !user?.isPremium;
  const levelColor = LEVEL_COLORS[program.level] ?? colors.primary;
  const accent = program.imageColor;

  const handleCTA = () => {
    if (isLocked) { router.push('/subscription'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (isActive) {
      router.push(`/workout-session/${program.id}` as any);
      return;
    }
    Alert.alert(
      'Start this program?',
      `${program.title} will become your active program. You can pause or leave it later from the program schedule.`,
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Start Program', onPress: () => { setActiveWorkout(program.id); router.push(`/workout-session/${program.id}` as any); } },
      ]
    );
  };

  const hasModules = (program.modules?.length ?? 0) > 0;
  const hasSchedule = (program.weeklySchedule?.length ?? 0) > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />

      {/* ── Hero ── */}
      <View style={[styles.hero, { paddingTop: topPad }]}>
        {/* Accent gradient bar */}
        <View style={[styles.heroBg, { backgroundColor: accent }]} />
        <View style={styles.heroOverlay} />

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.heroContent}>
          <View style={styles.heroTags}>
            {program.isPremium && (
              <View style={[styles.premiumTag, { backgroundColor: colors.accent }]}>
                <MaterialCommunityIcons name="crown" size={10} color={colors.accentForeground} />
                <Text style={[styles.premiumTagText, { color: colors.accentForeground }]}>PREMIUM</Text>
              </View>
            )}
            <View style={[styles.typeTag, { backgroundColor: '#FFFFFF18' }]}>
              <MaterialCommunityIcons name="lightning-bolt" size={10} color="#FFFFFF" />
              <Text style={[styles.typeTagText, { color: 'rgba(255,255,255,0.9)' }]}>
                {program.subcategory ?? program.category}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{program.title}</Text>
          <Text style={styles.heroDesc} numberOfLines={3}>{program.description}</Text>

          <View style={styles.heroBadges}>
            <HeroBadge icon="clock-outline" label={`${program.duration} min/session`} />
            <HeroBadge icon="calendar-range" label={program.weeks > 0 ? `${program.weeks} weeks` : 'Ongoing'} />
            <HeroBadge icon="lightning-bolt" label={`${program.daysPerWeek}× per week`} />
            <HeroBadge icon="trophy" label={program.level} />
          </View>
        </View>
      </View>

      {/* ── Body ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: botPad + 110 }]}
      >
        {/* Stats bar */}
        <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StatBarItem icon="clock-outline" label="Duration" value={`${program.duration} min`} accent={accent} colors={colors} />
          <View style={[styles.statBarDiv, { backgroundColor: colors.border }]} />
          <StatBarItem icon="calendar-range" label="Length" value={program.weeks > 0 ? `${program.weeks} wks` : 'Ongoing'} accent={accent} colors={colors} />
          <View style={[styles.statBarDiv, { backgroundColor: colors.border }]} />
          <StatBarItem icon="lightning-bolt" label="Frequency" value={`${program.daysPerWeek}×/wk`} accent={accent} colors={colors} />
          <View style={[styles.statBarDiv, { backgroundColor: colors.border }]} />
          <StatBarItem
            icon="toolbox"
            label="Equipment"
            value={`${program.equipment.length} items`}
            accent={accent}
            colors={colors}
          />
        </View>

        {/* ── Modules ── */}
        {hasModules && (
          <Section title="Program Curriculum" icon="view-module" accent={accent} colors={colors}>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Tap any module to expand drills, coaching cues, and technique notes.
            </Text>
            {program.modules!.map((module) => (
              <ModuleCard key={module.id} module={module} accent={accent} colors={colors} />
            ))}
          </Section>
        )}

        {program.exercises.length > 0 && (
          <Section title="Muscles Targeted" icon="human" accent={accent} colors={colors}>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Highlighted areas show the primary training emphasis across this program.
            </Text>
            <TargetMuscleMap
              muscleGroups={program.exercises.map((exercise) => exercise.muscleGroup)}
              accent={accent}
            />
          </Section>
        )}

        {/* ── Featured Exercises ── */}
        {program.exercises.length > 0 && (
          <Section
            title={hasModules ? 'Featured Exercises' : `Exercises (${program.exercises.length})`}
            icon="dumbbell"
            accent={accent}
            colors={colors}
          >
            {hasModules && (
              <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                Core exercises for this program. Full exercise lists are inside each curriculum module above.
              </Text>
            )}
            {program.exercises.map((ex, i) => (
              <ExerciseRow key={ex.id} exercise={ex} index={i} accent={accent} colors={colors} />
            ))}
          </Section>
        )}

        {/* ── Weekly Schedule ── */}
        {hasSchedule && (
          <Section title="Weekly Schedule" icon="calendar-week" accent={accent} colors={colors}>
            <View style={styles.scheduleGrid}>
              {program.weeklySchedule!.map((day) => {
                const dayColor = DAY_TYPE_COLORS[day.type] ?? colors.primary;
                const isRest = day.type === 'rest';
                return (
                  <View
                    key={day.day}
                    style={[
                      styles.scheduleDay,
                      {
                        backgroundColor: isRest ? colors.muted : dayColor + '14',
                        borderColor: isRest ? colors.border : dayColor + '35',
                      },
                    ]}
                  >
                    <Text style={[styles.scheduleDayName, { color: isRest ? colors.mutedForeground : colors.foreground }]}>
                      {day.day.slice(0, 3)}
                    </Text>
                    <Text
                      style={[styles.scheduleDayLabel, { color: isRest ? colors.mutedForeground : dayColor }]}
                      numberOfLines={2}
                    >
                      {day.label}
                    </Text>
                    {day.duration > 0 && (
                      <Text style={[styles.scheduleDayDuration, { color: colors.mutedForeground }]}>
                        {day.duration}m
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </Section>
        )}

        {/* ── Equipment Required ── */}
        {program.equipment.length > 0 && (
          <Section title="Equipment Required" icon="toolbox" accent={accent} colors={colors}>
            <View style={styles.equipmentList}>
              {program.equipment.map((item, i) => (
                <View
                  key={i}
                  style={[styles.equipmentItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <MaterialCommunityIcons name="check-circle" size={14} color={accent} />
                  <Text style={[styles.equipmentText, { color: colors.foreground }]}>{item}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* ── Coach's Tip ── */}
        {program.coachTip ? (
          <Section title="Coach's Tip" icon="whistle" accent={accent} colors={colors}>
            <View style={[styles.coachTip, { backgroundColor: accent + '10', borderColor: accent + '30' }]}>
              <View style={[styles.coachTipIcon, { backgroundColor: accent + '20' }]}>
                <MaterialCommunityIcons name="whistle" size={18} color={accent} />
              </View>
              <Text style={[styles.coachTipText, { color: colors.foreground }]}>
                "{program.coachTip}"
              </Text>
            </View>
          </Section>
        ) : null}

        {/* ── Level & Progression ── */}
        <Section title="Difficulty Level" icon="trophy" accent={accent} colors={colors}>
          <View style={styles.levelRow}>
            {(['Beginner', 'Intermediate', 'Advanced', 'College', 'Professional'] as const).map((lvl) => {
              const active = lvl === program.level;
              const lvlColor = LEVEL_COLORS[lvl] ?? colors.primary;
              return (
                <View
                  key={lvl}
                  style={[
                    styles.levelStep,
                    {
                      backgroundColor: active ? lvlColor + '22' : colors.muted,
                      borderColor: active ? lvlColor : colors.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  {active && (
                    <MaterialCommunityIcons name="check" size={10} color={lvlColor} />
                  )}
                  <Text
                    style={[
                      styles.levelStepText,
                      { color: active ? lvlColor : colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {lvl}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.levelDesc, { color: colors.mutedForeground }]}>
            {program.level === 'Beginner' && 'Ideal for those new to structured training or returning after a break.'}
            {program.level === 'Intermediate' && 'For those with a solid foundation who are ready to push intensity and complexity.'}
            {program.level === 'Advanced' && 'Demanding program requiring a strong athletic base and high training tolerance.'}
          </Text>
        </Section>
      </ScrollView>

      {/* ── CTA Bar ── */}
      <View
        style={[
          styles.ctaBar,
          { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 16 },
        ]}
      >
        {isLocked ? (
          <Pressable
            onPress={() => router.push('/subscription')}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="crown" size={20} color={colors.accentForeground} />
            <Text style={[styles.ctaBtnText, { color: colors.accentForeground }]}>Unlock Premium</Text>
          </Pressable>
        ) : isActive ? (
          <Pressable
            onPress={handleCTA}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: colors.success, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={[styles.ctaBtnText, { color: '#FFFFFF' }]}>Resume Workout</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleCTA}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
            <Text style={[styles.ctaBtnText, { color: '#FFFFFF' }]}>Start Program</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  accent,
  colors,
  children,
}: {
  title: string;
  icon: string;
  accent: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: accent + '20' }]}>
          <MaterialCommunityIcons name={icon as any} size={14} color={accent} />
        </View>
        <Text style={[styles.sectionHeadTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function StatBarItem({
  icon,
  label,
  value,
  accent,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  accent: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statBarItem}>
      <MaterialCommunityIcons name={icon as any} size={16} color={accent} />
      <Text style={[styles.statBarValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statBarLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Hero
  hero: { position: 'relative', paddingBottom: 20, overflow: 'hidden' },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.75,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,7,11,0.55)',
  },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, zIndex: 1 },
  backFloating: { paddingHorizontal: 20 },
  heroContent: { paddingHorizontal: 20, gap: 8, zIndex: 1 },
  heroTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  premiumTagText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeTagText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  heroTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#FFFFFF', lineHeight: 32 },
  heroDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  heroBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.9)' },

  // Body
  body: { padding: 16, gap: 0 },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  statBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  statBarValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  statBarLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  statBarDiv: { width: 1, marginVertical: 12 },

  // Section
  section: { marginBottom: 24 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  sectionSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginBottom: 10 },

  // Module card
  moduleCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  moduleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleInfo: { flex: 1 },
  moduleTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  moduleFocus: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  moduleDrillCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  moduleDrillCountText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  moduleDrills: { borderTopWidth: 1, padding: 12, gap: 10 },
  coachNoteInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  coachNoteInlineText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, fontStyle: 'italic' },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  drillRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  drillNum: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  drillNumText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  drillInfo: { flex: 1, gap: 2 },
  drillName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  drillNotes: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15, fontStyle: 'italic' },
  drillStats: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  drillStat: { alignItems: 'center', minWidth: 32 },
  drillStatVal: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  drillStatLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },

  // Recommended athletic chips
  athleticChips: { gap: 8 },
  athleticChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  athleticChipText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Exercise row
  exRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  exMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exNum: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  exNumText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  exInfo: { flex: 1, gap: 2 },
  exName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  exMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  exMuscle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  exDot: { width: 2, height: 2, borderRadius: 1 },
  exNotes: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15, fontStyle: 'italic', marginTop: 2 },
  exStats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    gap: 8, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7,
  },
  exStat: { alignItems: 'center', flex: 1, minWidth: 0 },
  exStatVal: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  exStatLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  exDiv: { width: 1, height: 22 },

  // Weekly schedule
  scheduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scheduleDay: {
    width: '30%',
    flexGrow: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    gap: 3,
  },
  scheduleDayName: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  scheduleDayLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', textAlign: 'center', lineHeight: 13 },
  scheduleDayDuration: { fontSize: 10, fontFamily: 'Inter_400Regular' },

  // Equipment
  equipmentList: { gap: 6 },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  equipmentText: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  // Coach tip
  coachTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  coachTipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachTipText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, fontStyle: 'italic' },

  // Level
  levelRow: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  levelStep: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 7,
    borderRadius: 8,
  },
  levelStepText: { fontSize: 9, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  levelDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },

  // CTA
  ctaBar: { padding: 16, borderTopWidth: 1 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
  },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },

  notFound: { textAlign: 'center', marginTop: 40, fontSize: 16, fontFamily: 'Inter_400Regular' },
});
