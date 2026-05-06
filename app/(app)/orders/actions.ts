'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jobSchema, jobUpdateSchema } from '@/lib/validators';
import { sendEmail } from '@/lib/resend';
import { orderReadyEmail, orderDeliveredEmail, invoiceCreatedEmail } from '@/lib/email-templates';
import { calculatePrice } from '@/lib/pricing/calculate';
import { requireRole } from '@/lib/permissions';

async function priceGuard(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, job: {
  paper_stock_id?: string | null;
  paper_qty: number;
  quantity: number;
  unit_price: number;
  is_rush: boolean | undefined;
  specs: Record<string, unknown> | undefined;
  finishings: Array<{ finishing_option_id: string; qty: number }>;
}) {
  const specColor = ((job.specs as Record<string, unknown> | undefined)?.color as 'color' | 'bw' | undefined) ?? 'color';
  const specSides = ((job.specs as Record<string, unknown> | undefined)?.sides as 1 | 2 | undefined) === 2 ? 2 : 1;

  const [paperRes, foRes, settingsRes] = await Promise.all([
    job.paper_stock_id
      ? supabase.from('paper_stocks')
          .select('cost_per_sheet, ink_bw_1side, ink_bw_2side, ink_color_1side, ink_color_2side')
          .eq('id', job.paper_stock_id).single<{
            cost_per_sheet: number;
            ink_bw_1side: number; ink_bw_2side: number;
            ink_color_1side: number; ink_color_2side: number;
          }>()
      : Promise.resolve({ data: null, error: null }),
    job.finishings.length
      ? supabase.from('finishing_options').select('id, cost_per_unit').in('id', job.finishings.map((f) => f.finishing_option_id))
      : Promise.resolve({ data: [] as { id: string; cost_per_unit: number }[], error: null }),
    supabase.from('settings').select('rush_multiplier, tax_rate').eq('id', 1).single<{ rush_multiplier: number; tax_rate: number }>(),
  ]);

  const inkPerPiece = paperRes.data
    ? (specColor === 'color'
        ? (specSides === 2 ? paperRes.data.ink_color_2side : paperRes.data.ink_color_1side)
        : (specSides === 2 ? paperRes.data.ink_bw_2side    : paperRes.data.ink_bw_1side))
    : 0;
  const foMap = new Map((foRes.data ?? []).map((f) => [f.id, f.cost_per_unit]));
  const breakdown = calculatePrice({
    paperCostPerSheet: paperRes.data?.cost_per_sheet ?? 0,
    paperQty: job.paper_qty ?? 0,
    inkCost: inkPerPiece * (job.quantity || 0),
    finishings: job.finishings.map((f) => ({ cost_per_unit: foMap.get(f.finishing_option_id) ?? 0, qty: f.qty })),
    unitPrice: job.unit_price,
    quantity: job.quantity,
    isRush: job.is_rush ?? false,
    rushMultiplier: Number(settingsRes.data?.rush_multiplier ?? 0.25),
    taxRate: Number(settingsRes.data?.tax_rate ?? 0),
  });
  if (breakdown.totalCost > 0 && breakdown.revenue < breakdown.totalCost) {
    return { ok: false as const, error: `Price is below cost (loss of $${(breakdown.totalCost - breakdown.revenue).toFixed(2)}). Raise the unit price.` };
  }
  return { ok: true as const };
}

export async function createJobAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requireRole('staff');
  const supabase = await createSupabaseServerClient();

  const raw = JSON.parse(String(formData.get('payload')));
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { finishings, ...job } = parsed.data;
  const guard = await priceGuard(supabase, { ...job, finishings });
  if (!guard.ok) return guard;

  const { data: created, error } = await supabase
    .from('jobs')
    .insert({ ...job, created_by: user.id })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  if (finishings.length) {
    const rows = finishings.map((f) => ({ job_id: created!.id, ...f }));
    const { error: fErr } = await supabase.from('job_finishings').insert(rows);
    if (fErr) return { ok: false, error: fErr.message };
  }

  revalidatePath('/orders');
  revalidatePath('/dashboard');
  redirect(`/orders/${created!.id}`);
}

/**
 * Edit an existing job. Locks customer + product (different order = different
 * job). Re-runs price guard, replaces finishings array.
 */
