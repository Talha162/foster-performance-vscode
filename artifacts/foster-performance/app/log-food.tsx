import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useNutrition } from '@/context/NutritionContext';

const MEAL_CATEGORIES = [
  { id: 'Breakfast', icon: 'weather-sunny' as const, color: '#F59E0B' },
  { id: 'Morning Snack', icon: 'food-apple' as const, color: '#10B981' },
  { id: 'Lunch', icon: 'food' as const, color: '#3B82F6' },
  { id: 'Afternoon Snack', icon: 'food-apple' as const, color: '#10B981' },
  { id: 'Dinner', icon: 'silverware-fork-knife' as const, color: '#8B5CF6' },
  { id: 'Evening Snack', icon: 'food-apple' as const, color: '#10B981' },
  { id: 'Pre-Workout', icon: 'lightning-bolt' as const, color: '#F97316' },
  { id: 'Post-Workout', icon: 'arm-flex' as const, color: '#EC4899' },
  { id: 'Protein Shake', icon: 'blender' as const, color: '#6366F1' },
];

const QUICK_FOODS = [
  { name: 'Chicken Breast (4 oz)', calories: 185, protein: 35, carbs: 0, fat: 4, fiber: 0 },
  { name: 'Brown Rice (1 cup cooked)', calories: 216, protein: 5, carbs: 45, fat: 2, fiber: 4 },
  { name: 'Scrambled Eggs (2 eggs)', calories: 182, protein: 12, carbs: 2, fat: 14, fiber: 0 },
  { name: 'Greek Yogurt (1 cup)', calories: 130, protein: 22, carbs: 9, fat: 0, fiber: 0 },
  { name: 'Banana (medium)', calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3 },
  { name: 'Oatmeal (1 cup cooked)', calories: 166, protein: 6, carbs: 28, fat: 4, fiber: 4 },
  { name: 'Protein Shake (1 scoop)', calories: 120, protein: 25, carbs: 5, fat: 2, fiber: 1 },
  { name: 'Almonds (1 oz)', calories: 164, protein: 6, carbs: 6, fat: 14, fiber: 4 },
  { name: 'Apple (medium)', calories: 95, protein: 0, carbs: 25, fat: 0, fiber: 4 },
  { name: 'Avocado (1/2)', calories: 120, protein: 2, carbs: 6, fat: 11, fiber: 5 },
  { name: 'Sweet Potato (medium)', calories: 103, protein: 2, carbs: 24, fat: 0, fiber: 4 },
  { name: 'Salmon (4 oz)', calories: 234, protein: 32, carbs: 0, fat: 11, fiber: 0 },
];

