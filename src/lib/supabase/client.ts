import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/env-validation';

export function createClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey);
}