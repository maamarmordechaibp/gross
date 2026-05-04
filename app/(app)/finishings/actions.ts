'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { finishingSchema } from '@/lib/validators';

export async function createFinishingAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const parsed = finishingSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type'),
    cost_per_unit: formData.get('cost_per_unit') || 0,
    machine: formData.get('machine') || null,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { error } = await supabase.from('finishing_options').insert(parsed.data);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/finishings');
  redirect('/finishings');
}
