import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/stripe/checkout
 * Body: { invoiceId: string }
 * Creates a Stripe Checkout session for the invoice's outstanding balance.
 */
export async function POST(req: Request) {
  const { invoiceId } = await req.json();
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, customer_id, customers(name, email)')
    .eq('id', invoiceId)
    .single();
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const outstanding = Number(invoice.total) - Number(invoice.amount_paid);
  if (outstanding <= 0) return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });

  if (!stripe) return NextResponse.json({ error: 'Stripe not configured (set STRIPE_SECRET_KEY)' }, { status: 503 });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `Invoice ${invoice.invoice_number}` },
        unit_amount: Math.round(outstanding * 100),
      },
      quantity: 1,
    }],
    customer_email: (invoice as any).customers?.email ?? undefined,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}?paid=1`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoice.id}`,
    metadata: { invoice_id: invoice.id, invoice_number: invoice.invoice_number },
  });

  return NextResponse.json({ url: session.url });
}
