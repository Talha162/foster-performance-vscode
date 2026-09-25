import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

export interface NutritionProfile {
  onboarding_complete: boolean;
  goal: string | null;
  secondary_goals: string[];
  daily_calories: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  fiber_target: number;
  water_target_ml: number;
  tracking_mode: 'guided' | 'detailed';
  dietary_pattern: string;
  allergies: string[];
  intolerances: string[];
  activity_level: string;
  meal_frequency: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  category: string;
  goal_tags: string[];
  dietary_tags: string[];
  allergy_tags: string[];
  prep_time_mins: number;
  cook_time_mins: number;
  servings: number;
  difficulty: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium?: number;
  cost_per_serving?: number;
  ingredients?: { amount: string; name: string; substitutes: string[] }[];
  instructions?: string[];
  storage?: string;
  reheat?: string;
  equipment?: string[];
}

export interface FoodLog {
  id: string;
  meal_category: string;
  food_name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  serving_amount: number;
  serving_unit: string;
  notes?: string;
  recipe_id?: string;
  logged_at: string;
}

export interface DashboardData {
  profile: NutritionProfile;
  today: {
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    calories_remaining: number;
    water_ml: number;
  };
  logs: FoodLog[];
  nutrition_score: number;
}

export interface GroceryItem {
  id: string;
  list_id: string;
  category: string;
  name: string;
  amount: string;
  unit: string;
  is_checked: boolean;
  custom_added: boolean;
}

interface NutritionContextValue {
  profile: NutritionProfile | null;
  dashboard: DashboardData | null;
  recipes: Recipe[];
  savedRecipeIds: Set<string>;
  groceryItems: GroceryItem[];
  groceryListId: string | null;
  loading: boolean;
  dashboardLoading: boolean;
  recipesLoading: boolean;
  loadDashboard: () => Promise<void>;
  loadRecipes: (filters?: { category?: string; q?: string; dietary?: string }) => Promise<void>;
  saveProfile: (updates: Partial<NutritionProfile>) => Promise<void>;
  logFood: (entry: Omit<FoodLog, 'id' | 'logged_at'>) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  logWater: (ml?: number) => Promise<void>;
  saveRecipe: (recipeId: string) => Promise<void>;
  unsaveRecipe: (recipeId: string) => Promise<void>;
  loadSavedRecipes: () => Promise<void>;
  loadGroceryList: () => Promise<void>;
  addGroceryItem: (item: { category: string; name: string; amount?: string; unit?: string }) => Promise<void>;
  toggleGroceryItem: (id: string, checked: boolean) => Promise<void>;
  deleteGroceryItem: (id: string) => Promise<void>;
  createGroceryListFromRecipe: (recipe: Recipe) => Promise<void>;
}

const NutritionContext = createContext<NutritionContextValue | null>(null);

const defaultProfile: NutritionProfile = {
  onboarding_complete: false,
  goal: null,
  secondary_goals: [],
  daily_calories: 2000,
  protein_target: 150,
  carbs_target: 200,
  fat_target: 65,
  fiber_target: 30,
  water_target_ml: 2500,
  tracking_mode: 'guided',
  dietary_pattern: 'omnivore',
  allergies: [],
  intolerances: [],
  activity_level: 'moderately_active',
  meal_frequency: 'three_plus_snacks',
};

function normalizeRecipe(row: any): Recipe {
  return {
    ...row,
    description: row.description ?? '',
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    fiber: Number(row.fiber),
    sodium: Number(row.sodium),
    cost_per_serving: Number(row.cost_per_serving),
    storage: row.storage_notes ?? undefined,
    reheat: row.reheat_notes ?? undefined,
  };
}