export default function LogFoodScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logFood } = useNutrition();

  const [mealCategory, setMealCategory] = useState('Breakfast');
  const [foodName, setFoodName] = useState('');
  const [brand, setBrand] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [servingAmount, setServingAmount] = useState('1');
  const [servingUnit, setServingUnit] = useState('serving');
  const [loading, setLoading] = useState(false);
  const [showQuickFoods, setShowQuickFoods] = useState(true);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const fillFromQuickFood = (food: typeof QUICK_FOODS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFoodName(food.name);
    setCalories(String(food.calories));
    setProtein(String(food.protein));
    setCarbs(String(food.carbs));
    setFat(String(food.fat));
    setFiber(String(food.fiber));
    setServingAmount('1');
    setServingUnit('serving');
    setShowQuickFoods(false);
  };

  const handleLog = async () => {
    if (!foodName.trim()) {
      Alert.alert('Missing Info', 'Please enter a food name.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await logFood({
        meal_category: mealCategory,
        food_name: foodName.trim(),
        brand: brand.trim() || undefined,
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        fiber: parseFloat(fiber) || 0,
        serving_amount: parseFloat(servingAmount) || 1,
        serving_unit: servingUnit || 'serving',
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to log food. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: topPad + 8, paddingBottom: botPad + 100 }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Log Food</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Meal category */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Meal</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {MEAL_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMealCategory(cat.id); }}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: mealCategory === cat.id ? `${cat.color}20` : colors.card,
                      borderColor: mealCategory === cat.id ? cat.color : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name={cat.icon} size={14} color={mealCategory === cat.id ? cat.color : colors.mutedForeground} />
                  <Text style={[styles.categoryChipText, { color: mealCategory === cat.id ? cat.color : colors.mutedForeground }]}>
                    {cat.id}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Quick foods */}
          <View style={[styles.quickFoodsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setShowQuickFoods(!showQuickFoods)}
              style={styles.quickFoodsHeader}
            >
              <Text style={[styles.quickFoodsTitle, { color: colors.foreground }]}>Common Foods</Text>
              <Feather name={showQuickFoods ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
            </Pressable>
            {showQuickFoods && (
              <View style={styles.quickFoodsList}>
                {QUICK_FOODS.map((food) => (
                  <Pressable
                    key={food.name}
                    onPress={() => fillFromQuickFood(food)}
                    style={({ pressed }) => [styles.quickFoodItem, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={styles.quickFoodInfo}>
                      <Text style={[styles.quickFoodName, { color: colors.foreground }]}>{food.name}</Text>
                      <Text style={[styles.quickFoodMacros, { color: colors.mutedForeground }]}>
                        {food.calories} kcal · P{food.protein}g · C{food.carbs}g · F{food.fat}g
                      </Text>
                    </View>
                    <Feather name="plus" size={16} color={colors.primary} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Food details */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Food Details</Text>

            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Food name*"
                placeholderTextColor={colors.mutedForeground}
                value={foodName}
                onChangeText={setFoodName}
              />
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="tag" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Brand (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={brand}
                onChangeText={setBrand}
              />
            </View>

            <View style={styles.servingRow}>
              <View style={[styles.inputWrapper, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Amount"
                  placeholderTextColor={colors.mutedForeground}
                  value={servingAmount}
                  onChangeText={setServingAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputWrapper, { flex: 2, backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Unit (serving, oz, g…)"
                  placeholderTextColor={colors.mutedForeground}
                  value={servingUnit}
                  onChangeText={setServingUnit}
                />
              </View>
            </View>
          </View>

          {/* Macros */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Nutrition (estimated)</Text>
            <View style={styles.macrosGrid}>
              {[
                { label: 'Calories (kcal)', val: calories, set: setCalories, color: colors.primary },
                { label: 'Protein (g)', val: protein, set: setProtein, color: '#3B82F6' },
                { label: 'Carbs (g)', val: carbs, set: setCarbs, color: '#F59E0B' },
                { label: 'Fat (g)', val: fat, set: setFat, color: '#8B5CF6' },
                { label: 'Fiber (g)', val: fiber, set: setFiber, color: '#10B981' },
              ].map(({ label, val, set, color }) => (
                <View key={label} style={[styles.macroInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.macroLabel, { color }]}>{label}</Text>
                  <TextInput
                    style={[styles.macroValue, { color: colors.foreground }]}
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    value={val}
                    onChangeText={set}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>
            <Text style={[styles.estimateNote, { color: colors.mutedForeground }]}>
              Values are estimates for educational purposes only.
            </Text>
          </View>
        </ScrollView>

        {/* Submit */}
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 12 }]}>
          <Pressable
            onPress={handleLog}
            disabled={loading || !foodName.trim()}
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: colors.primary, opacity: pressed || loading || !foodName.trim() ? 0.7 : 1 },
            ]}
          >
            {loading
              ? <ActivityIndicator color={colors.primaryForeground} />
              : (
                <>
                  <Feather name="check-circle" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>Log Food</Text>
                </>
              )
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, marginBottom: 4,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  section: { paddingHorizontal: 16, gap: 10 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  categoryRow: { gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  categoryChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  quickFoodsCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  quickFoodsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  quickFoodsTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  quickFoodsList: {},
  quickFoodItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1 },
  quickFoodInfo: { flex: 1 },
  quickFoodName: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  quickFoodMacros: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 50,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  servingRow: { flexDirection: 'row', gap: 10 },
  macrosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  macroInput: {
    width: '47%', padding: 12, borderRadius: 12, borderWidth: 1, gap: 4,
  },
  macroLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  macroValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  estimateNote: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  footer: { padding: 16, borderTopWidth: 1 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  submitBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
