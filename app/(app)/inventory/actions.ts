'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { paperStockSchema } from '@/lib/validators';
import { z } from 'zod';

const receiveSchema = paperStockSchema.extend({
  // For receive flow, qty_on_hand is the initial quantity received
  unit_cost: z.coerce.number().nonnegative().optional(),
  supplier: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

/** Create a brand-new paper stock and (optionally) record an initial receipt. */
export async function createPaperStockAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const parsed = receiveSchema.safeParse({
    name: formData.get('name'),
    size: formData.get('size'),
    weight_gsm: formData.get('weight_gsm') || null,
    color: formData.get('color') || null,
    finish: formData.get('finish') || null,
    qty_on_hand: 0, // start at zero, receipt adds to it via trigger
    reorder_threshold: formData.get('reorder_threshold') || 0,
    cost_per_sheet: 0,
    ink_bw_1side:    formData.get('ink_bw_1side')    || 0.015,
    ink_bw_2side:    formData.get('ink_bw_2side')    || 0.030,
    ink_color_1side: formData.get('ink_color_1side') || 0.080,
    ink_color_2side: formData.get('ink_color_2side') || 0.160,
    unit_cost: formData.get('unit_cost') || 0,
    supplier: formData.get('supplier') || null,
    reference: formData.get('reference') || null,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const initialQty = Math.max(0, Number(formData.get('qty_on_hand') ?? 0));

  const { unit_cost, supplier, reference, ...stock } = parsed.data;
  const { data, error } = await supabase.from('paper_stocks').insert(stock).select('id').single();
  if (error) return { ok: false as const, error: error.message };

  if (initialQty > 0) {
    await supabase.from('paper_receipts').insert({
      paper_stock_id: data!.id,
      qty: initialQty,
      unit_cost: unit_cost ?? 0,
      supplier: supplier ?? null,
      reference: reference ?? null,
      received_by: user.id,
    });
  }

  revalidatePath('/inventory');
  redirect('/inventory');
}

/** Record a receipt against an existing paper stock. */
export async function receivePaperStockAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const paperStockId = String(formData.get('paper_stock_id') ?? '');
  const qty = Number(formData.get('qty') ?? 0);
  const unitCost = Number(formData.get('unit_cost') ?? 0);
  if (!paperStockId || qty <= 0) return { ok: false as const, error: 'Pick a stock and enter a quantity > 0' };

  const { error } = await supabase.from('paper_receipts').insert({
    paper_stock_id: paperStockId,
    qty, unit_cost: unitCost,
    supplier: (formData.get('supplier') as string) || null,
    reference: (formData.get('reference') as string) || null,
    received_by: user.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/inventory');
  redirect('/inventory');
}
