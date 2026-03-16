import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24-preview' as any,
});

export const CREDIT_PRICE_ID = process.env.STRIPE_CREDIT_PRICE_ID || '';