export async function updateJobAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'Missing id' };

  const raw = JSON.parse(String(formData.get('payload')));
  const parsed = jobUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { finishings, ...job } = parsed.data as typeof parsed.data & { finishings: Array<{ finishing_option_id: string; qty: number }> };
  const finishingsArr = finishings ?? [];

  const guard = await priceGuard(supabase, {
    paper_stock_id: job.paper_stock_id ?? null,
    paper_qty: job.paper_qty ?? 0,
    quantity: job.quantity ?? 1,
    unit_price: job.unit_price ?? 0,
    is_rush: job.is_rush,
    specs: job.specs,
    finishings: finishingsArr,
  });
  if (!guard.ok) return guard;

  const { error } = await supabase.from('jobs').update(job).eq('id', id);
  if (error) return { ok: false, error: error.message };

  // Replace finishings
  await supabase.from('job_finishings').delete().eq('job_id', id);
  if (finishingsArr.length) {
    const rows = finishingsArr.map((f) => ({ job_id: id, ...f }));
    const { error: fErr } = await supabase.from('job_finishings').insert(rows);
    if (fErr) return { ok: false, error: fErr.message };
  }

  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  redirect(`/orders/${id}`);
}

/** Duplicate a job as a new draft (parent_job_id set for traceability). */
export async function duplicateJobAction(formData: FormData) {
  const { user } = await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };

  const { data: src, error } = await supabase.from('jobs').select('*').eq('id', id).single<{
    customer_id: string; product_id: string; quantity: number; unit_price: number;
    paper_stock_id: string | null; paper_qty: number; is_rush: boolean; priority: string;
    specs: Record<string, unknown>; notes: string | null; internal_notes: string | null;
    template_name: string | null;
  }>();
  if (error || !src) return { ok: false as const, error: error?.message ?? 'Not found' };

  const { data: created, error: e2 } = await supabase.from('jobs').insert({
    customer_id: src.customer_id,
    product_id: src.product_id,
    quantity: src.quantity,
    unit_price: src.unit_price,
    paper_stock_id: src.paper_stock_id,
    paper_qty: src.paper_qty,
    is_rush: false,
    priority: 'normal',
    specs: src.specs,
    notes: src.notes,
    internal_notes: src.internal_notes,
    parent_job_id: id,
    status: 'estimate',
    created_by: user.id,
  }).select('id').single();
  if (e2) return { ok: false as const, error: e2.message };

  // Copy finishings
  const { data: srcFins } = await supabase.from('job_finishings').select('finishing_option_id, qty').eq('job_id', id);
  if (srcFins?.length) {
    await supabase.from('job_finishings').insert(srcFins.map((f) => ({ ...f, job_id: created!.id })));
  }

  revalidatePath('/orders');
  redirect(`/orders/${created!.id}`);
}

export async function cancelJobAction(formData: FormData) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? '') || null;
  if (!id) return { ok: false as const, error: 'Missing id' };

  const { error } = await supabase
    .from('jobs')
    .update({ status: 'cancelled', cancel_reason: reason })
    .eq('id', id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  revalidatePath('/production');
  return { ok: true as const };
}

