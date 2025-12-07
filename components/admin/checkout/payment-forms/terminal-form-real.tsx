// components/admin/checkout/payment-forms/terminal-form-real.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Smartphone,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getVenueTerminals,
  createTerminalPaymentIntent,
  processTerminalPayment,
  cancelReaderAction,
  cancelPaymentIntent,
  getReaderAction,
  getReaderStatus,
} from '@/app/actions/stripe/terminal';
import type { PaymentEntry } from '../checkout-types';

interface TerminalFormProps {
  amount: number;
  venueId: string;
  bookingGroupId: string;
  onPaymentComplete: (payment: PaymentEntry) => void;
  onCancel: () => void;
  disabled?: boolean;
}

interface Terminal {
  id: string;
  stripe_terminal_id: string;
  label: string;
  status: 'online' | 'offline';
  device_type: string | null;
}

type TerminalState =
  | 'idle'
  | 'loading'
  | 'selecting'
  | 'connecting'
  | 'waiting'
  | 'processing'
  | 'success'
  | 'failed';

export function TerminalFormReal({
  amount,
  venueId,
  bookingGroupId,
  onPaymentComplete,
  onCancel,
  disabled = false,
}: TerminalFormProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(
    null
  );
  const [terminalState, setTerminalState] = useState<TerminalState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoStartedRef = useRef(false);
  const selectedTerminalIdRef = useRef<string | null>(null);

  // Keep ref in sync with state for use in polling callback
  useEffect(() => {
    selectedTerminalIdRef.current = selectedTerminalId;
  }, [selectedTerminalId]);

  // Start polling for payment completion
  const startPolling = useCallback(
    (stripeTerminalId: string, piId: string) => {
      // Poll every 2 seconds to check payment status
      const interval = setInterval(async () => {
        const { status } = await getReaderAction(stripeTerminalId);

        if (status === 'succeeded') {
          clearInterval(interval);
          pollingIntervalRef.current = null;
          setTerminalState('success');

          // Wait a moment then complete
          setTimeout(() => {
            const paymentEntry: PaymentEntry = {
              id: `terminal_${Date.now()}`,
              method: 'card_terminal',
              amount,
              label: 'Terminal',
              status: 'succeeded',
              terminalId: selectedTerminalIdRef.current!,
              paymentIntentId: piId,
            };
            onPaymentComplete(paymentEntry);
          }, 1500);
        } else if (status === 'failed') {
          clearInterval(interval);
          pollingIntervalRef.current = null;
          setTerminalState('failed');
          setError('Payment was declined or failed');
        }
        // If still 'in_progress', continue polling
      }, 2000);

      pollingIntervalRef.current = interval;
    },
    [amount, onPaymentComplete]
  );

  // Start payment with a specific terminal
  const startPaymentWithTerminal = useCallback(
    async (terminal: Terminal) => {
      if (terminal.status === 'offline') {
        setError('Terminal is offline');
        setTerminalState('selecting');
        return;
      }

      setSelectedTerminalId(terminal.id);
      selectedTerminalIdRef.current = terminal.id;
      setError(null);
      setTerminalState('connecting');

      try {
        // 1. Create PaymentIntent for terminal
        const { paymentIntentId: piId, error: piError } =
          await createTerminalPaymentIntent(
            amount,
            bookingGroupId,
            venueId,
            'Service payment'
          );

        if (piError || !piId) {
          throw new Error(piError || 'Failed to create payment');
        }

        setPaymentIntentId(piId);
        setTerminalState('waiting');

        // 2. Send to terminal reader
        const { error: terminalError } = await processTerminalPayment(
          terminal.stripe_terminal_id,
          piId
        );

        if (terminalError) {
          throw new Error(terminalError);
        }

        // 3. Start polling for completion
        startPolling(terminal.stripe_terminal_id, piId);
      } catch (err) {
        setTerminalState('failed');
        setError(
          err instanceof Error ? err.message : 'Terminal payment failed'
        );
      }
    },
    [amount, bookingGroupId, venueId, startPolling]
  );

  const loadTerminals = useCallback(async () => {
    setTerminalState('loading');
    setError(null);

    const { terminals: fetchedTerminals, error } = await getVenueTerminals(
      venueId
    );

    if (error) {
      setError(error);
      setTerminalState('idle');
      return;
    }

    setTerminals(fetchedTerminals);

    if (fetchedTerminals.length === 0) {
      setError('No terminals configured for this venue');
      setTerminalState('idle');
    } else if (fetchedTerminals.length === 1) {
      const terminal = fetchedTerminals[0];
      if (terminal.status === 'online' && !autoStartedRef.current) {
        // Keep loading state - auto-start effect will handle it
        autoStartedRef.current = true;
        // Directly start payment without going to selecting state
        setSelectedTerminalId(terminal.id);
        selectedTerminalIdRef.current = terminal.id;
        setTerminalState('connecting');

        try {
          // 1. Create PaymentIntent for terminal
          const { paymentIntentId: piId, error: piError } =
            await createTerminalPaymentIntent(
              amount,
              bookingGroupId,
              venueId,
              'Service payment'
            );

          if (piError || !piId) {
            throw new Error(piError || 'Failed to create payment');
          }

          setPaymentIntentId(piId);
          setTerminalState('waiting');

          // 2. Send to terminal reader
          const { error: terminalError } = await processTerminalPayment(
            terminal.stripe_terminal_id,
            piId
          );

          if (terminalError) {
            throw new Error(terminalError);
          }

          // 3. Start polling for completion
          startPolling(terminal.stripe_terminal_id, piId);
        } catch (err) {
          setTerminalState('failed');
          setError(
            err instanceof Error ? err.message : 'Terminal payment failed'
          );
        }
      } else {
        // Terminal offline - show selection with error
        setSelectedTerminalId(terminal.id);
        setTerminalState('selecting');
        if (terminal.status === 'offline') {
          setError('Terminal is offline. Please check the device.');
        }
      }
    } else {
      // Multiple terminals - show selection
      setTerminalState('selecting');
    }
  }, [venueId, amount, bookingGroupId, startPolling]);

  // Load terminals on mount
  useEffect(() => {
    loadTerminals();
    return () => {
      // Cleanup polling on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [loadTerminals]);

  const refreshTerminalStatus = async (terminalId: string) => {
    const terminal = terminals.find((t) => t.id === terminalId);
    if (!terminal) return;

    const { status } = await getReaderStatus(terminal.stripe_terminal_id);

    setTerminals((prev) =>
      prev.map((t) =>
        t.id === terminalId
          ? { ...t, status: status === 'online' ? 'online' : 'offline' }
          : t
      )
    );
  };

  const handleStartPayment = async () => {
    if (!selectedTerminalId) return;

    const selectedTerminal = terminals.find((t) => t.id === selectedTerminalId);
    if (!selectedTerminal) return;

    startPaymentWithTerminal(selectedTerminal);
  };

  const handleCancel = async () => {
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Cancel reader action if in progress
    if (
      selectedTerminalId &&
      (terminalState === 'waiting' || terminalState === 'processing')
    ) {
      const terminal = terminals.find((t) => t.id === selectedTerminalId);
      if (terminal) {
        await cancelReaderAction(terminal.stripe_terminal_id);
      }
    }

    // Cancel the PaymentIntent in Stripe if one was created
    if (paymentIntentId) {
      await cancelPaymentIntent(paymentIntentId);
    }

    onCancel();
  };

  const handleTryAgain = () => {
    // Reset state to try again
    setError(null);
    setPaymentIntentId(null);

    // If there's only one terminal and it's online, auto-start again
    if (terminals.length === 1 && terminals[0].status === 'online') {
      startPaymentWithTerminal(terminals[0]);
    } else {
      setTerminalState('selecting');
    }
  };

  const selectedTerminal = terminals.find((t) => t.id === selectedTerminalId);

  return (
    <div className="space-y-4">
      {/* Loading / Connecting State - unified for smoother UX */}
      {(terminalState === 'loading' || terminalState === 'connecting') && (
        <div className="text-center py-8">
          <div className="relative mx-auto w-16 h-16">
            <Smartphone className="h-16 w-16 text-muted-foreground" />
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full animate-pulse" />
          </div>
          <p className="mt-4 text-lg font-medium">Connecting to terminal...</p>
          <p className="text-2xl font-bold mt-2">A${amount.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-2">Please wait</p>
          <Button variant="outline" onClick={onCancel} className="mt-6">
            Cancel
          </Button>
        </div>
      )}

      {/* Terminal Selection */}
      {terminalState === 'selecting' && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Terminal</label>
            {terminals.map((terminal) => (
              <div
                key={terminal.id}
                onClick={() => {
                  if (terminal.status !== 'offline') {
                    setSelectedTerminalId(terminal.id);
                  }
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  selectedTerminalId === terminal.id
                    ? 'border-primary bg-accent'
                    : terminal.status === 'offline'
                    ? 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                    : 'border-border hover:bg-accent/50 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">{terminal.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {terminal.device_type || 'Terminal'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      terminal.status === 'online'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {terminal.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshTerminalStatus(terminal.id);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Amount Display */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Amount to charge</p>
            <p className="text-2xl font-bold">A${amount.toFixed(2)}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleStartPayment}
              disabled={!selectedTerminalId || disabled}
              className="flex-1"
            >
              Start Payment
            </Button>
          </div>
        </>
      )}

      {/* Waiting for Card */}
      {terminalState === 'waiting' && (
        <div className="text-center py-8">
          <div className="relative mx-auto w-16 h-16">
            <Smartphone className="h-16 w-16 text-primary" />
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full animate-pulse" />
          </div>
          <p className="mt-4 text-lg font-medium">Waiting for card...</p>
          <p className="text-2xl font-bold mt-2">A${amount.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Present card on {selectedTerminal?.label}
          </p>
          <Button variant="outline" onClick={handleCancel} className="mt-6">
            Cancel Payment
          </Button>
        </div>
      )}

      {/* Processing */}
      {terminalState === 'processing' && (
        <div className="text-center py-8">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 font-medium">Processing payment...</p>
          <p className="text-sm text-muted-foreground">Please wait</p>
        </div>
      )}

      {/* Success */}
      {terminalState === 'success' && (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
          <p className="mt-4 text-lg font-medium text-green-600">
            Payment successful!
          </p>
          <p className="text-2xl font-bold mt-2">A${amount.toFixed(2)}</p>
        </div>
      )}

      {/* Failed */}
      {terminalState === 'failed' && (
        <div className="text-center py-8">
          <XCircle className="h-12 w-12 mx-auto text-destructive" />
          <p className="mt-4 text-lg font-medium text-destructive">
            Payment failed
          </p>
          {error && (
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          )}
          <div className="flex gap-3 justify-center mt-6">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleTryAgain}>Try Again</Button>
          </div>
        </div>
      )}

      {/* Error Display (for non-failed states) */}
      {error && terminalState !== 'failed' && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
