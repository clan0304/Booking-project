// components/admin/calendar/appointment/sale-details-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Receipt, CreditCard, Banknote, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBookingTransactions } from '@/app/actions/stripe/payment-intents';
import type { BookingGroupWithAppointments } from '@/types/calendar';
import type { Transaction } from '@/types/payments';

interface SaleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingGroupWithAppointments;
}

export function SaleDetailsModal({
  isOpen,
  onClose,
  booking,
}: SaleDetailsModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { transactions: txns, error } = await getBookingTransactions(
        booking.id
      );
      if (error) {
        setError(error);
      } else {
        setTransactions(txns || []);
      }
    } catch (err) {
      setError(`${err} Failed to load transaction details`);
    } finally {
      setIsLoading(false);
    }
  }, [booking.id]);

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen, loadTransactions]);

  const formatCurrency = (amount: number) => `A$${amount.toFixed(2)}`;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'card_terminal':
      case 'card_online':
      case 'card_saved':
        return <CreditCard className="h-4 w-4" />;
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'card_terminal':
        return 'Card Terminal';
      case 'card_online':
        return 'Card (Manual)';
      case 'card_saved':
        return 'Saved Card';
      case 'cash':
        return 'Cash';
      default:
        return method;
    }
  };

  const totalPaid = transactions.reduce(
    (sum, tx) => sum + tx.amount + tx.tip_amount,
    0
  );

  const totalTips = transactions.reduce((sum, tx) => sum + tx.tip_amount, 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - higher z-index than parent modal */}
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />

      {/* Modal - higher z-index than parent modal */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-[60] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Sale Complete</h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(booking.updated_at || booking.created_at)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-muted border-t-foreground rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive">{error}</p>
              <Button
                variant="outline"
                onClick={loadTransactions}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Services */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Services
                </h3>
                <div className="space-y-3">
                  {booking.appointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <p className="font-medium">{appt.service_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {appt.team_member?.first_name}{' '}
                          {appt.team_member?.last_name}
                        </p>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(appt.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border my-4" />

              {/* Payments */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Payments
                </h3>
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No payment records found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-background rounded-full">
                            {getPaymentMethodIcon(tx.payment_method)}
                          </div>
                          <div>
                            <p className="font-medium">
                              {getPaymentMethodLabel(tx.payment_method)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tx.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(tx.amount)}
                          </p>
                          {tx.tip_amount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              + {formatCurrency(tx.tip_amount)} tip
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border my-4" />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(booking.total_price)}</span>
                </div>
                {totalTips > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tips</span>
                    <span>{formatCurrency(totalTips)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg pt-2 border-t border-border">
                  <span>Total Paid</span>
                  <span className="text-green-600">
                    {formatCurrency(totalPaid)}
                  </span>
                </div>
              </div>

              {/* Client Info */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Client
                </h3>
                <p className="font-medium">
                  {booking.client
                    ? `${booking.client.first_name} ${booking.client.last_name}`
                    : `${booking.guest_first_name} ${
                        booking.guest_last_name || ''
                      }`}
                </p>
                {(booking.client?.email || booking.guest_email) && (
                  <p className="text-sm text-muted-foreground">
                    {booking.client?.email || booking.guest_email}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button className="flex-1" onClick={() => window.print()}>
              <Receipt className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
