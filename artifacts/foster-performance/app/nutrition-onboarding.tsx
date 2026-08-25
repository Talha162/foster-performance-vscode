import React, { useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useNutrition } from '@/context/NutritionContext';

// ─── Data ─────────────────────────────────────────────────────────────────────

const GOALS = [
  { id: 'Lose Weight', icon: 'trending-down', color: '#3B82F6', desc: 'Gradual, sustainable fat loss' },
  { id: 'Gain Healthy Weight', icon: 'trending-up', color: '#F59E0B', desc: 'Build mass with balanced nutrition' },
  { id: 'Build Muscle', icon: 'arm-flex', color: '#8B5CF6', desc: 'Fuel muscle growth and strength' },
  { id: 'Maintain Weight', icon: 'minus-circle', color: '#10B981', desc: 'Stay balanced and consistent' },
  { id: 'Improve Overall Health', icon: 'heart-pulse', color: '#EC4899', desc: 'Whole-body wellness focus' },
  { id: 'High-Protein Eating', icon: 'food-steak', color: '#F97316', desc: 'Prioritize protein at every meal' },
  { id: 'Low-Carbohydrate Eating', icon: 'grain', color: '#64748B', desc: 'Moderate carb approach' },
  { id: 'Mediterranean-Style Eating', icon: 'fish', color: '#0EA5E9', desc: 'Whole foods, olive oil, fish' },
  { id: 'Vegetarian Eating', icon: 'leaf', color: '#22C55E', desc: 'Plant-forward, eggs & dairy OK' },
  { id: 'Vegan Eating', icon: 'sprout', color: '#16A34A', desc: '100% plant-based nutrition' },
  { id: 'Gluten-Free Eating', icon: 'food-off', color: '#D97706', desc: 'Avoid gluten-containing foods' },
  { id: 'Dairy-Free Eating', icon: 'bottle-tonic', color: '#7C3AED', desc: 'No dairy products' },
  { id: 'Budget-Friendly Eating', icon: 'currency-usd', color: '#6B7280', desc: 'Nutritious meals on a budget' },
  { id: 'Quick and Easy Meals', icon: 'clock-fast', color: '#F43F5E', desc: 'Ready in 30 minutes or less' },
  { id: 'Family Meal Planning', icon: 'home-heart', color: '#8B5CF6', desc: 'Meals everyone will enjoy' },
  { id: 'Meal Preparation', icon: 'fridge', color: '#0891B2', desc: 'Batch cook and prep ahead' },
  { id: 'Running and Endurance Support', icon: 'run', color: '#DC2626', desc: 'Fuel for cardio and endurance' },
  { id: 'Strength-Training Support', icon: 'weight-lifter', color: '#7C3AED', desc: 'Nutrition for lifting days' },
  { id: 'Recovery-Focused Nutrition', icon: 'heart-plus', color: '#059669', desc: 'Reduce soreness and recover faster' },
  { id: 'Healthy Habits for Beginners', icon: 'star-outline', color: '#0EA5E9', desc: 'Simple, easy-to-follow guidance' },
];

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf', color: '#22C55E' },
  { id: 'vegan', label: 'Vegan', icon: 'sprout', color: '#16A34A' },
  { id: 'gluten_free', label: 'Gluten-Free', icon: 'food-off', color: '#D97706' },
  { id: 'dairy_free', label: 'Dairy-Free', icon: 'bottle-tonic', color: '#7C3AED' },
  { id: 'halal', label: 'Halal', icon: 'check-circle', color: '#0EA5E9' },
  { id: 'kosher', label: 'Kosher', icon: 'check-circle', color: '#F59E0B' },
];

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Mostly Sedentary', desc: 'Desk job, little movement', multiplier: 1.2 },
  { id: 'lightly_active', label: 'Lightly Active', desc: 'Light exercise 1–3 days/week', multiplier: 1.375 },
  { id: 'moderately_active', label: 'Moderately Active', desc: 'Exercise 3–5 days/week', multiplier: 1.55 },
  { id: 'very_active', label: 'Very Active', desc: 'Hard training 6–7 days/week', multiplier: 1.725 },
  { id: 'highly_active', label: 'Highly Active', desc: 'Athlete, physical job', multiplier: 1.9 },
];

