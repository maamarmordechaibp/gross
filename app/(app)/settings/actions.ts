'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function updateSettingsAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const taxPct    = Number(formData.get('tax_rate_pct') ?? 0);
  const rushPct   = Number(formData.get('rush_multiplier_pct') ?? 0);
  const marginPct = Number(formData.get('default_margin_pct') ?? 0);

  const { error } = await supabase
    .from('settings')
    .update({
      tax_rate: taxPct / 100,
      rush_multiplier: rushPct / 100,
      default_margin_pct: marginPct / 100,
    })
    .eq('id', 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  return { ok: true };
}
