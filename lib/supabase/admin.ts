import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Use ONLY in trusted server-side contexts
 * (API routes, server actions, webhooks). Bypasses RLS — never import this
 * file from client code.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
