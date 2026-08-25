import React, { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BackgroundLayer } from '@/components/BackgroundLayer';
import { useNutrition, Recipe } from '@/context/NutritionContext';

const TABS = ['Today', 'Recipes', 'Grocery'] as const;
type Tab = typeof TABS[number];

const RECIPE_CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Smoothies', 'Snacks', 'Meal Prep'];

const MEAL_CATEGORIES = [
  { id: 'Breakfast', icon: 'weather-sunny', label: 'Breakfast' },
  { id: 'Lunch', icon: 'food', label: 'Lunch' },
  { id: 'Dinner', icon: 'silverware-fork-knife', label: 'Dinner' },
  { id: 'Snack', icon: 'food-apple', label: 'Snack' },
  { id: 'Pre-Workout', icon: 'lightning-bolt', label: 'Pre-Workout' },
  { id: 'Post-Workout', icon: 'arm-flex', label: 'Post-Workout' },
];

const WATER_AMOUNTS = [
  { label: '8 oz', ml: 240 },
  { label: '12 oz', ml: 360 },
  { label: '16 oz', ml: 480 },
  { label: '32 oz', ml: 960 },
];

const MOTIVATIONAL = [
  "One balanced choice at a time.",
  "You're building consistency.",
  "No perfect day required—keep moving forward.",
  "Small steps, big results.",
  "Every meal is a new opportunity.",
];

