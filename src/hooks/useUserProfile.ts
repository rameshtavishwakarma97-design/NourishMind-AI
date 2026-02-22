import { useState, useEffect, useCallback } from 'react';
import { supabase, getCurrentUserId, invokeFunction, isDemoMode } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  full_name: string | null;
  age: number | null;
  biological_sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  primary_goal: string | null;
  health_conditions: string[] | null;
  dietary_pattern: string | null;
  food_allergies: string[] | null;
  occupation: string | null;
  typical_sleep_time: string | null;
  typical_wake_time: string | null;
  typical_workout_time: string | null;
  workout_type: string | null;
  workout_duration_mins: number | null;
  ai_context_field: string | null;
  hydration_target_ml: number | null;
  onboarding_complete: boolean;
}

const demoProfile: UserProfile = {
  id: 'demo-user-id',
  full_name: 'Rameshta Vishwakarma',
  age: 24,
  biological_sex: 'female',
  height_cm: 163,
  weight_kg: 58,
  primary_goal: 'Muscle Gain',
  health_conditions: ['IBS / Gut Issues', 'Anxiety / Depression'],
  dietary_pattern: 'Vegetarian on weekdays',
  food_allergies: null,
  occupation: 'MBA student at SPJIMR',
  typical_sleep_time: '00:00',
  typical_wake_time: '07:00',
  typical_workout_time: '18:00',
  workout_type: 'Calisthenics and Cardio',
  workout_duration_mins: 60,
  ai_context_field: 'I am an MBA student at SPJIMR Mumbai eating college mess food on weekdays. I travel home to Pimpri on weekends. I keep a fast every Ekadashi. I work out 5 days a week doing calisthenics and cardio.',
  hydration_target_ml: 2500,
  onboarding_complete: true,
};

const demoAiSummary = '• 24-year-old female MBA student at SPJIMR\n• Goal: Weight maintenance + muscle gain\n• Conditions: IBS, Anxiety\n• Schedule: Classes 9–5, gym 6–7 PM, sleep ~midnight\n• Diet: Vegetarian on weekdays\n• Supplements: Vitamin D3, Ashwagandha 300mg\n• Eats mostly hostel mess food during weekdays';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(isDemoMode ? demoProfile : null);
  const [aiSummary, setAiSummary] = useState<string | null>(isDemoMode ? demoAiSummary : null);
  const [loading, setLoading] = useState(isDemoMode ? false : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (isDemoMode) return;
    try {
      setLoading(true);
      const userId = await getCurrentUserId();
      if (!userId) return;

      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setProfile(data as UserProfile ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (isDemoMode) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return { success: true };
    }
    try {
      setSaving(true);
      setError(null);
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error: updateError } = await supabase
        .from('user_profiles')
        .upsert({ id: userId, ...updates }, { onConflict: 'id' })
        .select()
        .single();

      if (updateError) throw updateError;
      setProfile(data as UserProfile);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setSaving(false);
    }
  }, []);

  const completeOnboarding = useCallback(async (onboardingData: Partial<UserProfile>) => {
    return updateProfile({
      ...onboardingData,
      onboarding_complete: true,
    });
  }, [updateProfile]);

  const fetchAiSummary = useCallback(async () => {
    if (isDemoMode) return demoAiSummary;
    try {
      const { data } = await invokeFunction<Record<string, never>, { summary: string }>('user-summary', {});
      if (data) {
        setAiSummary(data.summary);
        return data.summary;
      }
      return null;
    } catch {
      console.warn('AI summary unavailable');
      return null;
    }
  }, []);

  return {
    profile,
    aiSummary,
    loading,
    saving,
    error,
    updateProfile,
    completeOnboarding,
    fetchAiSummary,
    refresh: fetchProfile,
  };
}
