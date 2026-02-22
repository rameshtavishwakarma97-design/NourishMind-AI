import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';

interface MealLog {
  id: string;
  meal_type: string;
  raw_input: string;
  total_calories: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
  total_fiber_g: number | null;
  overall_confidence_score: number | null;
  logged_at: string;
  meal_ingredients: MealIngredient[];
}

interface MealIngredient {
  id: string;
  ingredient_name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  iron_mg?: number;
  calcium_mg?: number;
  magnesium_mg?: number;
  potassium_mg?: number;
  sodium_mg?: number;
  vitamin_d_mcg?: number;
  zinc_mg?: number;
  folate_mcg?: number;
  vitamin_b12_mcg?: number;
  confidence_source: string;
  confidence_score: number;
}

export function useFoodLog(date?: string) {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetDate = date || new Date().toISOString().split('T')[0];

  const fetchMeals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const userId = await getCurrentUserId();
      if (!userId) return;

      const { data, error: fetchError } = await supabase
        .from('meal_logs')
        .select('*, meal_ingredients(*)')
        .eq('user_id', userId)
        .gte('logged_at', `${targetDate}T00:00:00`)
        .lte('logged_at', `${targetDate}T23:59:59`)
        .order('logged_at', { ascending: true });

      if (fetchError) throw fetchError;
      setMeals((data as MealLog[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meals');
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const deleteMeal = useCallback(async (mealId: string) => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      // Delete ingredients first
      await supabase.from('meal_ingredients').delete().eq('meal_log_id', mealId);
      const { error: delError } = await supabase
        .from('meal_logs')
        .delete()
        .eq('id', mealId)
        .eq('user_id', userId);

      if (delError) throw delError;

      // Re-upsert daily totals
      await supabase.rpc('upsert_daily_totals', {
        p_user_id: userId,
        p_log_date: targetDate,
      });

      setMeals(prev => prev.filter(m => m.id !== mealId));
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Delete failed' };
    }
  }, [targetDate]);

  const updateMealIngredients = useCallback(async (mealId: string, ingredients: Omit<MealIngredient, 'id' | 'confidence_source' | 'confidence_score'>[]) => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      // Delete existing ingredients
      await supabase.from('meal_ingredients').delete().eq('meal_log_id', mealId);

      // Insert new ingredients
      const rows = ingredients.map(ing => ({
        meal_log_id: mealId,
        ingredient_name: ing.ingredient_name,
        quantity_g: ing.quantity_g,
        calories: ing.calories,
        protein_g: ing.protein_g,
        carbs_g: ing.carbs_g,
        fat_g: ing.fat_g,
        confidence_source: 'user_edit',
        confidence_score: 1.0,
      }));
      const { error: insError } = await supabase.from('meal_ingredients').insert(rows);
      if (insError) throw insError;

      // Update meal totals
      const totals = {
        total_calories: ingredients.reduce((s, i) => s + i.calories, 0),
        total_protein_g: ingredients.reduce((s, i) => s + i.protein_g, 0),
        total_carbs_g: ingredients.reduce((s, i) => s + i.carbs_g, 0),
        total_fat_g: ingredients.reduce((s, i) => s + i.fat_g, 0),
      };
      const { error: updError } = await supabase.from('meal_logs').update(totals).eq('id', mealId);
      if (updError) throw updError;

      await fetchMeals();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Update failed' };
    }
  }, [fetchMeals]);

  // Computed daily totals including micronutrients
  const dailyTotals = {
    calories: meals.reduce((sum, m) => sum + (m.total_calories || 0), 0),
    protein: meals.reduce((sum, m) => sum + (m.total_protein_g || 0), 0),
    carbs: meals.reduce((sum, m) => sum + (m.total_carbs_g || 0), 0),
    fat: meals.reduce((sum, m) => sum + (m.total_fat_g || 0), 0),
    fiber: meals.reduce((sum, m) => sum + (m.total_fiber_g || 0), 0),
    // Aggregate micronutrients from ingredients across all meals
    iron_mg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.iron_mg || 0), 0),
    calcium_mg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.calcium_mg || 0), 0),
    magnesium_mg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.magnesium_mg || 0), 0),
    potassium_mg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.potassium_mg || 0), 0),
    sodium_mg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.sodium_mg || 0), 0),
    vitamin_d_mcg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.vitamin_d_mcg || 0), 0),
    zinc_mg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.zinc_mg || 0), 0),
    folate_mcg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.folate_mcg || 0), 0),
    vitamin_b12_mcg: meals.flatMap(m => m.meal_ingredients).reduce((sum, ing) => sum + (ing.vitamin_b12_mcg || 0), 0),
  };

  // Group meals by type
  const mealsByType = {
    breakfast: meals.filter(m => m.meal_type === 'breakfast'),
    lunch: meals.filter(m => m.meal_type === 'lunch'),
    dinner: meals.filter(m => m.meal_type === 'dinner'),
    snacks: meals.filter(m => m.meal_type === 'snacks' || m.meal_type === 'other'),
  };

  return {
    meals,
    mealsByType,
    dailyTotals,
    loading,
    error,
    deleteMeal,
    updateMealIngredients,
    refresh: fetchMeals,
  };
}
