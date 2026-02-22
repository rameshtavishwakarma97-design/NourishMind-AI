/**
 * Supabase Browser Client
 * 
 * Creates a singleton Supabase client for use in the React frontend.
 * Falls back gracefully when env vars are missing (prototype/demo mode).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If env vars are missing, create a dummy client that won't crash
// This allows the prototype to run without a backend
const isDemoMode = !supabaseUrl || !supabaseAnonKey;

export const supabase: SupabaseClient<Database> = isDemoMode
  ? createClient<Database>('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

export { isDemoMode };

/**
 * Helper: invoke a Supabase Edge Function with typed request/response.
 */
export async function invokeFunction<TRequest, TResponse>(
  functionName: string,
  body: TRequest
): Promise<{ data: TResponse | null; error: Error | null }> {
  if (isDemoMode) return { data: null, error: new Error('Demo mode — no backend') };
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body as Record<string, unknown>,
    });
    if (error) {
      let msg = error.message || 'Edge function call failed';
      try {
        if ('context' in error && (error as any).context?.json) {
          const body = await (error as any).context.json();
          if (body?.error) msg = body.error;
        }
      } catch { /* ignore */ }
      return { data: null, error: new Error(msg) };
    }
    return { data: data as TResponse, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

/**
 * Helper: get the current authenticated user's ID.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (isDemoMode) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Helper: get the current session.
 */
export async function getSession() {
  if (isDemoMode) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