export default function NutritionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    dashboard, recipes, savedRecipeIds, groceryItems,
    dashboardLoading, recipesLoading,
    loadDashboard, loadRecipes, logWater, deleteLog,
    saveRecipe, unsaveRecipe,
    toggleGroceryItem, deleteGroceryItem, addGroceryItem,
  } = useNutrition();

  const [activeTab, setActiveTab] = useState<Tab>('Today');
  const [recipeCategory, setRecipeCategory] = useState('All');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [motivation] = useState(MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard(), loadRecipes({ category: recipeCategory, q: recipeSearch })]);
    setRefreshing(false);
  }, [loadDashboard, loadRecipes, recipeCategory, recipeSearch]);

  useEffect(() => {
    loadRecipes({ category: recipeCategory === 'All' ? undefined : recipeCategory, q: recipeSearch || undefined });
  }, [recipeCategory, recipeSearch]);

  const profile = dashboard?.profile;
  const today = dashboard?.today;
  const logs = dashboard?.logs ?? [];

  const calTarget = profile?.daily_calories ?? 2000;
  const calConsumed = today?.calories ?? 0;
  const calPct = Math.min(1, calConsumed / calTarget);
  const calRemaining = today?.calories_remaining ?? calTarget;
  const waterMl = today?.water_ml ?? 0;
  const waterTarget = profile?.water_target_ml ?? 2500;
  const waterPct = Math.min(1, waterMl / waterTarget);
  const score = dashboard?.nutrition_score ?? 0;

  const logsByCategory: Record<string, typeof logs> = {};
  for (const log of logs) {
    const cat = log.meal_category || 'Other';
    if (!logsByCategory[cat]) logsByCategory[cat] = [];
    logsByCategory[cat].push(log);
  }

  // group grocery items
  const groceryByCategory: Record<string, typeof groceryItems> = {};
  for (const item of groceryItems) {
    const cat = item.category || 'Other';
    if (!groceryByCategory[cat]) groceryByCategory[cat] = [];
    groceryByCategory[cat].push(item);
  }

  if (!profile?.onboarding_complete && !dashboardLoading && dashboard) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <BackgroundLayer />
        <View style={[styles.onboardingPrompt, { paddingTop: topPad + 20 }]}>
          <MaterialCommunityIcons name="food-apple-outline" size={64} color={colors.primary} />
          <Text style={[styles.onboardingTitle, { color: colors.foreground }]}>Set Up Your Nutrition</Text>
          <Text style={[styles.onboardingBody, { color: colors.mutedForeground }]}>
            Answer a few quick questions and we'll create a personalized nutrition plan tailored to your goals.
          </Text>
          <Pressable
            onPress={() => router.push('/nutrition-onboarding')}
            style={({ pressed }) => [styles.onboardingBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.onboardingBtnText, { color: colors.primaryForeground }]}>Get Started</Text>
          </Pressable>
          <Text style={[styles.onboardingDisclaimer, { color: colors.mutedForeground }]}>
            Nutrition information is for general wellness purposes only. Always consult a healthcare professional for medical dietary needs.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BackgroundLayer />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Nutrition</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {profile?.goal ? profile.goal : 'Fuel your performance'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/nutrition-onboarding')}
            style={({ pressed }) => [styles.headerIcon, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="settings" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Sub-tabs */}
        <View style={styles.subTabs}>
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab); }}
              style={[
                styles.subTab,
                { borderBottomColor: activeTab === tab ? colors.primary : 'transparent', borderBottomWidth: 2 },
              ]}
            >
              <Text style={[styles.subTabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 120 : 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ─── TODAY TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'Today' && (
          <>
            {dashboardLoading && !dashboard && (
              <View style={styles.centerLoad}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            )}

            {dashboard && (
              <>
                {/* Motivational */}
                <View style={[styles.motivationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="zap" size={14} color={colors.primary} />
                  <Text style={[styles.motivationText, { color: colors.mutedForeground }]}>{motivation}</Text>
                </View>

                {/* Calorie ring + macros */}
                <View style={[styles.calorieCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.calorieRingRow}>
                    <View style={styles.ringContainer}>
                      <View style={[styles.ringOuter, { borderColor: colors.border }]}>
                        <View style={[
                          styles.ringFill,
                          {
                            borderColor: calPct >= 0.9 ? '#10B981' : colors.primary,
                            transform: [{ rotate: `${calPct * 360}deg` }],
                          },
                        ]} />
                        <View style={[styles.ringInner, { backgroundColor: colors.card }]}>
                          <Text style={[styles.ringCalories, { color: colors.foreground }]}>{calConsumed}</Text>
                          <Text style={[styles.ringUnit, { color: colors.mutedForeground }]}>kcal</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.calorieStats}>
                      <View style={styles.calorieStat}>
                        <Text style={[styles.calorieStatValue, { color: colors.foreground }]}>{calTarget}</Text>
                        <Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>Goal</Text>
                      </View>
                      <View style={[styles.calorieDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.calorieStat}>
                        <Text style={[styles.calorieStatValue, { color: calRemaining > 0 ? '#10B981' : '#F59E0B' }]}>{calRemaining}</Text>
                        <Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>Remaining</Text>
                      </View>
                      <View style={[styles.calorieDivider, { backgroundColor: colors.border }]} />
                      <View style={styles.calorieStat}>
                        <Text style={[styles.calorieStatValue, { color: colors.foreground }]}>{score}</Text>
                        <Text style={[styles.calorieStatLabel, { color: colors.mutedForeground }]}>Score</Text>
                      </View>
                    </View>
                  </View>

                  {/* Macros */}
                  <View style={styles.macrosRow}>
                    <MacroBar label="Protein" value={today?.protein ?? 0} target={profile?.protein_target ?? 150} color="#3B82F6" unit="g" colors={colors} />
                    <MacroBar label="Carbs" value={today?.carbs ?? 0} target={profile?.carbs_target ?? 200} color="#F59E0B" unit="g" colors={colors} />
                    <MacroBar label="Fat" value={today?.fat ?? 0} target={profile?.fat_target ?? 65} color="#8B5CF6" unit="g" colors={colors} />
                    <MacroBar label="Fiber" value={today?.fiber ?? 0} target={profile?.fiber_target ?? 30} color="#10B981" unit="g" colors={colors} />
                  </View>
                </View>

                {/* Water tracker */}
                <View style={[styles.waterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.waterHeader}>
                    <View style={styles.waterTitleRow}>
                      <Feather name="droplet" size={16} color="#3B82F6" />
                      <Text style={[styles.waterTitle, { color: colors.foreground }]}>Hydration</Text>
                    </View>
                    <Text style={[styles.waterAmount, { color: colors.mutedForeground }]}>
                      {(waterMl / 1000).toFixed(1)}L / {(waterTarget / 1000).toFixed(1)}L
                    </Text>
                  </View>
                  <View style={[styles.waterBarBg, { backgroundColor: colors.muted }]}>
                    <View style={[styles.waterBarFill, { width: `${waterPct * 100}%`, backgroundColor: '#3B82F6' }]} />
                  </View>
                  <View style={styles.waterButtons}>
                    {WATER_AMOUNTS.map((w) => (
                      <Pressable
                        key={w.label}
                        onPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          await logWater(w.ml);
                        }}
                        style={({ pressed }) => [styles.waterBtn, { backgroundColor: colors.muted, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Feather name="plus" size={11} color={colors.primary} />
                        <Text style={[styles.waterBtnText, { color: colors.foreground }]}>{w.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Quick actions */}
                <View style={styles.quickActions}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
                  <View style={styles.quickGrid}>
                    {[
                      { icon: 'plus-circle', label: 'Log Food', color: colors.primary, onPress: () => router.push('/log-food') },
                      { icon: 'book-open', label: 'Recipes', color: '#F59E0B', onPress: () => setActiveTab('Recipes') },
                      { icon: 'shopping-cart', label: 'Grocery', color: '#10B981', onPress: () => setActiveTab('Grocery') },
                      { icon: 'settings', label: 'My Plan', color: '#8B5CF6', onPress: () => router.push('/nutrition-onboarding') },
                    ].map((action) => (
                      <Pressable
                        key={action.label}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); action.onPress(); }}
                        style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Feather name={action.icon as any} size={20} color={action.color} />
                        <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>{action.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Today's log by meal */}
                <View>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today's Food Log</Text>
                    <Pressable
                      onPress={() => router.push('/log-food')}
                      style={({ pressed }) => [styles.addLogBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Feather name="plus" size={14} color={colors.primaryForeground} />
                      <Text style={[styles.addLogBtnText, { color: colors.primaryForeground }]}>Add</Text>
                    </Pressable>
                  </View>

                  {logs.length === 0 ? (
                    <View style={[styles.emptyLog, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <MaterialCommunityIcons name="food-off" size={32} color={colors.mutedForeground} />
                      <Text style={[styles.emptyLogText, { color: colors.mutedForeground }]}>No food logged today</Text>
                      <Pressable onPress={() => router.push('/log-food')} style={({ pressed }) => [styles.emptyLogBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
                        <Text style={[styles.emptyLogBtnText, { color: colors.primaryForeground }]}>Log Your First Meal</Text>
                      </Pressable>
                    </View>
                  ) : (
                    MEAL_CATEGORIES.filter((cat) => logsByCategory[cat.id]?.length > 0).map((cat) => (
                      <View key={cat.id} style={[styles.mealGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.mealGroupHeader}>
                          <MaterialCommunityIcons name={cat.icon as any} size={16} color={colors.primary} />
                          <Text style={[styles.mealGroupTitle, { color: colors.foreground }]}>{cat.label}</Text>
                          <Text style={[styles.mealGroupCal, { color: colors.mutedForeground }]}>
                            {Math.round(logsByCategory[cat.id].reduce((s, l) => s + (l.calories || 0), 0))} kcal
                          </Text>
                        </View>
                        {logsByCategory[cat.id].map((log) => (
                          <View key={log.id} style={[styles.logItem, { borderTopColor: colors.border }]}>
                            <View style={styles.logItemInfo}>
                              <Text style={[styles.logItemName, { color: colors.foreground }]}>{log.food_name}</Text>
                              <Text style={[styles.logItemMacros, { color: colors.mutedForeground }]}>
                                {Math.round(log.calories)} kcal · P{Math.round(log.protein)}g · C{Math.round(log.carbs)}g · F{Math.round(log.fat)}g
                              </Text>
                            </View>
                            <Pressable onPress={() => {
                              Alert.alert('Remove Entry', `Remove "${log.food_name}"?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => deleteLog(log.id) },
                              ]);
                            }}>
                              <Feather name="x" size={16} color={colors.mutedForeground} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ))
                  )}
                </View>

                {/* Disclaimer */}
                <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
                  Nutrition values are estimates for educational wellness purposes only. Consult a healthcare professional for personalized medical dietary advice.
                </Text>
              </>
            )}
          </>
        )}

        {/* ─── RECIPES TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'Recipes' && (
          <>
            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search recipes…"
                placeholderTextColor={colors.mutedForeground}
                value={recipeSearch}
                onChangeText={setRecipeSearch}
              />
              {recipeSearch.length > 0 && (
                <Pressable onPress={() => setRecipeSearch('')}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPills}>
              {RECIPE_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRecipeCategory(cat); }}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: recipeCategory === cat ? colors.primary : colors.card,
                      borderColor: recipeCategory === cat ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.categoryPillText, { color: recipeCategory === cat ? colors.primaryForeground : colors.mutedForeground }]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {recipesLoading ? (
              <View style={styles.centerLoad}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : recipes.length === 0 ? (
              <View style={[styles.emptyRecipes, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="book-open" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No recipes found</Text>
              </View>
            ) : (
              <View style={styles.recipeGrid}>
                {recipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isSaved={savedRecipeIds.has(recipe.id)}
                    colors={colors}
                    onPress={() => router.push(`/nutrition-recipe/${recipe.id}`)}
                    onSave={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (savedRecipeIds.has(recipe.id)) unsaveRecipe(recipe.id);
                      else saveRecipe(recipe.id);
                    }}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ─── GROCERY TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'Grocery' && (
          <>
            <View style={styles.groceryHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Shopping List</Text>
              <Pressable
                onPress={() => setAddingItem(true)}
                style={({ pressed }) => [styles.addLogBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="plus" size={14} color={colors.primaryForeground} />
                <Text style={[styles.addLogBtnText, { color: colors.primaryForeground }]}>Add Item</Text>
              </Pressable>
            </View>

            {addingItem && (
              <View style={[styles.addItemRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.addItemInput, { color: colors.foreground }]}
                  placeholder="Item name…"
                  placeholderTextColor={colors.mutedForeground}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  autoFocus
                  onSubmitEditing={async () => {
                    if (newItemName.trim()) {
                      await addGroceryItem({ category: 'Other', name: newItemName.trim() });
                      setNewItemName('');
                      setAddingItem(false);
                    }
                  }}
                />
                <Pressable onPress={() => setAddingItem(false)}>
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}

            {groceryItems.length === 0 ? (
              <View style={[styles.emptyRecipes, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="shopping-cart" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your grocery list is empty</Text>
                <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
                  Visit a recipe and tap "Add to Grocery List"
                </Text>
              </View>
            ) : (
              <>
                {Object.entries(groceryByCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                  <View key={category} style={styles.grocerySection}>
                    <Text style={[styles.groceryCategoryTitle, { color: colors.mutedForeground }]}>{category.toUpperCase()}</Text>
                    <View style={[styles.grocerySectionContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {items.map((item) => (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            toggleGroceryItem(item.id, !item.is_checked);
                          }}
                          style={[styles.groceryItem, { borderTopColor: colors.border }]}
                        >
                          <View style={[
                            styles.groceryCheckbox,
                            { borderColor: item.is_checked ? '#10B981' : colors.border, backgroundColor: item.is_checked ? '#10B981' : 'transparent' },
                          ]}>
                            {item.is_checked && <Feather name="check" size={11} color="#fff" />}
                          </View>
                          <View style={styles.groceryItemInfo}>
                            <Text style={[styles.groceryItemName, { color: item.is_checked ? colors.mutedForeground : colors.foreground, textDecorationLine: item.is_checked ? 'line-through' : 'none' }]}>
                              {item.name}
                            </Text>
                            {item.amount ? (
                              <Text style={[styles.groceryItemAmount, { color: colors.mutedForeground }]}>{item.amount} {item.unit}</Text>
                            ) : null}
                          </View>
                          <Pressable onPress={() => deleteGroceryItem(item.id)}>
                            <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                          </Pressable>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
                <View style={styles.groceryFooter}>
                  <Text style={[styles.groceryCount, { color: colors.mutedForeground }]}>
                    {groceryItems.filter((i) => i.is_checked).length} of {groceryItems.length} items checked
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroBar({ label, value, target, color, unit, colors }: any) {
  const pct = Math.min(1, value / (target || 1));
  return (
    <View style={styles.macroBarItem}>
      <View style={styles.macroBarLabelRow}>
        <Text style={[styles.macroBarLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.macroBarValue, { color: colors.foreground }]}>{Math.round(value)}{unit}</Text>
      </View>
      <View style={[styles.macroBarBg, { backgroundColor: colors.muted }]}>
        <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.macroBarTarget, { color: colors.mutedForeground }]}>/ {target}{unit}</Text>
    </View>
  );
}

function RecipeCard({ recipe, isSaved, colors, onPress, onSave }: { recipe: Recipe; isSaved: boolean; colors: any; onPress: () => void; onSave: () => void }) {
  const totalTime = (recipe.prep_time_mins || 0) + (recipe.cook_time_mins || 0);
  const CATEGORY_COLORS: Record<string, string> = {
    Breakfast: '#F59E0B', Lunch: '#3B82F6', Dinner: '#8B5CF6', Smoothies: '#10B981', Snacks: '#F97316',
  };
  const cardColor = CATEGORY_COLORS[recipe.category] ?? '#64748B';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.recipeCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      {/* Image placeholder */}
      <View style={[styles.recipeImagePlaceholder, { backgroundColor: `${cardColor}22` }]}>
        <MaterialCommunityIcons name="food" size={28} color={cardColor} />
        <View style={[styles.recipeCategoryBadge, { backgroundColor: cardColor }]}>
          <Text style={styles.recipeCategoryBadgeText}>{recipe.category}</Text>
        </View>
      </View>

      <View style={styles.recipeCardBody}>
        <Text style={[styles.recipeCardTitle, { color: colors.foreground }]} numberOfLines={2}>{recipe.title}</Text>
        <View style={styles.recipeCardMeta}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[styles.recipeCardMetaText, { color: colors.mutedForeground }]}>{totalTime} min</Text>
          <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
          <Text style={[styles.recipeCardMetaText, { color: colors.mutedForeground }]}>{recipe.calories} kcal</Text>
          <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
          <Text style={[styles.recipeCardMetaText, { color: colors.mutedForeground }]}>P{Math.round(recipe.protein)}g</Text>
        </View>
        <View style={styles.recipeCardFooter}>
          <View style={[styles.difficultyBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.difficultyText, { color: colors.mutedForeground }]}>{recipe.difficulty}</Text>
          </View>
          <Pressable onPress={onSave} style={styles.saveBtn}>
            <Feather name={isSaved ? 'bookmark' : 'bookmark'} size={16} color={isSaved ? colors.primary : colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  subTabs: { flexDirection: 'row', gap: 0 },
  subTab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  subTabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 16 },
  centerLoad: { paddingVertical: 40, alignItems: 'center' },

  // Onboarding prompt
  onboardingPrompt: { flex: 1, alignItems: 'center', paddingHorizontal: 32, gap: 16, justifyContent: 'center' },
  onboardingTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  onboardingBody: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  onboardingBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, alignItems: 'center', width: '100%' },
  onboardingBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  onboardingDisclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 16 },

  // Motivation
  motivationCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  motivationText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },

  // Calorie ring
  calorieCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 16 },
  calorieRingRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringContainer: { alignItems: 'center', justifyContent: 'center' },
  ringOuter: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 8,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  ringFill: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    borderWidth: 8, borderColor: 'transparent', borderTopColor: '#007AFF',
  },
  ringInner: { alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 40 },
  ringCalories: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  ringUnit: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  calorieStats: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  calorieStat: { flex: 1, alignItems: 'center' },
  calorieStatValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  calorieStatLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  calorieDivider: { width: 1, height: 36 },
  macrosRow: { flexDirection: 'row', gap: 10 },
  macroBarItem: { flex: 1 },
  macroBarLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroBarLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  macroBarValue: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  macroBarBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: 5, borderRadius: 3 },
  macroBarTarget: { fontSize: 9, marginTop: 2 },

  // Water
  waterCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waterTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  waterAmount: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  waterBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  waterBarFill: { height: 8, borderRadius: 4 },
  waterButtons: { flexDirection: 'row', gap: 8 },
  waterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  waterBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  // Quick actions
  quickActions: { gap: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickAction: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  quickActionLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Log
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addLogBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addLogBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  emptyLog: { alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1, gap: 10 },
  emptyLogText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  emptyLogBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyLogBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  mealGroup: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  mealGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  mealGroupTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  mealGroupCal: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  logItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, gap: 10 },
  logItemInfo: { flex: 1 },
  logItemName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  logItemMacros: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },

  disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },

  // Recipes
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  categoryPills: { gap: 8, paddingVertical: 4 },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  categoryPillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  emptyRecipes: { alignItems: 'center', padding: 32, borderRadius: 16, borderWidth: 1, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  emptySubText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  recipeGrid: { gap: 12 },
  recipeCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  recipeImagePlaceholder: { height: 100, alignItems: 'center', justifyContent: 'center' },
  recipeCategoryBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  recipeCategoryBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
  recipeCardBody: { padding: 12, gap: 6 },
  recipeCardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', lineHeight: 18 },
  recipeCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recipeCardMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  recipeCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  difficultyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  difficultyText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { padding: 4 },

  // Grocery
  groceryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addItemRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, gap: 10 },
  addItemInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  grocerySection: { gap: 6 },
  groceryCategoryTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, paddingHorizontal: 2 },
  grocerySectionContent: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  groceryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: 1 },
  groceryCheckbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  groceryItemInfo: { flex: 1 },
  groceryItemName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  groceryItemAmount: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  groceryFooter: { alignItems: 'center', paddingVertical: 8 },
  groceryCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