export async function updateJobStatusAction(jobId: string, status: string) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'completed') patch.printed_at = new Date().toISOString();

  const { data: job, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', jobId)
    .select('id, job_number, status, customer_id, quantity, unit_price, due_date, notes, customers(name, email), products(name)')
    .single<{
      id: string; job_number: string; status: string; customer_id: string;
      quantity: number; unit_price: number; due_date: string | null; notes: string | null;
      customers: { name: string; email: string | null } | null;
      products: { name: string } | null;
    }>();
  if (error) return { ok: false, error: error.message };

  const { data: settings } = await supabase
    .from('settings')
    .select('company_email, tax_rate')
    .eq('id', 1)
    .single<{ company_email: string | null; tax_rate: number }>();
  const replyTo = settings?.company_email ?? undefined;

  // On completion: auto-create a draft invoice if none exists for this job.
  if (status === 'completed' && job) {
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('job_id', job.id)
      .maybeSingle();
    if (!existing) {
      const subtotal = (job.quantity || 0) * (job.unit_price || 0);
      const taxRate = Number(settings?.tax_rate ?? 0);
      const tax = +(subtotal * taxRate).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);
      const due = new Date();
      due.setDate(due.getDate() + 30);
      const { data: inv } = await supabase
        .from('invoices')
        .insert({
          customer_id: job.customer_id,
          job_id: job.id,
          subtotal, tax, total,
          due_date: due.toISOString().slice(0, 10),
          status: 'draft',
        })
        .select('id, invoice_number, total, due_date')
        .single<{ id: string; invoice_number: string; total: number; due_date: string | null }>();
      if (inv && job.customers?.email) {
        const tpl = invoiceCreatedEmail({
          invoice_number: inv.invoice_number,
          customer_name: job.customers.name,
          total: Number(inv.total),
          due_date: inv.due_date,
          job_number: job.job_number,
        });
        const r = await sendEmail({ to: job.customers.email, reply_to: replyTo, ...tpl });
        if (r && 'error' in r && r.error) console.error('[orders.status] invoice email failed:', r.error);
      }
      revalidatePath('/invoices');
    }
  }

  if ((status === 'completed' || status === 'delivered') && job?.customers?.email) {
    const tpl = (status === 'completed' ? orderReadyEmail : orderDeliveredEmail)({
      job_number: job.job_number,
      product_name: job.products?.name ?? null,
      customer_name: job.customers.name ?? null,
      quantity: job.quantity,
      unit_price: job.unit_price,
      due_date: job.due_date,
      notes: job.notes,
    });
    const r = await sendEmail({ to: job.customers.email, reply_to: replyTo, ...tpl });
    if (r && 'error' in r && r.error) console.error('[orders.status] customer email failed:', r.error);
  }

  revalidatePath('/production');
  revalidatePath('/orders');
  revalidatePath(`/orders/${jobId}`);
  return { ok: true };
}

/** Bulk-advance N jobs to a target status. */
export async function bulkUpdateJobStatusAction(jobIds: string[], status: string) {
  await requireRole('staff');
  const results = await Promise.all(jobIds.map((id) => updateJobStatusAction(id, status)));
  const failed = results.filter((r) => !r.ok);
  return failed.length === 0
    ? { ok: true as const, count: results.length }
    : { ok: false as const, error: `${failed.length}/${results.length} failed` };
}

export async function assignPrinterAction(jobId: string, printer: string | null) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('jobs')
    .update({ printer: printer || null })
    .eq('id', jobId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/production');
  revalidatePath(`/orders/${jobId}`);
  return { ok: true as const };
}

/** Bulk-assign a printer. */
export async function bulkAssignPrinterAction(jobIds: string[], printer: string | null) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('jobs')
    .update({ printer: printer || null })
    .in('id', jobIds);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/production');
  return { ok: true as const, count: jobIds.length };
}

/**
 * Register a file uploaded to the `job-files` storage bucket
 * by inserting the public.files row that points at it.
 */
export async function registerJobFileAction(formData: FormData) {
  const { user } = await requireRole('staff');
  const supabase = await createSupabaseServerClient();

  const job_id = String(formData.get('job_id') ?? '');
  const storage_path = String(formData.get('storage_path') ?? '');
  const name = String(formData.get('name') ?? '');
  const size = Number(formData.get('size') ?? 0) || null;
  const mime = (formData.get('mime') as string) || null;
  if (!job_id || !storage_path || !name) return { ok: false as const, error: 'Missing fields' };

  const { data, error } = await supabase.from('files').insert({
    owner_type: 'job',
    owner_id: job_id,
    storage_path,
    bucket: 'job-files',
    name, size, mime,
    uploaded_by: user.id,
  }).select('id, name, size, mime, storage_path, created_at').single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/orders/${job_id}`);
  return { ok: true as const, file: data! };
}

export async function deleteJobFileAction(formData: FormData) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const file_id = String(formData.get('file_id') ?? '');
  const storage_path = String(formData.get('storage_path') ?? '');
  if (!file_id || !storage_path) return { ok: false as const, error: 'Missing fields' };

  await supabase.storage.from('job-files').remove([storage_path]);
  const { error } = await supabase.from('files').delete().eq('id', file_id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
