// components/admin/checkout/payment-forms/cash-form.tsx
'use client';

import { useState } from 'react';
import { ChevronLeft, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CashFormProps, PaymentEntry } from '../checkout-types';

export function CashForm({
  remaining,
  onPaymentComplete,
  onCancel,
  disabled = false,
}: CashFormProps) {
  const [cashReceived, setCashReceived] = useState<string>(
    remaining.toFixed(2)
  );
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseFloat(cashReceived) || 0;
  const change = parsedAmount - remaining;
  const isValidAmount = parsedAmount > 0 && parsedAmount <= remaining * 2;

  const quickAmounts = [
    remaining,
    Math.ceil(remaining / 10) * 10,
    Math.ceil(remaining / 20) * 20,
    Math.ceil(remaining / 50) * 50,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= remaining);

  const handleAddPayment = () => {
    if (!isValidAmount) {
      setError('Please enter a valid amount');
      return;
    }

    const actualPayment = Math.min(parsedAmount, remaining);

    const paymentEntry: PaymentEntry = {
      id: `payment_${Date.now()}`,
      method: 'cash',
      amount: actualPayment,
      label: 'Cash',
      status: 'pending',
    };

    onPaymentComplete(paymentEntry);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          disabled={disabled}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="font-medium">Cash Payment</h3>
      </div>

      {/* Amount Due */}
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Amount due</span>
          <span className="text-2xl font-bold">A${remaining.toFixed(2)}</span>
        </div>
      </div>

      {/* Cash Received Input */}
      <div className="space-y-2">
        <Label htmlFor="cash-received">Cash received</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            A$
          </span>
          <Input
            id="cash-received"
            type="number"
            step="0.01"
            min="0"
            value={cashReceived}
            onChange={(e) => {
              setCashReceived(e.target.value);
              setError(null);
            }}
            disabled={disabled}
            className="pl-10 text-lg font-medium"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="flex flex-wrap gap-2">
        {quickAmounts.map((quickAmount) => (
          <Button
            key={quickAmount}
            type="button"
            variant={
              parseFloat(cashReceived) === quickAmount ? 'default' : 'outline'
            }
            size="sm"
            onClick={() => setCashReceived(quickAmount.toFixed(2))}
            disabled={disabled}
          >
            A${quickAmount.toFixed(2)}
          </Button>
        ))}
      </div>

      {/* Change Calculation */}
      {parsedAmount > remaining && (
        <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex justify-between items-center">
            <span className="text-green-700 dark:text-green-300 font-medium">
              Change to give
            </span>
            <span className="text-xl font-bold text-green-700 dark:text-green-300">
              A${change.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Add Payment Button */}
      <div className="pt-4 border-t border-border">
        <Button
          onClick={handleAddPayment}
          disabled={!isValidAmount || disabled}
          className="w-full gap-2"
        >
          <Banknote className="h-5 w-5" />
          {parsedAmount >= remaining
            ? 'Add full payment'
            : `Add A$${Math.min(parsedAmount, remaining).toFixed(2)} payment`}
        </Button>
      </div>
    </div>
  );
}
