// components/admin/checkout/payment-forms/terminal-form.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Smartphone,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  TerminalFormProps,
  PaymentEntry,
  TerminalInfo,
} from '../checkout-types';

type TerminalState =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'processing'
  | 'success'
  | 'failed';

export function TerminalForm({
  venueId,
  amount,
  onPaymentComplete,
  onCancel,
  disabled = false,
}: TerminalFormProps) {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(
    null
  );
  const [terminalState, setTerminalState] = useState<TerminalState>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTerminals = async () => {
      setIsLoading(true);
      try {
        // TODO: Implement getVenueTerminals action
        const mockTerminals: TerminalInfo[] = [
          {
            id: 'term_1',
            label: 'Front Desk Terminal',
            status: 'online',
            stripeTerminalId: 'tmr_xxx',
          },
        ];

        setTerminals(mockTerminals);
        const onlineTerminal = mockTerminals.find((t) => t.status === 'online');
        if (onlineTerminal) {
          setSelectedTerminalId(onlineTerminal.id);
        }
      } catch (err) {
        setError(`${err} Failed to load terminals`);
      } finally {
        setIsLoading(false);
      }
    };

    loadTerminals();
  }, [venueId]);

  const handleStartPayment = async () => {
    if (!selectedTerminalId) return;

    const selectedTerminal = terminals.find((t) => t.id === selectedTerminalId);
    if (!selectedTerminal) return;

    setError(null);
    setTerminalState('connecting');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setTerminalState('waiting');

      // TODO: Implement actual Stripe Terminal flow
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setTerminalState('processing');

      await new Promise((resolve) => setTimeout(resolve, 1500));
      setTerminalState('success');

      const paymentEntry: PaymentEntry = {
        id: `payment_${Date.now()}`,
        method: 'card_terminal',
        amount,
        label: 'Terminal',
        status: 'pending',
        terminalId: selectedTerminalId,
      };

      await new Promise((resolve) => setTimeout(resolve, 1000));
      onPaymentComplete(paymentEntry);
    } catch (err) {
      setTerminalState('failed');
      setError(`${err} Terminal payment failed. Please try again.`);
    }
  };

  const handleCancel = () => {
    if (terminalState === 'waiting' || terminalState === 'processing') {
      setTerminalState('idle');
    } else {
      onCancel();
    }
  };

  const renderTerminalState = () => {
    switch (terminalState) {
      case 'connecting':
        return (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="font-medium">Connecting to terminal...</p>
          </div>
        );

      case 'waiting':
        return (
          <div className="text-center py-8">
            <div className="h-16 w-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <p className="font-medium mb-2">Waiting for card...</p>
            <p className="text-sm text-muted-foreground">
              Tap, insert, or swipe card on the terminal
            </p>
            <p className="text-2xl font-bold mt-4">A${amount.toFixed(2)}</p>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <p className="font-medium">Processing payment...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="font-medium">Payment successful!</p>
          </div>
        );

      case 'failed':
        return (
          <div className="text-center py-8">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="font-medium">Payment failed</p>
            {error && <p className="text-destructive text-sm mt-2">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (terminals.length === 0 || !terminals.some((t) => t.status === 'online')) {
    return (
      <div className="text-center py-8">
        <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No terminals available</p>
        <p className="text-sm text-muted-foreground mt-1">
          Please check terminal connection
        </p>
        <Button variant="link" onClick={onCancel} className="mt-4">
          Choose another method
        </Button>
      </div>
    );
  }

  if (terminalState !== 'idle') {
    return (
      <div className="space-y-4">
        {renderTerminalState()}
        {(terminalState === 'waiting' || terminalState === 'failed') && (
          <Button variant="outline" onClick={handleCancel} className="w-full">
            Cancel
          </Button>
        )}
        {terminalState === 'failed' && (
          <Button onClick={handleStartPayment} className="w-full">
            Try again
          </Button>
        )}
      </div>
    );
  }

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
        <h3 className="font-medium">Card Terminal</h3>
      </div>

      {/* Terminal Selection */}
      {terminals.length > 1 ? (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Select terminal
          </label>
          {terminals.map((terminal) => (
            <button
              key={terminal.id}
              onClick={() => setSelectedTerminalId(terminal.id)}
              disabled={terminal.status !== 'online'}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
                selectedTerminalId === terminal.id
                  ? 'border-primary bg-accent'
                  : terminal.status === 'online'
                  ? 'border-border hover:border-primary/50'
                  : 'border-muted bg-muted/50 cursor-not-allowed opacity-50'
              )}
            >
              <Smartphone
                className={cn(
                  'h-5 w-5',
                  terminal.status === 'online'
                    ? 'text-green-600'
                    : 'text-muted-foreground'
                )}
              />
              <div className="flex-1 text-left">
                <p className="font-medium">{terminal.label}</p>
                <p
                  className={cn(
                    'text-xs',
                    terminal.status === 'online'
                      ? 'text-green-600'
                      : 'text-muted-foreground'
                  )}
                >
                  {terminal.status === 'online' ? 'Connected' : 'Offline'}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <Smartphone className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">
              {terminals[0].label}
            </p>
            <p className="text-xs text-green-600">Connected</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && terminalState === 'idle' && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Amount & Start Button */}
      <div className="pt-4 border-t border-border">
        <div className="flex justify-between items-center mb-4">
          <span className="text-muted-foreground">Amount</span>
          <span className="text-xl font-semibold">A${amount.toFixed(2)}</span>
        </div>
        <Button
          onClick={handleStartPayment}
          disabled={!selectedTerminalId || disabled}
          className="w-full"
        >
          Start payment on terminal
        </Button>
      </div>
    </div>
  );
}
