'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { finishingSchema } from '@/lib/validators';
import { requireRole } from '@/lib/permissions';

function parseFinishing(formData: FormData) {
  return finishingSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    cost_per_unit: formData.get('cost_per_unit') || 0,
    machine: formData.get('machine') || null,
  });
}

export async function createFinishingAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();

  const parsed = parseFinishing(formData);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { error } = await supabase.from('finishing_options').insert(parsed.data);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/finishings');
  redirect('/finishings');
}

export async function updateFinishingAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };

  const parsed = parseFinishing(formData);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const active = formData.get('active') === 'on';
  const { error } = await supabase
    .from('finishing_options')
    .update({ ...parsed.data, active })
    .eq('id', id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/finishings');
  redirect('/finishings');
}

export async function archiveFinishingAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };
  const { error } = await supabase
    .from('finishing_options')
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq('id', id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/finishings');
  return { ok: true as const };
}
