import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});

/**
 * Format amount for Stripe (converts dollars to cents)
 * Stripe expects amounts in the smallest currency unit
 *
 * @param amount - Amount in dollars (e.g., 10.50)
 * @returns Amount in cents (e.g., 1050)
 */
export function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Format amount from Stripe (converts cents to dollars)
 *
 * @param amount - Amount in cents (e.g., 1050)
 * @returns Amount in dollars (e.g., 10.50)
 */
export function formatAmountFromStripe(amount: number): number {
  return amount / 100;
}

/**
 * Format currency for display
 *
 * @param amount - Amount in dollars
 * @param currency - Currency code (default: 'AUD')
 * @returns Formatted currency string (e.g., '$10.50')
 */
export function formatCurrency(
  amount: number,
  currency: string = 'AUD'
): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(amount);
}
