import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

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

export function useNutrition() {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition must be used within NutritionProvider');
  return ctx;
}

async function apiFetch(path: string, token: string | null, options?: RequestInit) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers: { ...headers, ...((options?.headers as any) ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const GROCERY_LIST_KEY = '@fp_grocery_list_id';

export function NutritionProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

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
    if (!token) return;
    setDashboardLoading(true);
    try {
      const data = await apiFetch('/nutrition/dashboard', token);
      setDashboard(data);
      setProfile(data.profile);
    } catch (e) {
      // Non-fatal — keep stale data
    } finally {
      setDashboardLoading(false);
    }
  }, [token]);

  const loadRecipes = useCallback(async (filters: { category?: string; q?: string; dietary?: string } = {}) => {
    setRecipesLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.category && filters.category !== 'All') params.set('category', filters.category);
      if (filters.q) params.set('q', filters.q);
      if (filters.dietary) params.set('dietary', filters.dietary);
      const data = await apiFetch(`/nutrition/recipes?${params}`, token);
      setRecipes(data.recipes ?? []);
    } catch {
      // keep stale
    } finally {
      setRecipesLoading(false);
    }
  }, [token]);

  const saveProfile = useCallback(async (updates: Partial<NutritionProfile>) => {
    if (!token) return;
    const merged = { ...(profile ?? {}), ...updates };
    await apiFetch('/nutrition/profile', token, { method: 'PUT', body: JSON.stringify(merged) });
    setProfile(merged as NutritionProfile);
  }, [token, profile]);

  const logFood = useCallback(async (entry: Omit<FoodLog, 'id' | 'logged_at'>) => {
    if (!token) return;
    await apiFetch('/nutrition/food-logs', token, { method: 'POST', body: JSON.stringify(entry) });
    await loadDashboard();
  }, [token, loadDashboard]);

  const deleteLog = useCallback(async (id: string) => {
    if (!token) return;
    await apiFetch(`/nutrition/food-logs/${id}`, token, { method: 'DELETE' });
    await loadDashboard();
  }, [token, loadDashboard]);

  const logWater = useCallback(async (ml = 250) => {
    if (!token) return;
    await apiFetch('/nutrition/water-logs', token, { method: 'POST', body: JSON.stringify({ amount_ml: ml }) });
    await loadDashboard();
  }, [token, loadDashboard]);

  const saveRecipe = useCallback(async (recipeId: string) => {
    if (!token) return;
    await apiFetch(`/nutrition/recipes/${recipeId}/save`, token, { method: 'POST' });
    setSavedRecipeIds((prev) => new Set([...prev, recipeId]));
  }, [token]);

  const unsaveRecipe = useCallback(async (recipeId: string) => {
    if (!token) return;
    await apiFetch(`/nutrition/recipes/${recipeId}/save`, token, { method: 'DELETE' });
    setSavedRecipeIds((prev) => { const s = new Set(prev); s.delete(recipeId); return s; });
  }, [token]);

  const loadSavedRecipes = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/nutrition/saved-recipes', token);
      setSavedRecipeIds(new Set((data.recipes ?? []).map((r: Recipe) => r.id)));
    } catch { /* non-fatal */ }
  }, [token]);

  const loadGroceryList = useCallback(async () => {
    if (!token) return;
    try {
      const storedId = await AsyncStorage.getItem(GROCERY_LIST_KEY);
      const data = await apiFetch('/nutrition/grocery-lists', token);
      if (data.active) {
        setGroceryListId(data.active.id);
        setGroceryItems(data.items ?? []);
        if (data.active.id !== storedId) {
          await AsyncStorage.setItem(GROCERY_LIST_KEY, data.active.id);
        }
      } else {
        setGroceryItems([]);
      }
    } catch { /* non-fatal */ }
  }, [token]);

  const ensureGroceryList = useCallback(async (): Promise<string> => {
    if (groceryListId) return groceryListId;
    const data = await apiFetch('/nutrition/grocery-lists/create', token, {
      method: 'POST',
      body: JSON.stringify({ title: 'My Grocery List', items: [] }),
    });
    const id = data.list_id;
    setGroceryListId(id);
    await AsyncStorage.setItem(GROCERY_LIST_KEY, id);
    return id;
  }, [groceryListId, token]);

  const addGroceryItem = useCallback(async (item: { category: string; name: string; amount?: string; unit?: string }) => {
    if (!token) return;
    let listId = groceryListId;
    if (!listId) {
      const data = await apiFetch('/nutrition/grocery-lists', token, {
        method: 'POST', body: JSON.stringify({ title: 'My Grocery List', items: [] }),
      });
      listId = data.list_id;
      setGroceryListId(listId!);
      if (listId) await AsyncStorage.setItem(GROCERY_LIST_KEY, listId);
    }
    const newItem = await apiFetch('/nutrition/grocery-items', token, {
      method: 'POST',
      body: JSON.stringify({ list_id: listId, ...item }),
    });
    setGroceryItems((prev) => [...prev, newItem]);
  }, [token, groceryListId]);

  const toggleGroceryItem = useCallback(async (id: string, checked: boolean) => {
    if (!token) return;
    await apiFetch(`/nutrition/grocery-items/${id}`, token, {
      method: 'PATCH', body: JSON.stringify({ is_checked: checked }),
    });
    setGroceryItems((prev) => prev.map((i) => i.id === id ? { ...i, is_checked: checked } : i));
  }, [token]);

  const deleteGroceryItem = useCallback(async (id: string) => {
    if (!token) return;
    await apiFetch(`/nutrition/grocery-items/${id}`, token, { method: 'DELETE' });
    setGroceryItems((prev) => prev.filter((i) => i.id !== id));
  }, [token]);

  const createGroceryListFromRecipe = useCallback(async (recipe: Recipe) => {
    if (!token || !recipe.ingredients) return;
    const items = recipe.ingredients.map((ing) => ({
      category: categorizeIngredient(ing.name),
      name: ing.name,
      amount: ing.amount,
      unit: '',
    }));
    const data = await apiFetch('/nutrition/grocery-lists', token, {
      method: 'POST',
      body: JSON.stringify({ title: `${recipe.title} — Ingredients`, items }),
    });
    setGroceryListId(data.list_id);
    await loadGroceryList();
  }, [token, loadGroceryList]);

  useEffect(() => {
    if (token) {
      loadDashboard();
      loadRecipes();
      loadSavedRecipes();
      loadGroceryList();
    }
  }, [token]);

  return (
    <NutritionContext.Provider value={{
      profile, dashboard, recipes, savedRecipeIds, groceryItems, groceryListId,
      loading, dashboardLoading, recipesLoading,
      loadDashboard, loadRecipes, saveProfile, logFood, deleteLog, logWater,
      saveRecipe, unsaveRecipe, loadSavedRecipes,
      loadGroceryList, addGroceryItem, toggleGroceryItem, deleteGroceryItem,
      createGroceryListFromRecipe,
    }}>
      {children}
    </NutritionContext.Provider>
  );
}

function categorizeIngredient(name: string): string {
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
