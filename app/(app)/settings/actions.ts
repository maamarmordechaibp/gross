'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { marginTierSchema } from '@/lib/validators';
import { z } from 'zod';

export async function updateSettingsAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const taxPct  = Number(formData.get('tax_rate_pct') ?? 0);
  const rushPct = Number(formData.get('rush_multiplier_pct') ?? 0);

  let tiers: Array<{ min_qty: number; margin_pct: number }> = [];
  try {
    const raw = String(formData.get('margin_tiers') ?? '[]');
    tiers = z.array(marginTierSchema).parse(JSON.parse(raw))
      .sort((a, b) => a.min_qty - b.min_qty);
  } catch {
    return { ok: false, error: 'Invalid margin tiers' };
  }
  if (tiers.length === 0) tiers = [{ min_qty: 0, margin_pct: 1.0 }];
  if (tiers[0].min_qty > 0) tiers.unshift({ min_qty: 0, margin_pct: tiers[0].margin_pct });

  const { error } = await supabase
    .from('settings')
    .update({
      tax_rate: taxPct / 100,
      rush_multiplier: rushPct / 100,
      margin_tiers: tiers,
    })
    .eq('id', 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  return { ok: true };
}
