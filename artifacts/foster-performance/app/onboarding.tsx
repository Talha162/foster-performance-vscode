import React, { useState, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

// ─── Data ─────────────────────────────────────────────────────────────────────

const GOALS = [
  { key: 'Lose Weight',          sub: 'Burn fat and get lean with structured training',              icon: 'scale-bathroom',    color: '#FF6B35' },
  { key: 'Gain Weight',          sub: 'Build mass and size with progressive programs',               icon: 'arm-flex',          color: '#795548' },
  { key: 'Build Muscle',         sub: 'Build size and definition with proven hypertrophy',           icon: 'dumbbell',          color: '#9C27B0' },
  { key: 'Build Strength',       sub: 'Get stronger with progressive overload lifting',              icon: 'weight-lifter',     color: '#3F51B5' },
  { key: 'Improve Overall Fitness', sub: 'Balanced training to look and feel great every day',      icon: 'heart-pulse',       color: '#2F80FF' },
  { key: 'Improve Health',       sub: 'Lower-impact training focused on long-term wellbeing',       icon: 'heart',             color: '#E91E63' },
  { key: 'Increase Mobility',    sub: 'Move better, feel better, and reduce everyday pain',         icon: 'human-handsup',     color: '#00BCD4' },
  { key: 'Increase Flexibility', sub: 'Stretch further, move more freely, and prevent injury',      icon: 'yoga',              color: '#009688' },
  { key: 'Improve Endurance',    sub: 'Build cardiovascular fitness and stamina over time',         icon: 'lungs',             color: '#4CAF50' },
  { key: 'Running',              sub: '5K to marathon training plans for all levels',               icon: 'run-fast',          color: '#35C98A' },
  { key: 'Walking',              sub: 'Low-impact walking programs for fitness and health',          icon: 'walk',              color: '#8BC34A' },
  { key: 'Cross-Training',       sub: 'Mix of cardio, strength, and functional movements',          icon: 'timer-outline',     color: '#FF5722' },
  { key: 'Functional Fitness',   sub: 'Real-world movements that improve everyday life',            icon: 'cogs',              color: '#FF9800' },
  { key: 'General Wellness',     sub: 'Holistic approach to health, movement, and recovery',        icon: 'leaf',              color: '#607D8B' },
] as const;

type GoalKey = typeof GOALS[number]['key'];

const LEVELS = [
  { key: 'Beginner',     label: 'Beginner',     sub: 'New to structured training',          icon: 'sprout',      color: '#4CAF50' },
  { key: 'Intermediate', label: 'Intermediate', sub: '1–3 years of consistent training',    icon: 'trending-up', color: '#2F80FF' },
  { key: 'Advanced',     label: 'Advanced',     sub: '3+ years of serious training',        icon: 'star-outline', color: '#D6A84B' },
] as const;

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === step ? colors.primary : colors.border,
              width: i === step ? 20 : 7,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { updateUser } = useAuth();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalKey | null>(null);
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced' | null>(null);
  const [saving, setSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const STEPS = 2;

  const transitionTo = (nextStep: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS - 1) {
      transitionTo(step + 1);
    } else {
      setSaving(true);
      try {
        await updateUser({
          goal: goal ?? undefined,
          level: level ?? undefined,
          onboardingComplete: true,
        });
        router.replace('/(tabs)');
      } finally {
        setSaving(false);
      }
    }
  };

  const canContinue =
    (step === 0 && goal !== null) ||
    (step === 1 && level !== null);

  const stepTitles = [
    "What's your primary goal?",
    "What's your experience level?",
  ];
  const stepSubs = [
    "We'll personalize your programs, nutrition, and dashboard.",
    "We'll match the right intensity to where you are.",
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.appLabel, { color: colors.primary }]}>FOSTER PERFORMANCE</Text>
        <StepDots step={step} total={STEPS} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.foreground }]}>{stepTitles[step]}</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{stepSubs[step]}</Text>
        </View>

        {/* Step 0 — Goal Selection */}
        {step === 0 && (
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listStack}
          >
            {GOALS.map((g) => {
              const selected = goal === g.key;
              return (
                <Pressable
                  key={g.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setGoal(g.key);
                  }}
                  style={({ pressed }) => [
                    styles.listCard,
                    {
                      backgroundColor: selected ? g.color + '18' : colors.card,
                      borderColor: selected ? g.color : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.listIconCircle, { backgroundColor: g.color + '20' }]}>
                    <MaterialCommunityIcons name={g.icon as any} size={24} color={g.color} />
                  </View>
                  <View style={styles.listCardText}>
                    <Text style={[styles.listCardTitle, { color: selected ? g.color : colors.foreground }]}>
                      {g.key}
                    </Text>
                    <Text style={[styles.listCardSub, { color: colors.mutedForeground }]}>{g.sub}</Text>
                  </View>
                  {selected ? (
                    <View style={[styles.radioFill, { borderColor: g.color, backgroundColor: g.color }]}>
                      <MaterialCommunityIcons name="check" size={12} color="#fff" />
                    </View>
                  ) : (
                    <View style={[styles.radioEmpty, { borderColor: colors.border }]} />
                  )}
                </Pressable>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        {/* Step 1 — Level */}
        {step === 1 && (
          <View style={styles.listStack}>
            {LEVELS.map((lv) => {
              const selected = level === lv.key;
              return (
                <Pressable
                  key={lv.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setLevel(lv.key);
                  }}
                  style={({ pressed }) => [
                    styles.listCard,
                    {
                      backgroundColor: selected ? lv.color + '18' : colors.card,
                      borderColor: selected ? lv.color : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.listIconCircle, { backgroundColor: lv.color + '20' }]}>
                    <MaterialCommunityIcons name={lv.icon as any} size={24} color={lv.color} />
                  </View>
                  <View style={styles.listCardText}>
                    <Text style={[styles.listCardTitle, { color: selected ? lv.color : colors.foreground }]}>
                      {lv.label}
                    </Text>
                    <Text style={[styles.listCardSub, { color: colors.mutedForeground }]}>{lv.sub}</Text>
                  </View>
                  {selected ? (
                    <View style={[styles.radioFill, { borderColor: lv.color, backgroundColor: lv.color }]}>
                      <MaterialCommunityIcons name="check" size={12} color="#fff" />
                    </View>
                  ) : (
                    <View style={[styles.radioEmpty, { borderColor: colors.border }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

      </Animated.View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: botPad + 16 }]}>
        {step > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              transitionTo(step - 1);
            }}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
        )}
        <Pressable
          onPress={handleNext}
          disabled={!canContinue || saving}
          style={({ pressed }) => [
            styles.continueBtn,
            {
              backgroundColor: canContinue ? colors.primary : colors.secondary,
              opacity: pressed || saving ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.continueBtnText, { color: canContinue ? colors.primaryForeground : colors.mutedForeground }]}>
            {saving ? 'Saving…' : step === STEPS - 1 ? 'Get Started' : 'Continue'}
          </Text>
          {!saving && (
            <MaterialCommunityIcons
              name={step === STEPS - 1 ? 'check' : 'arrow-right'}
              size={18}
              color={canContinue ? colors.primaryForeground : colors.mutedForeground}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 16,
  },
  appLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  titleBlock: {
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  // List cards (goal + level)
  listStack: {
    gap: 10,
    paddingBottom: 12,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 14,
  },
  listIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCardText: {
    flex: 1,
    gap: 3,
  },
  listCardTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  listCardSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  radioFill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
});
