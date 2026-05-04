import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';
import type { Profile, UserRole } from '@/types/database';

const ROLE_RANK: Record<UserRole, number> = {
  customer: 0, staff: 1, manager: 2, admin: 3,
};

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();
  return profile ? { user, profile } : null;
}

export async function requireUser() {
  const result = await getCurrentUser();
  if (!result) redirect('/login');
  return result;
}

export async function requireRole(min: UserRole) {
  const result = await requireUser();
  if (ROLE_RANK[result.profile.role] < ROLE_RANK[min]) {
    redirect('/dashboard');
  }
  return result;
}

export function can(role: UserRole, action: 'manage' | 'edit' | 'view'): boolean {
  if (action === 'manage') return role === 'admin';
  if (action === 'edit')   return ROLE_RANK[role] >= ROLE_RANK.staff;
  return true;
}
