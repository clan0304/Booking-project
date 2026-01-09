// components/admin/calendar/appointment/edit-appointment-payment-mode.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, ChevronLeft, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentMethodPicker } from '@/components/admin/checkout/payment-method-picker';
import { OrderSummary } from '@/components/admin/checkout/order-summary';
import { SavedCardForm } from '@/components/admin/checkout/payment-forms/saved-card-form';
import { TerminalFormReal as TerminalForm } from '@/components/admin/checkout/payment-forms/terminal-form-real';
import { ManualCardForm } from '@/components/admin/checkout/payment-forms/manual-card-form';
import { CashForm } from '@/components/admin/checkout/payment-forms/cash-form';
import { TestPaymentForm } from '@/components/admin/checkout/payment-forms/test-payment-form';
import {
  recordCardPayment,
  recordCashPayment,
  chargeSavedCard,
} from '@/app/actions/stripe';
import { getClientPaymentMethods } from '@/app/actions/stripe/setup-intents';
import { updateBooking } from '@/app/actions/bookings';
import { decrementProductStock } from '@/app/actions/products';
import type {
  CheckoutItem,
  PaymentEntry,
  CheckoutState,
} from '@/components/admin/checkout/checkout-types';
import type { PaymentMethodType } from '@/types/payments';
import type { BookingGroupWithAppointments } from '@/types/calendar';
import type { EditingAppointment } from './edit-appointment-types';
import type { SelectedProduct } from './product-picker';

interface PaymentModeProps {
  booking: BookingGroupWithAppointments;
  editingAppointments: Map<string, EditingAppointment>;
  addedProducts: SelectedProduct[];
  totalPrice: number;
  onBack: () => void;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentMode({
  booking,
  editingAppointments,
  addedProducts,
  totalPrice,
  onBack,
  onClose,
  onSuccess,
}: PaymentModeProps) {
  // Build checkout items from appointments AND products
  const items: CheckoutItem[] = [
    // Services/Appointments
    ...Array.from(editingAppointments.values()).map((appt) => ({
      id: appt.id,
      type: 'appointment' as const,
      name: appt.serviceName,
      description: `${appt.duration}min`,
      quantity: 1,
      unitPrice: appt.price,
      categoryColor: appt.categoryColor,
    })),
    // Products
    ...addedProducts.map((product) => ({
      id: product.productId,
      type: 'product' as const,
      name: product.productName,
      description: undefined,
      quantity: product.quantity,
      unitPrice: product.unitPrice,
      categoryColor: undefined,
    })),
  ];

  // State
  const [state, setState] = useState<CheckoutState>(() => ({
    items,
    payments: [],
    subtotal: totalPrice,
    tax: 0,
    total: totalPrice,
    totalPaid: 0,
    remaining: totalPrice,
    selectedMethod: null,
    isProcessing: false,
    error: null,
  }));

  const [hasSavedCards, setHasSavedCards] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState<'online' | 'offline'>(
    'offline'
  );
  const [isPayingNow, setIsPayingNow] = useState(false);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (booking.client_id) {
        const { paymentMethods } = await getClientPaymentMethods(
          booking.client_id
        );
        setHasSavedCards(paymentMethods.length > 0);
      }
      // TODO: Check terminal status for venue
      setTerminalStatus('online');
    };

