import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from '@/lib/env-validation';

export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey);
}