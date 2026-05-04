'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function approveQuoteAction(formData: FormData) {
  const token = String(formData.get('token'));
  const supabase = createSupabaseAdminClient();
  await supabase.from('quotes').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('approval_token', token);
  revalidatePath(`/quote/approve/${token}`);
}

export async function rejectQuoteAction(formData: FormData) {
  const token = String(formData.get('token'));
  const supabase = createSupabaseAdminClient();
  await supabase.from('quotes').update({ status: 'rejected' }).eq('approval_token', token);
  revalidatePath(`/quote/approve/${token}`);
}
