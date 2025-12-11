// components/public/bookings/payment-details.tsx
'use client';

import { useState } from 'react';
import { CreditCard, Shield, Clock, AlertCircle, Check } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { createPublicSetupIntent } from '@/app/actions/stripe';

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

interface CancellationPolicy {
  id: string;
  notice_hours: number;
  fee_percentage: number;
  fee_fixed_amount: number | null;
}

interface PaymentDetailsProps {
  clientId: string;
  venueId: string;
  totalPrice: number;
  onPaymentMethodSaved: (paymentMethodId: string) => void;
  onBack: () => void;
  existingCard: SavedCard | null;
  cancellationPolicy: CancellationPolicy | null;
}

export function PaymentDetails({
  clientId,
  venueId,
  totalPrice,
  onPaymentMethodSaved,
  onBack,
  existingCard,
  cancellationPolicy,
}: PaymentDetailsProps) {
  // If user has existing card, show confirmation screen
  if (existingCard) {
    return (
      <ExistingCardConfirmation
        card={existingCard}
        cancellationPolicy={cancellationPolicy}
        totalPrice={totalPrice}
        onConfirm={() => onPaymentMethodSaved(existingCard.id)}
        onBack={onBack}
      />
    );
  }

  // Otherwise show card entry form
  return (
    <Elements stripe={stripePromise}>
      <CardEntryForm
        clientId={clientId}
        venueId={venueId}
        totalPrice={totalPrice}
        cancellationPolicy={cancellationPolicy}
        onPaymentMethodSaved={onPaymentMethodSaved}
        onBack={onBack}
      />
    </Elements>
  );
}

// Component for when user already has a card
function ExistingCardConfirmation({
  card,
  cancellationPolicy,
  totalPrice,
  onConfirm,
  onBack,
}: {
  card: SavedCard;
  cancellationPolicy: CancellationPolicy | null;
  totalPrice: number;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const getBrandIcon = () => {
    return <CreditCard className="h-6 w-6" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Method
        </h2>
        <p className="text-gray-600">
          Your card will be used for cancellation fees if applicable
        </p>
      </div>

      {/* Existing Card Display */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-8">
          {getBrandIcon()}
          <span className="text-sm font-medium uppercase">{card.brand}</span>
        </div>
        <div className="space-y-4">
          <div className="font-mono text-xl tracking-wider">
            •••• •••• •••• {card.last4}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Expires</span>
            <span>
              {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-green-400 text-sm">
          <Check className="h-4 w-4" />
          <span>Card on file</span>
        </div>
      </div>

      {/* Cancellation Policy Notice */}
      {cancellationPolicy && (
        <CancellationPolicyNotice
          policy={cancellationPolicy}
          totalPrice={totalPrice}
        />
      )}

      {/* Security Notice */}
      <SecurityNotice />

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors"
        >
          Continue with this card
        </button>
      </div>
    </div>
  );
}

// Component for entering new card
function CardEntryForm({
  venueId,
  totalPrice,
  cancellationPolicy,
  onPaymentMethodSaved,
  onBack,
}: {
  clientId: string;
  venueId: string;
  totalPrice: number;
  cancellationPolicy: CancellationPolicy | null;
  onPaymentMethodSaved: (paymentMethodId: string) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create SetupIntent via Server Action
      const { data: setupData, error: setupError } =
        await createPublicSetupIntent(venueId);

      if (setupError || !setupData) {
        throw new Error(setupError || 'Failed to initialize payment');
      }

      // 2. Confirm SetupIntent with card details
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        setupData.clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message || 'Card verification failed');
      }

      if (!setupIntent || setupIntent.status !== 'succeeded') {
        throw new Error('Card setup failed');
      }

      // 3. Get the payment method ID
      const paymentMethodId =
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id;

      if (!paymentMethodId) {
        throw new Error('Failed to save card');
      }

      // 4. Notify parent (webhook will save to database)
      onPaymentMethodSaved(paymentMethodId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        '::placeholder': {
          color: '#9ca3af',
        },
        iconColor: '#6C5CE7',
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
    },
    hidePostalCode: true,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Details
        </h2>
        <p className="text-gray-600">
          Add a card to complete your booking. You won&apos;t be charged now.
        </p>
      </div>

      {/* Important Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              Your card won&apos;t be charged today
            </p>
            <p className="text-sm text-blue-700 mt-1">
              We only save your card details for cancellation protection and
              faster checkout when you visit.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Details <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <CreditCard className="h-5 w-5 text-gray-400" />
            </div>
            <div className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#6C5CE7] focus-within:border-transparent">
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
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {/* Cancellation Policy Notice */}
        {cancellationPolicy && (
          <CancellationPolicyNotice
            policy={cancellationPolicy}
            totalPrice={totalPrice}
          />
        )}

        {/* Security Notice */}
        <SecurityNotice />

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!stripe || loading || !cardComplete}
            className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving card...
              </>
            ) : (
              'Save & Continue'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// Cancellation Policy Notice Component
function CancellationPolicyNotice({
  policy,
  totalPrice,
}: {
  policy: CancellationPolicy;
  totalPrice: number;
}) {
  const feeAmount = policy.fee_fixed_amount
    ? policy.fee_fixed_amount
    : (totalPrice * policy.fee_percentage) / 100;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex gap-3">
        <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">
            Cancellation Policy
          </p>
          <p className="text-sm text-amber-700 mt-1">
            Please cancel at least <strong>{policy.notice_hours} hours</strong>{' '}
            before your appointment to avoid a cancellation fee of{' '}
            <strong>
              {policy.fee_fixed_amount
                ? `A$${policy.fee_fixed_amount.toFixed(2)}`
                : `${policy.fee_percentage}% (A$${feeAmount.toFixed(2)})`}
            </strong>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

// Security Notice Component
function SecurityNotice() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <Shield className="h-4 w-4" />
      <span>Your payment info is encrypted and secure</span>
    </div>
  );
}

export default PaymentDetails;