const MEAL_FREQUENCIES = [
  { id: 'three', label: '3 Meals', desc: 'Breakfast, lunch, dinner' },
  { id: 'three_plus_snack', label: '3 Meals + 1 Snack', desc: 'Classic balanced day' },
  { id: 'three_plus_snacks', label: '3 Meals + 2 Snacks', desc: 'Great for blood sugar control' },
  { id: 'four', label: '4 Smaller Meals', desc: 'Consistent energy throughout the day' },
  { id: 'five', label: '5 Smaller Meals', desc: 'Ideal for athletes' },
];

const TRACKING_MODES = [
  {
    id: 'guided', label: 'Guided Portions', icon: 'hand-heart',
    desc: 'Use visual portions — no calorie counting required. Great for beginners.',
  },
  {
    id: 'detailed', label: 'Detailed Tracking', icon: 'chart-bar',
    desc: 'Track calories, protein, carbs, fat, and fiber. More precision for specific goals.',
  },
];

// Rough daily calorie estimate using Mifflin-St Jeor simplified
function estimateCalories(goal: string, activityLevel: string): { calories: number; protein: number; carbs: number; fat: number } {
  const multipliers: Record<string, number> = {
    sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55,
    very_active: 1.725, highly_active: 1.9,
  };
  const bmr = 1800; // conservative adult baseline
  const tdee = Math.round(bmr * (multipliers[activityLevel] ?? 1.55));

  let calories = tdee;
  if (goal === 'Lose Weight') calories = Math.max(1400, tdee - 400);
  if (goal === 'Gain Healthy Weight' || goal === 'Build Muscle') calories = tdee + 350;

  const protein = Math.round(calories * 0.30 / 4);
  const fat = Math.round(calories * 0.28 / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  return { calories, protein, carbs, fat };
}

// ─── Component ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

export default function NutritionOnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { saveProfile, profile } = useNutrition();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state — pre-fill from existing profile if available
  const [primaryGoal, setPrimaryGoal] = useState(profile?.goal ?? '');
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>(profile?.secondary_goals ?? []);
  const [dietaryPattern, setDietaryPattern] = useState(profile?.dietary_pattern ?? 'omnivore');
  const [selectedDietary, setSelectedDietary] = useState<string[]>(() => {
    const d: string[] = [];
    if (profile?.dietary_pattern === 'vegetarian') d.push('vegetarian');
    if (profile?.dietary_pattern === 'vegan') d.push('vegan');
    return d;
  });
  const [activityLevel, setActivityLevel] = useState(profile?.activity_level ?? 'moderately_active');
  const [mealFrequency, setMealFrequency] = useState(profile?.meal_frequency ?? 'three_plus_snacks');
  const [trackingMode, setTrackingMode] = useState<'guided' | 'detailed'>(profile?.tracking_mode ?? 'guided');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const toggleSecondary = (goal: string) => {
    setSecondaryGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal].slice(0, 5)
    );
  };

  const toggleDietary = (id: string) => {
    setSelectedDietary((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  };

  const deriveDietaryPattern = (): string => {
    if (selectedDietary.includes('vegan')) return 'vegan';
    if (selectedDietary.includes('vegetarian')) return 'vegetarian';
    return 'omnivore';
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const pattern = deriveDietaryPattern();
      const estimates = estimateCalories(primaryGoal, activityLevel);
      await saveProfile({
        goal: primaryGoal || null,
        secondary_goals: secondaryGoals,
        dietary_pattern: pattern,
        allergies: [],
        intolerances: selectedDietary.filter((d) => !['vegetarian', 'vegan'].includes(d)).map((d) => d.replace('_', '-')),
        activity_level: activityLevel,
        meal_frequency: mealFrequency,
        tracking_mode: trackingMode,
        daily_calories: estimates.calories,
        protein_target: estimates.protein,
        carbs_target: estimates.carbs,
        fat_target: estimates.fat,
        fiber_target: 30,
        water_target_ml: 2500,
        onboarding_complete: true,
      });
      router.back();
    } catch {
      setSaving(false);
    }
  };

  const canProceed =
    (step === 1 && !!primaryGoal) ||
    (step === 2) ||
    (step === 3 && !!activityLevel) ||
    (step === 4 && !!mealFrequency) ||
    (step === 5);

  const stepTitles = [
    'What\'s your main goal?',
    'Any dietary preferences?',
    'How active are you?',
    'How do you like to eat?',
    'How do you want to track?',
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => (step > 1 ? setStep(step - 1) : router.back())} style={styles.backBtn}>
          <Feather name={step > 1 ? 'arrow-left' : 'x'} size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.progress}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                { backgroundColor: i + 1 <= step ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>{step}/{TOTAL_STEPS}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 100 }]}
      >
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>{stepTitles[step - 1]}</Text>

        {/* Step 1: Primary goal */}
        {step === 1 && (
          <>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Choose the goal that matters most to you right now.
            </Text>
            <View style={styles.goalGrid}>
              {GOALS.map((goal) => (
                <Pressable
                  key={goal.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPrimaryGoal(goal.id); }}
                  style={[
                    styles.goalCard,
                    {
                      backgroundColor: primaryGoal === goal.id ? `${goal.color}15` : colors.card,
                      borderColor: primaryGoal === goal.id ? goal.color : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name={goal.icon as any} size={22} color={primaryGoal === goal.id ? goal.color : colors.mutedForeground} />
                  <Text style={[styles.goalCardTitle, { color: primaryGoal === goal.id ? goal.color : colors.foreground }]}>{goal.id}</Text>
                  <Text style={[styles.goalCardDesc, { color: colors.mutedForeground }]}>{goal.desc}</Text>
                </Pressable>
              ))}
            </View>

            {primaryGoal && (
              <View style={styles.secondarySection}>
                <Text style={[styles.secondaryTitle, { color: colors.foreground }]}>Any additional goals? (up to 5)</Text>
                <Text style={[styles.secondarySub, { color: colors.mutedForeground }]}>Optional</Text>
                <View style={styles.secondaryGrid}>
                  {GOALS.filter((g) => g.id !== primaryGoal).map((goal) => (
                    <Pressable
                      key={goal.id}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleSecondary(goal.id); }}
                      style={[
                        styles.secondaryChip,
                        {
                          backgroundColor: secondaryGoals.includes(goal.id) ? `${goal.color}15` : colors.card,
                          borderColor: secondaryGoals.includes(goal.id) ? goal.color : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.secondaryChipText, { color: secondaryGoals.includes(goal.id) ? goal.color : colors.mutedForeground }]}>
                        {goal.id}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Step 2: Dietary preferences */}
        {step === 2 && (
          <>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Select all that apply. We'll customize recipes and plans to match.
            </Text>
            <View style={styles.dietaryList}>
              {DIETARY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleDietary(opt.id); }}
                  style={[
                    styles.dietaryItem,
                    {
                      backgroundColor: selectedDietary.includes(opt.id) ? `${opt.color}15` : colors.card,
                      borderColor: selectedDietary.includes(opt.id) ? opt.color : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name={opt.icon as any} size={22} color={selectedDietary.includes(opt.id) ? opt.color : colors.mutedForeground} />
                  <Text style={[styles.dietaryLabel, { color: selectedDietary.includes(opt.id) ? opt.color : colors.foreground }]}>{opt.label}</Text>
                  {selectedDietary.includes(opt.id) && <Feather name="check" size={16} color={opt.color} style={{ marginLeft: 'auto' }} />}
                </Pressable>
              ))}
            </View>
            <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                None of the above? Skip this step — all recipes include flexible substitution options.
              </Text>
            </View>
          </>
        )}

        {/* Step 3: Activity level */}
        {step === 3 && (
          <>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              This helps us estimate your daily calorie needs. Be honest for the best results.
            </Text>
            <View style={styles.activityList}>
              {ACTIVITY_LEVELS.map((level) => (
                <Pressable
                  key={level.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActivityLevel(level.id); }}
                  style={[
                    styles.activityItem,
                    {
                      backgroundColor: activityLevel === level.id ? `${colors.primary}15` : colors.card,
                      borderColor: activityLevel === level.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, { color: activityLevel === level.id ? colors.primary : colors.foreground }]}>
                      {level.label}
                    </Text>
                    <Text style={[styles.activityDesc, { color: colors.mutedForeground }]}>{level.desc}</Text>
                  </View>
                  {activityLevel === level.id && <Feather name="check-circle" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Step 4: Meal frequency */}
        {step === 4 && (
          <>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              How many times do you prefer to eat each day?
            </Text>
            <View style={styles.activityList}>
              {MEAL_FREQUENCIES.map((freq) => (
                <Pressable
                  key={freq.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMealFrequency(freq.id); }}
                  style={[
                    styles.activityItem,
                    {
                      backgroundColor: mealFrequency === freq.id ? `${colors.primary}15` : colors.card,
                      borderColor: mealFrequency === freq.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, { color: mealFrequency === freq.id ? colors.primary : colors.foreground }]}>
                      {freq.label}
                    </Text>
                    <Text style={[styles.activityDesc, { color: colors.mutedForeground }]}>{freq.desc}</Text>
                  </View>
                  {mealFrequency === freq.id && <Feather name="check-circle" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Step 5: Tracking mode */}
        {step === 5 && (
          <>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              How would you like to track your nutrition? You can change this anytime.
            </Text>
            <View style={styles.trackingList}>
              {TRACKING_MODES.map((mode) => (
                <Pressable
                  key={mode.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTrackingMode(mode.id as any); }}
                  style={[
                    styles.trackingCard,
                    {
                      backgroundColor: trackingMode === mode.id ? `${colors.primary}15` : colors.card,
                      borderColor: trackingMode === mode.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name={mode.icon as any} size={36} color={trackingMode === mode.id ? colors.primary : colors.mutedForeground} />
                  <View style={styles.trackingInfo}>
                    <Text style={[styles.trackingLabel, { color: trackingMode === mode.id ? colors.primary : colors.foreground }]}>{mode.label}</Text>
                    <Text style={[styles.trackingDesc, { color: colors.mutedForeground }]}>{mode.desc}</Text>
                  </View>
                  {trackingMode === mode.id && <Feather name="check-circle" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </View>

            {primaryGoal && (
              <View style={[styles.summaryCard, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
                <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Your personalized plan</Text>
                {(() => {
                  const est = estimateCalories(primaryGoal, activityLevel);
                  return (
                    <>
                      <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
                        Based on your goal of <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>{primaryGoal}</Text> and activity level, we estimate:
                      </Text>
                      <View style={styles.summaryGrid}>
                        <SummaryCell label="Calories" value={`~${est.calories}`} unit="kcal/day" colors={colors} />
                        <SummaryCell label="Protein" value={`~${est.protein}g`} unit="per day" colors={colors} />
                        <SummaryCell label="Carbs" value={`~${est.carbs}g`} unit="per day" colors={colors} />
                        <SummaryCell label="Fat" value={`~${est.fat}g`} unit="per day" colors={colors} />
                      </View>
                      <Text style={[styles.summaryDisclaimer, { color: colors.mutedForeground }]}>
                        These are general estimates for healthy adults. Values are labeled as educational guidance only. Consult a healthcare professional if you have specific medical needs.
                      </Text>
                    </>
                  );
                })()}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 12 }]}>
        <Pressable
          onPress={() => {
            if (step < TOTAL_STEPS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setStep(step + 1);
            } else {
              handleFinish();
            }
          }}
          disabled={!canProceed || saving}
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: colors.primary, opacity: (!canProceed || saving || pressed) ? 0.6 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
                {step < TOTAL_STEPS ? 'Continue' : 'Save My Plan'}
              </Text>
              {step < TOTAL_STEPS && <Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
              {step === TOTAL_STEPS && <Feather name="check" size={18} color={colors.primaryForeground} />}
            </>
          )}
        </Pressable>
        {step < TOTAL_STEPS && (
          <Pressable onPress={() => setStep(step + 1)} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip this step</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SummaryCell({ label, value, unit, colors }: any) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryCellValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.summaryCellUnit, { color: colors.primary }]}>{unit}</Text>
      <Text style={[styles.summaryCellLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: { width: 28, height: 4, borderRadius: 2 },
  stepLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', minWidth: 30, textAlign: 'right' },
  content: { padding: 20, gap: 20 },
  stepTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', lineHeight: 30 },
  stepSub: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: -10 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard: { width: '47%', padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  goalCardTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', lineHeight: 16 },
  goalCardDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 14 },
  secondarySection: { gap: 8 },
  secondaryTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  secondarySub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: -4 },
  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  secondaryChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  dietaryList: { gap: 10 },
  dietaryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  dietaryLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  activityList: { gap: 10 },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  activityDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  trackingList: { gap: 14 },
  trackingCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, borderWidth: 1 },
  trackingInfo: { flex: 1 },
  trackingLabel: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  trackingDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4, lineHeight: 18 },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  summaryTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  summaryText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCell: { width: '46%', alignItems: 'center', padding: 10, borderRadius: 10 },
  summaryCellValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  summaryCellUnit: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  summaryCellLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  summaryDisclaimer: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  footer: { padding: 16, borderTopWidth: 1, gap: 10 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  nextBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  skipBtn: { alignItems: 'center', paddingVertical: 4 },
  skipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