export function NutritionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(new Set());
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [groceryListId, setGroceryListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setDashboardLoading(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const [profileResult, foodResult, waterResult] = await Promise.all([
        supabase.from('nutrition_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('food_logs').select('*').eq('user_id', user.id).gte('logged_at', start.toISOString()).lt('logged_at', end.toISOString()).order('logged_at', { ascending: false }),
        supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).gte('logged_at', start.toISOString()).lt('logged_at', end.toISOString()),
      ]);
      if (profileResult.error || foodResult.error || waterResult.error) {
        throw new Error(profileResult.error?.message ?? foodResult.error?.message ?? waterResult.error?.message);
      }
      const activeProfile = (profileResult.data ?? defaultProfile) as NutritionProfile;
      const logs = (foodResult.data ?? []) as FoodLog[];
      const sum = (field: keyof Pick<FoodLog, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber'>) =>
        logs.reduce((total, log) => total + Number(log[field] ?? 0), 0);
      const calories = sum('calories');
      const protein = sum('protein');
      const carbs = sum('carbs');
      const fat = sum('fat');
      const fiber = sum('fiber');
      const water = (waterResult.data ?? []).reduce((total, row) => total + row.amount_ml, 0);
      const ratios = [
        calories / activeProfile.daily_calories,
        protein / activeProfile.protein_target,
        carbs / activeProfile.carbs_target,
        fat / activeProfile.fat_target,
        fiber / activeProfile.fiber_target,
        water / activeProfile.water_target_ml,
      ].map((ratio) => Math.min(1, Math.max(0, ratio)));
      const nutritionScore = Math.round(ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length * 100);
      setProfile(activeProfile);
      setDashboard({
        profile: activeProfile,
        today: {
          date: start.toISOString().slice(0, 10),
          calories,
          protein,
          carbs,
          fat,
          fiber,
          calories_remaining: Math.max(0, activeProfile.daily_calories - calories),
          water_ml: water,
        },
        logs,
        nutrition_score: nutritionScore,
      });
    } finally {
      setDashboardLoading(false);
    }
  }, [user]);

  const loadRecipes = useCallback(async (filters: { category?: string; q?: string; dietary?: string } = {}) => {
    setRecipesLoading(true);
    try {
      let query = supabase.from('recipes').select('*').eq('is_published', true).order('title');
      if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category);
      if (filters.q) query = query.ilike('title', `%${filters.q}%`);
      if (filters.dietary) query = query.contains('dietary_tags', [filters.dietary]);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      setRecipes((data ?? []).map(normalizeRecipe));
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (updates: Partial<NutritionProfile>) => {
    if (!user) return;
    const next = { ...(profile ?? defaultProfile), ...updates };
    const { error } = await supabase.from('nutrition_profiles').upsert({ user_id: user.id, ...next });
    if (error) throw new Error(error.message);
    setProfile(next);
    await loadDashboard();
  }, [loadDashboard, profile, user]);

  const logFood = useCallback(async (entry: Omit<FoodLog, 'id' | 'logged_at'>) => {
    if (!user) return;
    const { error } = await supabase.from('food_logs').insert({ user_id: user.id, ...entry });
    if (error) throw new Error(error.message);
    await loadDashboard();
  }, [loadDashboard, user]);

  const deleteLog = useCallback(async (id: string) => {
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await loadDashboard();
  }, [loadDashboard]);

  const logWater = useCallback(async (amount_ml = 250) => {
    if (!user) return;
    const { error } = await supabase.from('water_logs').insert({ user_id: user.id, amount_ml });
    if (error) throw new Error(error.message);
    await loadDashboard();
  }, [loadDashboard, user]);

  const saveRecipe = useCallback(async (recipeId: string) => {
    if (!user) return;
    const { error } = await supabase.from('saved_recipes').insert({ user_id: user.id, recipe_id: recipeId });
    if (error && error.code !== '23505') throw new Error(error.message);
    setSavedRecipeIds((current) => new Set([...current, recipeId]));
  }, [user]);

  const unsaveRecipe = useCallback(async (recipeId: string) => {
    if (!user) return;
    const { error } = await supabase.from('saved_recipes').delete().eq('user_id', user.id).eq('recipe_id', recipeId);
    if (error) throw new Error(error.message);
    setSavedRecipeIds((current) => {
      const next = new Set(current);
      next.delete(recipeId);
      return next;
    });
  }, [user]);

  const loadSavedRecipes = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('saved_recipes').select('recipe_id').eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setSavedRecipeIds(new Set((data ?? []).map((row) => row.recipe_id)));
  }, [user]);

  const loadGroceryList = useCallback(async () => {
    if (!user) return;
    const listResult = await supabase.from('grocery_lists').select('id').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (listResult.error) throw new Error(listResult.error.message);
    if (!listResult.data) {
      setGroceryListId(null);
      setGroceryItems([]);
      return;
    }
    const itemResult = await supabase.from('grocery_items').select('*').eq('list_id', listResult.data.id).order('created_at');
    if (itemResult.error) throw new Error(itemResult.error.message);
    setGroceryListId(listResult.data.id);
    setGroceryItems((itemResult.data ?? []) as GroceryItem[]);
  }, [user]);

  const ensureGroceryList = useCallback(async () => {
    if (!user) throw new Error('You must be signed in.');
    if (groceryListId) return groceryListId;
    const { data, error } = await supabase.from('grocery_lists').insert({ user_id: user.id }).select('id').single();
    if (error) throw new Error(error.message);
    setGroceryListId(data.id);
    return data.id;
  }, [groceryListId, user]);

  const addGroceryItem = useCallback(async (item: { category: string; name: string; amount?: string; unit?: string }) => {
    const listId = await ensureGroceryList();
    const { data, error } = await supabase.from('grocery_items').insert({
      list_id: listId,
      category: item.category,
      name: item.name,
      amount: item.amount ?? '',
      unit: item.unit ?? '',
      custom_added: true,
    }).select('*').single();
    if (error) throw new Error(error.message);
    setGroceryItems((current) => [...current, data as GroceryItem]);
  }, [ensureGroceryList]);

  const toggleGroceryItem = useCallback(async (id: string, is_checked: boolean) => {
    const { error } = await supabase.from('grocery_items').update({ is_checked }).eq('id', id);
    if (error) throw new Error(error.message);
    setGroceryItems((current) => current.map((item) => item.id === id ? { ...item, is_checked } : item));
  }, []);

  const deleteGroceryItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('grocery_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setGroceryItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const createGroceryListFromRecipe = useCallback(async (recipe: Recipe) => {
    if (!user || !recipe.ingredients?.length) return;
    await supabase.from('grocery_lists').update({ is_active: false }).eq('user_id', user.id);
    const list = await supabase.from('grocery_lists').insert({
      user_id: user.id,
      title: `${recipe.title} — Ingredients`,
    }).select('id').single();
    if (list.error) throw new Error(list.error.message);
    const items = recipe.ingredients.map((ingredient) => ({
      list_id: list.data.id,
      category: categorizeIngredient(ingredient.name),
      name: ingredient.name,
      amount: ingredient.amount,
      unit: '',
    }));
    const inserted = await supabase.from('grocery_items').insert(items);
    if (inserted.error) throw new Error(inserted.error.message);
    setGroceryListId(list.data.id);
    await loadGroceryList();
  }, [loadGroceryList, user]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setDashboard(null);
      setSavedRecipeIds(new Set());
      setGroceryItems([]);
      return;
    }
    setLoading(true);
    void Promise.allSettled([loadDashboard(), loadRecipes(), loadSavedRecipes(), loadGroceryList()])
      .then(() => setLoading(false));
  }, [user, loadDashboard, loadRecipes, loadSavedRecipes, loadGroceryList]);

  return (
    <NutritionContext.Provider value={{
      profile, dashboard, recipes, savedRecipeIds, groceryItems, groceryListId,
      loading, dashboardLoading, recipesLoading,
      loadDashboard, loadRecipes, saveProfile, logFood, deleteLog, logWater,
      saveRecipe, unsaveRecipe, loadSavedRecipes, loadGroceryList, addGroceryItem,
      toggleGroceryItem, deleteGroceryItem, createGroceryListFromRecipe,
    }}>
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutrition() {
  const context = useContext(NutritionContext);
  if (!context) throw new Error('useNutrition must be used within NutritionProvider');
  return context;
}

function categorizeIngredient(name: string) {
  const lower = name.toLowerCase();
  if (/chicken|beef|turkey|salmon|tuna|fish|pork|shrimp|tofu|tempeh|egg/.test(lower)) return 'Protein';
  if (/milk|yogurt|cheese|butter|cream/.test(lower)) return 'Dairy & Alternatives';
  if (/rice|oat|pasta|bread|quinoa|flour|tortilla|grain/.test(lower)) return 'Grains';
  if (/can|beans|lentil|chickpea|tomato|broth|sauce|paste/.test(lower)) return 'Canned & Pantry';
  if (/frozen|edamame/.test(lower)) return 'Frozen';
  if (/salt|pepper|spice|seasoning|cumin|turmeric|paprika|cinnamon|oregano|thyme/.test(lower)) return 'Spices';
  if (/olive oil|oil|honey|maple|vinegar|mustard|soy sauce/.test(lower)) return 'Condiments';
  if (/protein powder|supplement/.test(lower)) return 'Supplements';
  return 'Produce';
}