    loadData();
  }, [booking.client_id, booking.venue_id]);

  // Recalculate totals
  useEffect(() => {
    const totalPaid = state.payments
      .filter((p) => p.status === 'succeeded' || p.status === 'pending')
      .reduce((sum, p) => sum + p.amount + (p.tipAmount || 0), 0);

    setState((prev) => ({
      ...prev,
      totalPaid,
      remaining: Math.max(0, prev.total - totalPaid),
    }));
  }, [state.payments, state.total]);

  // Handlers
  const handleSelectMethod = (method: PaymentMethodType) => {
    setState((prev) => ({
      ...prev,
      selectedMethod: method,
      error: null,
    }));
  };

  const handlePaymentComplete = (paymentEntry: PaymentEntry) => {
    setState((prev) => ({
      ...prev,
      payments: [...prev.payments, paymentEntry],
      selectedMethod: null,
      error: null,
    }));
  };

  const handleRemovePayment = (paymentId: string) => {
    setState((prev) => ({
      ...prev,
      payments: prev.payments.filter((p) => p.id !== paymentId),
    }));
  };

  const handleCancelForm = () => {
    setState((prev) => ({
      ...prev,
      selectedMethod: null,
      error: null,
    }));
  };

  const handlePayNow = async () => {
    if (state.remaining > 0.01) {
      setState((prev) => ({
        ...prev,
        error: 'Please add payments to cover the full amount',
      }));
      return;
    }

    setIsPayingNow(true);
    setState((prev) => ({ ...prev, isProcessing: true, error: null }));

    try {
      // Build checkout items for transaction (includes both services and products)
      const checkoutItems = items.map((item) => ({
        type: item.type,
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      for (const payment of state.payments) {
        if (payment.status !== 'pending') continue;

        if (payment.method === 'cash') {
          // Cash payment - record directly
          const { error } = await recordCashPayment(
            booking.id,
            booking.venue_id,
            payment.amount,
            booking.client_id,
            checkoutItems,
            payment.tipAmount || 0
          );

          if (error) throw new Error(error);

          setState((prev) => ({
            ...prev,
            payments: prev.payments.map((p) =>
              p.id === payment.id ? { ...p, status: 'succeeded' as const } : p
            ),
          }));
        } else if (payment.method === 'card_saved' && payment.paymentMethodId) {
          // SAVED CARD - Use chargeSavedCard which creates PaymentIntent + confirms + records
          if (!booking.client_id) {
            throw new Error('Client ID required for saved card payment');
          }

          const { error, paymentIntentId } = await chargeSavedCard(
            booking.id,
            booking.venue_id,
            payment.amount,
            booking.client_id,
            payment.paymentMethodId,
            checkoutItems,
            payment.tipAmount || 0
          );

          if (error) throw new Error(error);

          setState((prev) => ({
            ...prev,
            payments: prev.payments.map((p) =>
              p.id === payment.id
                ? {
                    ...p,
                    status: 'succeeded' as const,
                    paymentIntentId: paymentIntentId || undefined,
                  }
                : p
            ),
          }));
        } else if (
          payment.method === 'card_online' ||
          payment.method === 'card_terminal'
        ) {
          if (payment.paymentIntentId) {
            // REAL card payment - has Stripe PaymentIntent
            const { error } = await recordCardPayment(
              booking.id,
              booking.venue_id,
              payment.paymentIntentId,
              payment.amount,
              booking.client_id,
              checkoutItems,
              payment.method,
              payment.tipAmount || 0,
              payment.paymentMethodId,
              payment.terminalId
            );

            if (error) throw new Error(error);

            setState((prev) => ({
              ...prev,
              payments: prev.payments.map((p) =>
                p.id === payment.id ? { ...p, status: 'succeeded' as const } : p
              ),
            }));
          } else if (process.env.NODE_ENV === 'development') {
            // SIMULATED terminal/card - dev only, no Stripe involved
            // Record as cash payment for local testing
            console.warn('⚠️ Simulated card payment - dev only');
            const { error } = await recordCashPayment(
              booking.id,
              booking.venue_id,
              payment.amount,
              booking.client_id,
              checkoutItems,
              payment.tipAmount || 0
            );

            if (error) throw new Error(error);

            setState((prev) => ({
              ...prev,
              payments: prev.payments.map((p) =>
                p.id === payment.id ? { ...p, status: 'succeeded' as const } : p
              ),
            }));
          } else {
            // Production without paymentIntentId = something went wrong
            throw new Error('Card payment failed - no payment ID received');
          }
        } else if (payment.method === 'other') {
          // Test payment (dev only)
          if (process.env.NODE_ENV === 'development') {
            // Record test payment locally for testing View Sale modal
            console.warn('⚠️ Test payment - dev only');
            const { error } = await recordCashPayment(
              booking.id,
              booking.venue_id,
              payment.amount,
              booking.client_id,
              checkoutItems,
              payment.tipAmount || 0
            );

            if (error) throw new Error(error);
          }

          setState((prev) => ({
            ...prev,
            payments: prev.payments.map((p) =>
              p.id === payment.id ? { ...p, status: 'succeeded' as const } : p
            ),
          }));
        }
      }

      // Decrement product stock after successful payment
      if (addedProducts.length > 0) {
        const stockUpdates = addedProducts.map((p) => ({
          productId: p.productId,
          quantity: p.quantity,
        }));

        const { error: stockError } = await decrementProductStock(
          booking.venue_id,
          stockUpdates
        );

        if (stockError) {
          console.error('Failed to decrement stock:', stockError);
          // Don't throw - payment already succeeded, just log the error
        }
      }

      // Update booking status to completed
      await updateBooking(booking.id, { status: 'completed' });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Payment error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Payment failed',
        isProcessing: false,
      }));
    } finally {
      setIsPayingNow(false);
    }
  };

  // Render payment form
  const renderPaymentForm = () => {
    if (!state.selectedMethod) return null;

    const formProps = {
      amount: state.remaining,
      onPaymentComplete: handlePaymentComplete,
      onCancel: handleCancelForm,
      disabled: state.isProcessing,
    };

    switch (state.selectedMethod) {
      case 'card_saved':
        return booking.client_id ? (
          <SavedCardForm {...formProps} clientId={booking.client_id} />
        ) : null;

      case 'card_terminal':
        return (
          <TerminalForm
            {...formProps}
            venueId={booking.venue_id}
            bookingGroupId={booking.id}
          />
        );

      case 'card_online':
        return (
          <ManualCardForm
            {...formProps}
            clientId={booking.client_id}
            bookingGroupId={booking.id}
            venueId={booking.venue_id}
          />
        );

      case 'cash':
        return <CashForm {...formProps} remaining={state.remaining} />;

      case 'other':
        return <TestPaymentForm {...formProps} />;

      default:
        return null;
    }
  };

  const isFullyPaid = state.remaining <= 0.01;
  const hasPayments = state.payments.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            disabled={state.isProcessing}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">Checkout</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          disabled={state.isProcessing}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Side - Payment Methods */}
        <div className="flex-1 p-6 overflow-y-auto border-r border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Payment methods
          </h3>

          {!state.selectedMethod && (
            <PaymentMethodPicker
              selectedMethod={state.selectedMethod}
              onSelectMethod={handleSelectMethod}
              terminalStatus={terminalStatus}
              hasSavedCards={hasSavedCards}
              disabled={state.isProcessing || isFullyPaid}
            />
          )}

          {state.selectedMethod && (
            <div className="mt-4">{renderPaymentForm()}</div>
          )}

          {state.error && (
            <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              {state.error}
            </div>
          )}
        </div>

        {/* Right Side - Order Summary */}
        <div className="w-80 lg:w-96 flex flex-col bg-muted/30">
          <OrderSummary
            items={state.items}
            payments={state.payments}
            subtotal={state.subtotal}
            tax={state.tax}
            total={state.total}
            remaining={state.remaining}
            onRemovePayment={handleRemovePayment}
            isProcessing={state.isProcessing}
          />

          {/* Footer */}
          <div className="p-4 border-t border-border bg-background">
            {/* Payment Status */}
            <div className="mb-4 text-sm">
              {isFullyPaid ? (
                <span className="text-green-600 font-medium">
                  ✓ Full payment added
                </span>
              ) : hasPayments ? (
                <span className="text-amber-600 font-medium">
                  Remaining: A${state.remaining.toFixed(2)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Select a payment method
                </span>
              )}
            </div>

            {/* Pay Now Button */}
            <div className="flex gap-3">
              <Button variant="outline" size="icon" title="More options">
                <MoreVertical className="h-5 w-5" />
              </Button>
              <Button
                onClick={handlePayNow}
                disabled={!isFullyPaid || isPayingNow}
                className="flex-1"
              >
                {isPayingNow ? (
                  <>
                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Pay now'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
