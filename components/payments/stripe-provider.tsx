// components/payments/stripe-provider.tsx
'use client';

import { ReactNode } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe outside of component to avoid recreating on each render
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface StripeProviderProps {
  children: ReactNode;
  clientSecret?: string;
  options?: {
    appearance?: {
      theme?: 'stripe' | 'night' | 'flat';
      variables?: {
        colorPrimary?: string;
        colorBackground?: string;
        colorText?: string;
        colorDanger?: string;
        fontFamily?: string;
        borderRadius?: string;
      };
    };
  };
}

export function StripeProvider({
  children,
  clientSecret,
  options = {},
}: StripeProviderProps) {
  const defaultAppearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0f172a',
      colorBackground: '#ffffff',
      colorText: '#1e293b',
      colorDanger: '#ef4444',
      fontFamily: 'Inter, system-ui, sans-serif',
      borderRadius: '8px',
    },
  };

  const elementsOptions = {
    clientSecret,
    appearance: options.appearance || defaultAppearance,
  };

  // If no clientSecret, just provide stripe instance
  if (!clientSecret) {
    return <Elements stripe={stripePromise}>{children}</Elements>;
  }

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      {children}
    </Elements>
  );
}
