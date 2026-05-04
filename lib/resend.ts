import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Send transactional email via the Supabase `send-email` Edge Function.
 *
 * The Resend API key lives ONLY in Supabase secrets — never in this app's
 * environment. Deploy the function with:
 *   supabase functions deploy send-email
 * and set its secrets with:
 *   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="..."
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
}) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: opts,
    });
    if (error) {
      console.error('[email] edge function error', error.message);
      return { skipped: true as const, error: error.message };
    }
    if (data && typeof data === 'object' && 'skipped' in data && data.skipped) {
      console.warn('[email] skipped –', (data as { reason?: string }).reason ?? 'no key configured');
    }
    return data as { id?: string; sent?: boolean; skipped?: boolean };
  } catch (err) {
    console.error('[email] unexpected error', err);
    return { skipped: true as const, error: String(err) };
  }
}
