'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { paperStockSchema } from '@/lib/validators';
import { requireRole } from '@/lib/permissions';
import { z } from 'zod';

const receiveSchema = paperStockSchema.extend({
  unit_cost: z.coerce.number().nonnegative().optional(),
  supplier: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export async function createPaperStockAction(formData: FormData) {
  const { user } = await requireRole('manager');
  const supabase = await createSupabaseServerClient();

  const parsed = receiveSchema.safeParse({
    name: formData.get('name'),
    size: formData.get('size'),
    weight_gsm: formData.get('weight_gsm') || null,
    color: formData.get('color') || null,
    finish: formData.get('finish') || null,
    qty_on_hand: 0,
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

export async function updatePaperStockAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };

  const parsed = paperStockSchema.partial().safeParse({
    name: formData.get('name') || undefined,
    size: formData.get('size') || undefined,
    weight_gsm: formData.get('weight_gsm') || null,
    color: formData.get('color') || null,
    finish: formData.get('finish') || null,
    reorder_threshold: formData.get('reorder_threshold') ?? undefined,
    ink_bw_1side: formData.get('ink_bw_1side') ?? undefined,
    ink_bw_2side: formData.get('ink_bw_2side') ?? undefined,
    ink_color_1side: formData.get('ink_color_1side') ?? undefined,
    ink_color_2side: formData.get('ink_color_2side') ?? undefined,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const active = formData.get('active') === 'on';
  const payload = { ...parsed.data, active };
  const { error } = await supabase.from('paper_stocks').update(payload).eq('id', id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/inventory');
  revalidatePath(`/inventory/${id}`);
  redirect(`/inventory/${id}`);
}

export async function archivePaperStockAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };
  const { error } = await supabase
    .from('paper_stocks')
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq('id', id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/inventory');
  return { ok: true as const };
}

/** Record a receipt against an existing paper stock. */
export async function receivePaperStockAction(formData: FormData) {
  const { user } = await requireRole('manager');
  const supabase = await createSupabaseServerClient();

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
  revalidatePath(`/inventory/${paperStockId}`);
  return { ok: true as const };
}
