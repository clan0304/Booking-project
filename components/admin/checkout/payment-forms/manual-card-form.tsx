// components/admin/checkout/payment-forms/manual-card-form.tsx
'use client';

import { useState } from 'react';
import { ChevronLeft, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { createPaymentIntent } from '@/app/actions/stripe/payment-intents';
import type { ManualCardFormProps, PaymentEntry } from '../checkout-types';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
  hidePostalCode: true,
};

function ManualCardFormInner({
  clientId,
  bookingGroupId,
  amount,
  onPaymentComplete,
  onCancel,
  disabled = false,
}: ManualCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: piError } = await createPaymentIntent(
        bookingGroupId,
        amount,
        clientId,
        'Service payment'
      );

      if (piError || !data) {
        throw new Error(piError || 'Failed to create payment');
      }

      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: {
            card: cardElement,
          },
        });

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment failed');
      }

      if (paymentIntent?.status === 'succeeded') {
        const paymentEntry: PaymentEntry = {
          id: `payment_${Date.now()}`,
          method: 'card_online',
          amount,
          label: 'Card',
          status: 'succeeded',
          paymentIntentId: paymentIntent.id,
        };

        onPaymentComplete(paymentEntry);
      } else {
        throw new Error('Payment was not completed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          disabled={isProcessing}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="font-medium">Card Details</h3>
      </div>

      {/* Card Element */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Card information
        </label>
        <div className="p-3 border border-input rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-ring transition-all">
          <CardElement
            options={cardElementOptions}
            onChange={(e) => {
              setCardComplete(e.complete);
              if (e.error) {
                setError(e.error.message);
              } else {
                setError(null);
              }
            }}
          />
        </div>
      </div>

      {/* Security Note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>Secured by Stripe. We never store your card details.</span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Amount & Pay Button */}
      <div className="pt-4 border-t border-border">
        <div className="flex justify-between items-center mb-4">
          <span className="text-muted-foreground">Amount</span>
          <span className="text-xl font-semibold">A${amount.toFixed(2)}</span>
        </div>
        <Button
          type="submit"
          disabled={!stripe || !cardComplete || isProcessing || disabled}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            `Pay A$${amount.toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  );
}

export function ManualCardForm(props: ManualCardFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <ManualCardFormInner {...props} />
    </Elements>
  );
}
