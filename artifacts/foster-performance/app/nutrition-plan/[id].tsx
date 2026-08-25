import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { ScreenState } from '@/components/ScreenState';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

export default function NutritionPlanDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { nutritionPlans, activeNutritionId, setActiveNutrition } = useApp();
  const { user } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const plan = nutritionPlans.find((p) => p.id === id);
  if (!plan) {
    return (
      <ScreenState
        icon="food-off"
        title="Nutrition plan not found"
        message="This plan is no longer available. Return to Nutrition to choose another plan."
        onBack={() => router.back()}
        actionLabel="Open Nutrition"
        onAction={() => router.replace('/(tabs)/nutrition')}
      />
    );
  }

  const isActive = activeNutritionId === plan.id;
  const isLocked = plan.isPremium && !user?.isPremium;
  const total = plan.protein + plan.carbs + plan.fat;

  const handleActivate = () => {
    if (isLocked) { router.push('/subscription'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveNutrition(isActive ? null : plan.id);
  };

  return (
    <View style={styles.root}>
      <BackgroundLayer />
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{plan.title}</Text>
        {plan.isPremium && (
          <MaterialCommunityIcons name="crown" size={18} color={colors.accent} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: botPad + 100 }]}>
        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>{plan.description}</Text>
          <View style={[styles.goalRow, { backgroundColor: colors.muted }]}>
            <MaterialCommunityIcons name="target" size={14} color={colors.primary} />
            <Text style={[styles.goalText, { color: colors.foreground }]}>Goal: {plan.goal}</Text>
          </View>
          {/* Macros */}
          <View style={styles.macroGrid}>
            <MacroCell label="Calories" value={`${plan.dailyCalories}`} unit="kcal" color={colors.primary} />
            <MacroCell label="Protein" value={`${plan.protein}g`} unit={`${Math.round((plan.protein * 4 / plan.dailyCalories) * 100)}%`} color="#2196F3" />
            <MacroCell label="Carbs" value={`${plan.carbs}g`} unit={`${Math.round((plan.carbs * 4 / plan.dailyCalories) * 100)}%`} color={colors.accent} />
            <MacroCell label="Fat" value={`${plan.fat}g`} unit={`${Math.round((plan.fat * 9 / plan.dailyCalories) * 100)}%`} color={colors.mutedForeground} />
          </View>
        </View>

        {/* Meals */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Meal Schedule</Text>
        {plan.meals.length === 0 ? (
          <View style={[styles.emptyMeals, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="silverware-clean" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyMealsText, { color: colors.mutedForeground }]}>
              Meals for this plan are being prepared. Check back soon.
            </Text>
          </View>
        ) : plan.meals.map((meal) => (
          <View key={meal.id} style={[styles.mealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.mealHeader}>
              <View style={styles.mealTitleRow}>
                <Text style={[styles.mealTime, { color: colors.primary }]}>{meal.time}</Text>
                <Text style={[styles.mealName, { color: colors.foreground }]}>{meal.name}</Text>
              </View>
              <View style={[styles.calBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.calBadgeText, { color: colors.foreground }]}>{meal.calories} kcal</Text>
              </View>
            </View>
            <View style={styles.mealMacros}>
              <Text style={[styles.mealMacro, { color: colors.mutedForeground }]}>P {meal.protein}g</Text>
              <Text style={[styles.mealMacro, { color: colors.mutedForeground }]}>C {meal.carbs}g</Text>
              <Text style={[styles.mealMacro, { color: colors.mutedForeground }]}>F {meal.fat}g</Text>
            </View>
            <View style={styles.foodList}>
              {meal.foods.map((food, i) => (
                <View key={i} style={styles.foodItem}>
                  <View style={[styles.foodDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.foodText, { color: colors.foreground }]}>{food}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* CTA */}
      <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        {isLocked ? (
          <Pressable onPress={() => router.push('/subscription')} style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
            <MaterialCommunityIcons name="crown" size={20} color={colors.accentForeground} />
            <Text style={[styles.ctaBtnText, { color: colors.accentForeground }]}>Unlock Premium</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleActivate} style={({ pressed }) => [styles.ctaBtn, { backgroundColor: isActive ? colors.muted : colors.primary, opacity: pressed ? 0.85 : 1 }]}>
            <MaterialCommunityIcons name={isActive ? 'close' : 'check'} size={20} color={isActive ? colors.foreground : colors.primaryForeground} />
            <Text style={[styles.ctaBtnText, { color: isActive ? colors.foreground : colors.primaryForeground }]}>
              {isActive ? 'Deactivate Plan' : 'Activate Plan'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function MacroCell({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.macroCell, { borderColor: color }]}>
      <Text style={[styles.macroCellValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.macroCellUnit, { color: color }]}>{unit}</Text>
      <Text style={[styles.macroCellLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold' },
  content: { padding: 20, gap: 16 },
  summaryCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  planDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  goalText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  macroGrid: { flexDirection: 'row', gap: 8 },
  macroCell: { flex: 1, borderRadius: 10, borderWidth: 2, padding: 10, alignItems: 'center', gap: 2 },
  macroCellValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  macroCellUnit: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  macroCellLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  mealCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mealTitleRow: { gap: 2 },
  mealTime: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  mealName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  calBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  calBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  mealMacros: { flexDirection: 'row', gap: 12 },
  mealMacro: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  foodList: { gap: 5 },
  foodItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foodDot: { width: 5, height: 5, borderRadius: 2.5 },
  foodText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  ctaBar: { padding: 20, borderTopWidth: 1 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 14 },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  emptyMeals: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  emptyMealsText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },
});
