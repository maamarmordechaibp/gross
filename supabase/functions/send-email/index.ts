// =============================================================================
// send-email — Supabase Edge Function (Deno)
// -----------------------------------------------------------------------------
// Centralizes all transactional email through Resend so the API key lives only
// in Supabase secrets, never in the Next.js bundle or .env.local.
//
// Deploy:
//   supabase functions deploy send-email --no-verify-jwt=false
//
// Set secrets (one-time):
//   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="Gross Printing <orders@yourdomain.com>"
//
// Invoke from the app (server-side only) via supabase.functions.invoke.
// =============================================================================

// deno-lint-ignore-file no-explicit-any
// @ts-nocheck — this file runs in Deno on Supabase, not in the Next.js TS project.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Gross Printing <noreply@grossprinting.local>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Payload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  if (!RESEND_API_KEY) {
    return json({ skipped: true, reason: 'RESEND_API_KEY not configured' }, 200);
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  if (!body?.to || !body?.subject || !body?.html) {
    return json({ error: 'missing fields: to, subject, html' }, 400);
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      reply_to: body.reply_to,
      cc: body.cc,
      bcc: body.bcc,
    }),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    console.error('[send-email] resend error', resp.status, data);
    return json({ error: data?.message ?? 'resend failed', status: resp.status }, 502);
  }

  return json({ id: data?.id, sent: true }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
