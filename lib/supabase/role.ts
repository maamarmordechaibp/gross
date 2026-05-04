import 'server-only';
import { createSupabaseServerClient } from './server';

export type Role = 'customer' | 'staff' | 'manager' | 'admin';

/**
 * Returns the current user's role, or `null` if not signed in.
 * Used to gate cost/profit/margin info from customers.
 */
export async function getCurrentRole(): Promise<Role | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: Role }>();
  return data?.role ?? null;
}

/** True when the user is staff/manager/admin (i.e. should see cost & profit). */
export async function isStaff(): Promise<boolean> {
  const r = await getCurrentRole();
  return r === 'staff' || r === 'manager' || r === 'admin';
}
