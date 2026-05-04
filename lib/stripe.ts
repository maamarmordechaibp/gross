import 'server-only';
import Stripe from 'stripe';

/**
 * Lazy / nullable Stripe client.
 * Returns null if STRIPE_SECRET_KEY isn't configured so the rest of the app
 * keeps working in local dev without Stripe.
 */
export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion,
      typescript: true,
    })
  : null;
