'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { jobSchema } from '@/lib/validators';

export async function approveQuoteAction(formData: FormData) {
  const token = String(formData.get('token'));
  const supabase = createSupabaseAdminClient();

  const { data: q, error } = await supabase
    .from('quotes')
    .select('id, status, customer_id, spec, job_id')
    .eq('approval_token', token)
    .single<{ id: string; status: string; customer_id: string; spec: unknown; job_id: string | null }>();
  if (error || !q) return;

  // Idempotent: if already approved with a job, do nothing.
  if (q.status === 'approved' && q.job_id) {
    revalidatePath(`/quote/approve/${token}`);
    return;
  }

  let jobId: string | null = q.job_id;

  if (!jobId && q.spec) {
    const parsed = jobSchema.safeParse(q.spec);
    if (parsed.success) {
      const { finishings, ...job } = parsed.data;
      const { data: created } = await supabase
        .from('jobs')
        .insert({ ...job, customer_id: q.customer_id })
        .select('id')
        .single<{ id: string }>();
      if (created) {
        jobId = created.id;
        if (finishings.length) {
          await supabase
            .from('job_finishings')
            .insert(finishings.map((f) => ({ job_id: created.id, ...f })));
        }
      }
    }
  }

  await supabase
    .from('quotes')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      job_id: jobId,
    })
    .eq('id', q.id);

  revalidatePath(`/quote/approve/${token}`);
  revalidatePath('/orders');
  revalidatePath('/quotes');
}

export async function rejectQuoteAction(formData: FormData) {
  const token = String(formData.get('token'));
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('quotes')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('approval_token', token);
  revalidatePath(`/quote/approve/${token}`);
}
