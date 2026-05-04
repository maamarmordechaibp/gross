'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { customerSchema } from '@/lib/validators';

export async function createCustomerAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    company: formData.get('company') || null,
    email: formData.get('email') || null,
    phone: formData.get('phone') || null,
    notes: formData.get('notes') || null,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from('customers')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id').single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/customers');
  redirect(`/customers/${data!.id}`);
}

/**
 * Inline create — used by the order form's "+ New customer" affordance.
 * Returns the new customer record instead of redirecting.
 */
export async function createCustomerInlineAction(input: {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<
  | { ok: true; customer: { id: string; name: string; company: string | null; email: string | null; phone: string | null } }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const parsed = customerSchema.safeParse({
    name: input.name,
    company: input.company || null,
    email: input.email || null,
    phone: input.phone || null,
    notes: null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from('customers')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id,name,company,email,phone')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath('/customers');
  return { ok: true, customer: data! };
}
