// components/admin/calendar/appointment/sale-details-modal.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Receipt,
  CreditCard,
  Banknote,
  CheckCircle,
  MoreVertical,
  RotateCcw,
  Printer,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getBookingTransactions,
  getTransactionItems,
} from '@/app/actions/stripe/payment-intents';
import { processRefund } from '@/app/actions/stripe/refunds';
import type { BookingGroupWithAppointments } from '@/types/calendar';
import type {
  Transaction,
  TransactionItem,
  RefundReason,
} from '@/types/payments';

interface SaleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingGroupWithAppointments;
  onRefundSuccess?: () => void;
}

type ModalMode = 'view' | 'refund';

const REFUND_REASONS: { value: RefundReason; label: string }[] = [
  { value: 'requested_by_customer', label: 'Requested by customer' },
  { value: 'service_issue', label: 'Service issue' },
  { value: 'duplicate', label: 'Duplicate charge' },
  { value: 'late_cancellation', label: 'Late cancellation' },
  { value: 'no_show', label: 'No show' },
  { value: 'other', label: 'Other' },
];

export function SaleDetailsModal({
  isOpen,
  onClose,
  booking,
  onRefundSuccess,
}: SaleDetailsModalProps) {
  // Core state
  const [mode, setMode] = useState<ModalMode>('view');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionItems, setTransactionItems] = useState<
    Map<string, TransactionItem[]>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Menu state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Refund state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [refundReason, setRefundReason] = useState<RefundReason | ''>('');
  const [refundNotes, setRefundNotes] = useState('');
  const [customRefundAmount, setCustomRefundAmount] = useState<string>('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Load transactions and their items
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

        // Load transaction items for each transaction
        const itemsMap = new Map<string, TransactionItem[]>();
        for (const tx of txns || []) {
          const { items } = await getTransactionItems(tx.id);
          if (items) {
            itemsMap.set(tx.id, items);
          }
        }
        setTransactionItems(itemsMap);
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
      setShowMoreMenu(false);
      setMode('view');
      resetRefundState();
    }
  }, [isOpen, loadTransactions]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  // Helper functions
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

  const resetRefundState = () => {
    setSelectedItems(new Set());
    setRefundReason('');
    setRefundNotes('');
    setCustomRefundAmount('');
    setUseCustomAmount(false);
    setRefundError(null);
  };

  // Calculate totals
  const totalPaid = transactions.reduce(
    (sum, tx) => sum + tx.amount + tx.tip_amount,
    0
  );

  const totalTips = transactions.reduce((sum, tx) => sum + tx.tip_amount, 0);

  // Get all refundable items with their transaction info
  const getRefundableItems = (): Array<{
    transactionId: string;
    item: TransactionItem;
    availableToRefund: number;
  }> => {
    const items: Array<{
      transactionId: string;
      item: TransactionItem;
      availableToRefund: number;
    }> = [];

    transactions.forEach((tx) => {
      // Only allow refunds from succeeded transactions
      if (tx.status !== 'succeeded' && tx.status !== 'partially_refunded') {
        return;
      }

      const txItems = transactionItems.get(tx.id) || [];
      txItems.forEach((item) => {
        const availableToRefund =
          item.total_price - (item.refunded_amount || 0);
        if (availableToRefund > 0) {
          items.push({
            transactionId: tx.id,
            item,
            availableToRefund,
          });
        }
      });
    });

    return items;
  };

  // Calculate refund amount based on selected items
  const calculateRefundAmount = (): number => {
    if (useCustomAmount && customRefundAmount) {
      return parseFloat(customRefundAmount) || 0;
    }

    const refundableItems = getRefundableItems();
    let total = 0;

    refundableItems.forEach(({ item, availableToRefund }) => {
      if (selectedItems.has(item.id)) {
        total += availableToRefund;
      }
    });

    return total;
  };

  // Get max refundable amount
  const getMaxRefundable = (): number => {
    return transactions.reduce((sum, tx) => {
      if (tx.status !== 'succeeded' && tx.status !== 'partially_refunded') {
        return sum;
      }
      const txItems = transactionItems.get(tx.id) || [];
      return (
        sum +
        txItems.reduce(
          (itemSum, item) =>
            itemSum + (item.total_price - (item.refunded_amount || 0)),
          0
        )
      );
    }, 0);
  };

  // Handle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
    setUseCustomAmount(false);
  };

  // Select all items
  const selectAllItems = () => {
    const refundableItems = getRefundableItems();
    setSelectedItems(new Set(refundableItems.map(({ item }) => item.id)));
    setUseCustomAmount(false);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedItems(new Set());
    setUseCustomAmount(false);
  };

  // Handle refund submission
  const handleProcessRefund = async () => {
    const refundAmount = calculateRefundAmount();

    if (refundAmount <= 0) {
      setRefundError('Please select items to refund or enter a custom amount');
      return;
    }

    if (!refundReason) {
      setRefundError('Please select a refund reason');
      return;
    }

    // Find which transaction to refund from (use first one with available balance)
    const refundableItems = getRefundableItems();
    const selectedItemsData = refundableItems.filter(({ item }) =>
      selectedItems.has(item.id)
    );

    // Group by transaction
    const itemsByTransaction = new Map<
      string,
      Array<{ item: TransactionItem; availableToRefund: number }>
    >();
    selectedItemsData.forEach(({ transactionId, item, availableToRefund }) => {
      const existing = itemsByTransaction.get(transactionId) || [];
      existing.push({ item, availableToRefund });
      itemsByTransaction.set(transactionId, existing);
    });

    if (itemsByTransaction.size === 0 && !useCustomAmount) {
      setRefundError('No items selected for refund');
      return;
    }

    setIsProcessingRefund(true);
    setRefundError(null);

    try {
      // Process refund for each transaction
      for (const [transactionId, items] of itemsByTransaction) {
        const transactionRefundAmount = items.reduce(
          (sum, { availableToRefund }) => sum + availableToRefund,
          0
        );

        const refundItems = items.map(({ item, availableToRefund }) => ({
          transactionItemId: item.id,
          amount: availableToRefund,
          quantity: item.quantity,
        }));

        const { error } = await processRefund(
          transactionId,
          transactionRefundAmount,
          refundReason as RefundReason,
          refundNotes || null,
          refundItems
        );

        if (error) {
          setRefundError(error);
          setIsProcessingRefund(false);
          return;
        }
      }

      // If using custom amount without specific items, refund from first available transaction
      if (useCustomAmount && selectedItems.size === 0) {
        const firstAvailableTx = transactions.find(
          (tx) =>
            tx.status === 'succeeded' || tx.status === 'partially_refunded'
        );

        if (firstAvailableTx) {
          const { error } = await processRefund(
            firstAvailableTx.id,
            refundAmount,
            refundReason as RefundReason,
            refundNotes || null
          );

          if (error) {
            setRefundError(error);
            setIsProcessingRefund(false);
            return;
          }
        }
      }

      // Success - reload data and go back to view mode
      await loadTransactions();
      setMode('view');
      resetRefundState();
      onRefundSuccess?.();
    } catch (err) {
      console.error('Refund error:', err);
      setRefundError('An unexpected error occurred');
    } finally {
      setIsProcessingRefund(false);
    }
  };

  // Menu handlers
  const handlePrintReceipt = () => {
    setShowMoreMenu(false);
    window.print();
  };

  const handleRefund = () => {
    setShowMoreMenu(false);
    setMode('refund');
  };

  if (!isOpen) return null;

  const refundableItems = getRefundableItems();
  const hasRefundableItems = refundableItems.length > 0;
  const refundAmount = calculateRefundAmount();
  const maxRefundable = getMaxRefundable();

  // =====================================================
  // RENDER: VIEW MODE
  // =====================================================
  const renderViewMode = () => (
    <>
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
              size="sm"
              className="mt-4"
              onClick={loadTransactions}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Services */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Services
              </h3>
              <div className="space-y-3">
                {booking.appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex justify-between items-start"
                  >
                    <div>
                      <p className="font-medium">{apt.service_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.team_member
                          ? `${apt.team_member.first_name} ${
                              apt.team_member.last_name || ''
                            }`
                          : 'Staff'}
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(apt.price)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-4" />

            {/* Payments */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Payments
              </h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No payment records found
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-background rounded-md">
                          {getPaymentMethodIcon(tx.payment_method)}
                        </div>
                        <div>
                          <p className="font-medium">
                            {getPaymentMethodLabel(tx.payment_method)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(tx.created_at)}
                          </p>
                          {tx.status === 'refunded' && (
                            <span className="text-xs text-red-600 font-medium">
                              Refunded
                            </span>
                          )}
                          {tx.status === 'partially_refunded' && (
                            <span className="text-xs text-orange-600 font-medium">
                              Partially Refunded
                            </span>
                          )}
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

          {/* Three-dot menu */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="h-10 w-10"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>

            {/* Dropdown Menu */}
            {showMoreMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                {hasRefundableItems && (
                  <button
                    onClick={handleRefund}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4 text-gray-500" />
                    Refund
                  </button>
                )}
                <button
                  onClick={handlePrintReceipt}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <Printer className="h-4 w-4 text-gray-500" />
                  Print Receipt
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // =====================================================
  // RENDER: REFUND MODE
  // =====================================================
  const renderRefundMode = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setMode('view');
              resetRefundState();
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">Process Refund</h2>
            <p className="text-sm text-muted-foreground">
              Select items to refund
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Error message */}
        {refundError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-800">{refundError}</p>
          </div>
        )}

        {/* Select/Clear All */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Items ({refundableItems.length})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllItems}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={clearSelection}
              className="text-sm text-gray-600 hover:text-gray-700 font-medium"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Refundable Items List */}
        <div className="space-y-2 mb-6">
          {refundableItems.map(({ item, availableToRefund }) => (
            <label
              key={item.id}
              className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedItems.has(item.id)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  onChange={() => toggleItemSelection(item.id)}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <p className="font-medium">{item.item_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                  {item.refunded_amount > 0 && (
                    <p className="text-xs text-orange-600">
                      Already refunded: {formatCurrency(item.refunded_amount)}
                    </p>
                  )}
                </div>
              </div>
              <p className="font-medium">{formatCurrency(availableToRefund)}</p>
            </label>
          ))}
        </div>

        {/* Custom Amount Option */}
        <div className="mb-6">
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={useCustomAmount}
              onChange={(e) => setUseCustomAmount(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium">Use custom amount</span>
          </label>
          {useCustomAmount && (
            <div className="mt-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  A$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={maxRefundable}
                  value={customRefundAmount}
                  onChange={(e) => setCustomRefundAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum refundable: {formatCurrency(maxRefundable)}
              </p>
            </div>
          )}
        </div>

        {/* Refund Reason */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Refund Reason <span className="text-red-500">*</span>
          </label>
          <select
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value as RefundReason)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Select a reason...</option>
            {REFUND_REASONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={refundNotes}
            onChange={(e) => setRefundNotes(e.target.value)}
            placeholder="Add any additional notes about this refund..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-muted-foreground">Refund Amount</span>
          <span className="text-xl font-bold text-red-600">
            {formatCurrency(refundAmount)}
          </span>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setMode('view');
              resetRefundState();
            }}
            disabled={isProcessingRefund}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700"
            onClick={handleProcessRefund}
            disabled={isProcessingRefund || refundAmount <= 0 || !refundReason}
          >
            {isProcessingRefund ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Confirm Refund
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-[60] flex flex-col">
        {mode === 'view' ? renderViewMode() : renderRefundMode()}
      </div>
    </>
  );
}
