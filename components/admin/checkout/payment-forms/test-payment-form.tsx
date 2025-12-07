// components/admin/checkout/payment-forms/test-payment-form.tsx
'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  FlaskConical,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TestPaymentFormProps, PaymentEntry } from '../checkout-types';

type TestScenario = 'success' | 'decline' | '3ds' | 'error';

interface TestCard {
  id: TestScenario;
  label: string;
  description: string;
  cardNumber: string;
  icon: React.ReactNode;
}

const testCards: TestCard[] = [
  {
    id: 'success',
    label: 'Successful Payment',
    description: 'Card is approved instantly',
    cardNumber: '4242 4242 4242 4242',
    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
  },
  {
    id: 'decline',
    label: 'Declined Card',
    description: 'Insufficient funds error',
    cardNumber: '4000 0000 0000 9995',
    icon: <XCircle className="h-5 w-5 text-destructive" />,
  },
  {
    id: '3ds',
    label: '3D Secure Required',
    description: 'Triggers authentication flow',
    cardNumber: '4000 0000 0000 3220',
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  },
  {
    id: 'error',
    label: 'Processing Error',
    description: 'Simulates a gateway error',
    cardNumber: '4000 0000 0000 0119',
    icon: <XCircle className="h-5 w-5 text-destructive" />,
  },
];

export function TestPaymentForm({
  amount,
  onPaymentComplete,
  onCancel,
  disabled = false,
}: TestPaymentFormProps) {
  const [selectedScenario, setSelectedScenario] =
    useState<TestScenario>('success');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);

  const handleTestPayment = async () => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    switch (selectedScenario) {
      case 'success':
        setResult('success');
        await new Promise((resolve) => setTimeout(resolve, 500));

        const paymentEntry: PaymentEntry = {
          id: `payment_${Date.now()}`,
          method: 'other',
          amount,
          label: 'Test Payment',
          status: 'succeeded',
          paymentIntentId: `pi_test_${Date.now()}`,
        };

        onPaymentComplete(paymentEntry);
        break;

      case 'decline':
        setResult('failed');
        setError('Your card was declined. (Test: Insufficient funds)');
        setIsProcessing(false);
        break;

      case '3ds':
        setResult('success');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const paymentEntry3ds: PaymentEntry = {
          id: `payment_${Date.now()}`,
          method: 'other',
          amount,
          label: 'Test Payment (3DS)',
          status: 'succeeded',
          paymentIntentId: `pi_test_3ds_${Date.now()}`,
        };

        onPaymentComplete(paymentEntry3ds);
        break;

      case 'error':
        setResult('failed');
        setError(
          'An error occurred while processing your card. Please try again.'
        );
        setIsProcessing(false);
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          disabled={isProcessing}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-amber-500" />
          <h3 className="font-medium">Test Payment</h3>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
        <strong>Development Only:</strong> This simulates Stripe test payments
        without making real API calls.
      </div>

      {/* Test Scenario Selection */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Select test scenario
        </label>
        <div className="space-y-2">
          {testCards.map((card) => (
            <button
              key={card.id}
              onClick={() => setSelectedScenario(card.id)}
              disabled={isProcessing}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                selectedScenario === card.id
                  ? 'border-primary bg-accent'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {card.icon}
              <div className="flex-1">
                <p className="font-medium">{card.label}</p>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {card.cardNumber}
              </code>
            </button>
          ))}
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div
          className={cn(
            'p-4 rounded-lg text-center',
            result === 'success'
              ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
              : 'bg-destructive/10 border border-destructive/20'
          )}
        >
          {result === 'success' ? (
            <>
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 dark:text-green-200 font-medium">
                Payment Successful!
              </p>
            </>
          ) : (
            <>
              <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive font-medium">Payment Failed</p>
            </>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Amount & Test Button */}
      <div className="pt-4 border-t border-border">
        <div className="flex justify-between items-center mb-4">
          <span className="text-muted-foreground">Test amount</span>
          <span className="text-xl font-semibold">A${amount.toFixed(2)}</span>
        </div>
        <Button
          onClick={handleTestPayment}
          disabled={isProcessing || disabled}
          variant="secondary"
          className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
        >
          {isProcessing ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Simulating payment...
            </>
          ) : (
            <>
              <FlaskConical className="h-5 w-5" />
              Run test payment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
