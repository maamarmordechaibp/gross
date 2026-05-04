import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId && session.amount_total) {
        await supabase.from('payments').insert({
          invoice_id: invoiceId,
          amount: session.amount_total / 100,
          method: 'stripe',
          stripe_charge_id: session.payment_intent as string,
        });
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      // Optionally mark invoice as failed / notify
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
