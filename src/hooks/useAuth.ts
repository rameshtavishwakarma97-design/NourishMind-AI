import { useState, useEffect, useCallback } from 'react';
import { supabase, isDemoMode } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

// Mock user for demo mode
const demoUser = {
  id: 'demo-user-id',
  email: 'rameshta@email.com',
  user_metadata: { full_name: 'Rameshta Vishwakarma' },
} as unknown as User;

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: isDemoMode ? demoUser : null,
    session: isDemoMode ? ({ user: demoUser } as unknown as Session) : null,
    loading: isDemoMode ? false : true,
    error: null,
  });

  useEffect(() => {
    if (isDemoMode) return;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        error: error?.message ?? null,
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session,
          loading: false,
        }));
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (isDemoMode) return { data: { user: demoUser, session: null }, error: null };
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setState(prev => ({ ...prev, user: data.user, session: data.session, loading: false, error: error?.message ?? null }));
    return { data, error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, fullName?: string) => {
    if (isDemoMode) return { data: { user: demoUser, session: null }, error: null };
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    setState(prev => ({ ...prev, user: data.user, session: data.session, loading: false, error: error?.message ?? null }));
    return { data, error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (isDemoMode) return { data: null, error: null };
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app/chat` },
    });
    if (error) setState(prev => ({ ...prev, loading: false, error: error.message }));
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoMode) return { error: null };
    setState(prev => ({ ...prev, loading: true }));
    const { error } = await supabase.auth.signOut();
    setState({ user: null, session: null, loading: false, error: error?.message ?? null });
    return { error };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (isDemoMode) return { error: null };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/app/settings`,
    });
    return { error };
  }, []);

  return {
    ...state,
    isAuthenticated: isDemoMode || !!state.session,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
  };
}
