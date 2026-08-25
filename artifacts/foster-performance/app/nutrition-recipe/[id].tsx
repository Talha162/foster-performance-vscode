import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useNutrition, Recipe } from '@/context/NutritionContext';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

const CATEGORY_COLORS: Record<string, string> = {
  Breakfast: '#F59E0B', Lunch: '#3B82F6', Dinner: '#8B5CF6',
  Smoothies: '#10B981', Snacks: '#F97316', 'Meal Prep': '#EC4899',
};

export default function RecipeDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { savedRecipeIds, saveRecipe, unsaveRecipe, createGroceryListFromRecipe, logFood } = useNutrition();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const isSaved = savedRecipeIds.has(id ?? '');
  const cardColor = CATEGORY_COLORS[recipe?.category ?? ''] ?? '#64748B';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_BASE}/api/nutrition/recipes/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRecipe(data);
      })
      .catch(() => setError('Failed to load recipe'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isSaved) unsaveRecipe(id!);
    else saveRecipe(id!);
  };

  const handleAddToGrocery = async () => {
    if (!recipe) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createGroceryListFromRecipe(recipe);
      Alert.alert('Added to Grocery List', `Ingredients for "${recipe.title}" have been added to your grocery list.`);
    } catch {
      Alert.alert('Error', 'Failed to add ingredients to grocery list.');
    }
  };

  const handleLogMeal = () => {
    if (!recipe) return;
    Alert.alert(
      'Log This Recipe',
      `Log "${recipe.title}" as a meal?\n\nEst. ${recipe.calories} kcal per serving.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log It',
          onPress: async () => {
            try {
              await logFood({
                meal_category: recipe.category === 'Breakfast' ? 'Breakfast' : recipe.category === 'Smoothies' ? 'Post-Workout' : 'Meal',
                food_name: recipe.title,
                calories: recipe.calories,
                protein: recipe.protein,
                carbs: recipe.carbs,
                fat: recipe.fat,
                fiber: recipe.fiber,
                serving_amount: 1,
                serving_unit: 'serving',
                recipe_id: recipe.id,
              });
              Alert.alert('Logged!', 'Meal added to today\'s log.');
            } catch {
              Alert.alert('Error', 'Failed to log meal.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingHeader, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingHeader, { paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error || 'Recipe not found'}</Text>
        </View>
      </View>
    );
  }

  const totalTime = (recipe.prep_time_mins || 0) + (recipe.cook_time_mins || 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: botPad + 120 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: `${cardColor}18`, paddingTop: topPad + 12 }]}>
          <View style={styles.heroHeader}>
            <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
              <Feather name="bookmark" size={20} color={isSaved ? '#F59E0B' : '#fff'} />
            </Pressable>
          </View>
          <View style={styles.heroContent}>
            <MaterialCommunityIcons name="food" size={64} color={cardColor} />
            <View style={[styles.heroCategoryBadge, { backgroundColor: cardColor }]}>
              <Text style={styles.heroCategoryText}>{recipe.category}</Text>
            </View>
          </View>
        </View>

        <View style={styles.bodyContent}>
          {/* Title + meta */}
          <View style={styles.titleBlock}>
            <Text style={[styles.recipeTitle, { color: colors.foreground }]}>{recipe.title}</Text>
            <Text style={[styles.recipeDesc, { color: colors.mutedForeground }]}>{recipe.description}</Text>
          </View>

          {/* Time / servings / cost */}
          <View style={[styles.metaRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MetaStat icon="clock" label="Prep" value={`${recipe.prep_time_mins}m`} color={colors} />
            <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
            <MetaStat icon="thermometer" label="Cook" value={`${recipe.cook_time_mins}m`} color={colors} />
            <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
            <MetaStat icon="clock" label="Total" value={`${totalTime}m`} color={colors} />
            <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
            <MetaStat icon="users" label="Serves" value={`${recipe.servings}`} color={colors} />
          </View>

          {/* Nutrition */}
          <View style={[styles.nutritionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Nutrition per serving*</Text>
            <View style={styles.nutritionGrid}>
              <NutritionCell label="Calories" value={`${recipe.calories}`} unit="kcal" color={colors.primary} colors={colors} />
              <NutritionCell label="Protein" value={`${Math.round(recipe.protein)}`} unit="g" color="#3B82F6" colors={colors} />
              <NutritionCell label="Carbs" value={`${Math.round(recipe.carbs)}`} unit="g" color="#F59E0B" colors={colors} />
              <NutritionCell label="Fat" value={`${Math.round(recipe.fat)}`} unit="g" color="#8B5CF6" colors={colors} />
              {recipe.fiber > 0 && <NutritionCell label="Fiber" value={`${Math.round(recipe.fiber)}`} unit="g" color="#10B981" colors={colors} />}
              {(recipe.sodium ?? 0) > 0 && <NutritionCell label="Sodium" value={`${Math.round(recipe.sodium ?? 0)}`} unit="mg" color="#64748B" colors={colors} />}
            </View>
            <Text style={[styles.nutritionDisclaimer, { color: colors.mutedForeground }]}>
              *Estimates only. Actual values vary based on ingredients and portions.
            </Text>
          </View>

          {/* Tags */}
          {(recipe.dietary_tags?.length > 0 || recipe.allergy_tags?.length > 0) && (
            <View style={styles.tagsBlock}>
              {recipe.dietary_tags?.map((tag) => (
                <View key={tag} style={[styles.tagChip, { backgroundColor: '#10B98118', borderColor: '#10B981' }]}>
                  <Text style={[styles.tagText, { color: '#10B981' }]}>{tag}</Text>
                </View>
              ))}
              {recipe.allergy_tags?.map((tag) => (
                <View key={tag} style={[styles.tagChip, { backgroundColor: '#F5705018', borderColor: '#F57050' }]}>
                  <Feather name="alert-triangle" size={10} color="#F57050" />
                  <Text style={[styles.tagText, { color: '#F57050' }]}>Contains {tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ingredients</Text>
              {recipe.ingredients.map((ing, i) => (
                <View key={i} style={[styles.ingredientRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.ingredientDot, { backgroundColor: colors.primary }]} />
                  <View style={styles.ingredientInfo}>
                    <Text style={[styles.ingredientName, { color: colors.foreground }]}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{ing.amount} </Text>
                      {ing.name}
                    </Text>
                    {ing.substitutes?.length > 0 && (
                      <Text style={[styles.ingredientSub, { color: colors.mutedForeground }]}>
                        Sub: {ing.substitutes.slice(0, 2).join(' or ')}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Instructions</Text>
              {recipe.instructions.map((step, i) => (
                <View key={i} style={[styles.stepRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.stepNumberText, { color: colors.primaryForeground }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Storage + Equipment */}
          {(recipe.storage || recipe.equipment?.length) && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Storage & Equipment</Text>
              {recipe.equipment?.length ? (
                <View style={styles.equipmentRow}>
                  {recipe.equipment.map((eq) => (
                    <View key={eq} style={[styles.equipmentChip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[styles.equipmentText, { color: colors.foreground }]}>{eq}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {recipe.storage && (
                <Text style={[styles.storageText, { color: colors.mutedForeground }]}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>Store: </Text>
                  {recipe.storage}
                </Text>
              )}
              {recipe.reheat && (
                <Text style={[styles.storageText, { color: colors.mutedForeground, marginTop: 4 }]}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>Reheat: </Text>
                  {recipe.reheat}
                </Text>
              )}
            </View>
          )}

          {/* Cost */}
          {(recipe.cost_per_serving ?? 0) > 0 && (
            <View style={[styles.costRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="dollar-sign" size={16} color="#10B981" />
              <Text style={[styles.costText, { color: colors.foreground }]}>
                Estimated cost: <Text style={{ color: '#10B981', fontFamily: 'Inter_700Bold' }}>${recipe.cost_per_serving?.toFixed(2)}</Text> per serving
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA Bar */}
      <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: botPad + 12 }]}>
        <Pressable
          onPress={handleAddToGrocery}
          style={({ pressed }) => [styles.ctaSecondary, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="shopping-cart" size={18} color={colors.foreground} />
          <Text style={[styles.ctaSecondaryText, { color: colors.foreground }]}>Grocery List</Text>
        </Pressable>
        <Pressable
          onPress={handleLogMeal}
          style={({ pressed }) => [styles.ctaPrimary, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="plus-circle" size={18} color={colors.primaryForeground} />
          <Text style={[styles.ctaPrimaryText, { color: colors.primaryForeground }]}>Log This Meal</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetaStat({ icon, label, value, color }: { icon: any; label: string; value: string; color: any }) {
  return (
    <View style={styles.metaStat}>
      <Text style={[styles.metaStatValue, { color: color.foreground }]}>{value}</Text>
      <Text style={[styles.metaStatLabel, { color: color.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function NutritionCell({ label, value, unit, color, colors }: any) {
  return (
    <View style={[styles.nutritionCell, { backgroundColor: `${color}12`, borderColor: `${color}30` }]}>
      <Text style={[styles.nutritionCellValue, { color }]}>{value}<Text style={styles.nutritionCellUnit}>{unit}</Text></Text>
      <Text style={[styles.nutritionCellLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 0 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 16, paddingBottom: 12 },
  heroContent: { alignItems: 'center', paddingBottom: 24, gap: 12 },
  heroCategoryBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  heroCategoryText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  bodyContent: { padding: 16, gap: 16 },
  titleBlock: { gap: 6 },
  recipeTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', lineHeight: 28 },
  recipeDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  metaRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  metaStat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  metaStatValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  metaStatLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  metaDivider: { width: 1, marginVertical: 10 },
  nutritionCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nutritionCell: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, minWidth: 70, alignItems: 'center' },
  nutritionCellValue: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  nutritionCellUnit: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  nutritionCellLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  nutritionDisclaimer: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  tagsBlock: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  section: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 0 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderTopWidth: 1 },
  ingredientDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  ingredientInfo: { flex: 1 },
  ingredientName: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  ingredientSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2, fontStyle: 'italic' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  stepText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  equipmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10 },
  equipmentChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  equipmentText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  storageText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18, paddingTop: 10 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  costText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1 },
  ctaSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  ctaSecondaryText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  ctaPrimary: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  ctaPrimaryText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});
