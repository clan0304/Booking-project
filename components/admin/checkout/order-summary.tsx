// components/admin/checkout/order-summary.tsx
'use client';

import { Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrderSummaryProps } from './checkout-types';

export function OrderSummary({
  items,
  payments,
  subtotal,
  tax,
  total,

  onRemovePayment,
  isProcessing,
}: OrderSummaryProps) {
  const formatCurrency = (amount: number) => `A$${amount.toFixed(2)}`;

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'card_terminal':
        return '🖥️';
      case 'card_saved':
        return '💳';
      case 'card_online':
        return '⌨️';
      case 'cash':
        return '💵';
      case 'other':
        return '🧪';
      default:
        return '💰';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Items */}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3">
            <div
              className="w-1 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.categoryColor || '#E5E7EB' }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-foreground truncate">
                  {item.name}
                </h4>
                <span className="font-medium text-foreground ml-2">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              )}
              {item.originalPrice && item.originalPrice !== item.unitPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(item.originalPrice)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add to Cart Button (for future products) */}
      <Button variant="outline" size="sm" disabled className="mt-4 gap-2">
        <ShoppingCart className="h-4 w-4" />
        Add to cart
      </Button>

      {/* Divider */}
      <div className="my-4 border-t border-border" />

      {/* Totals */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Tax</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between font-semibold text-foreground text-base pt-2 border-t border-border">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Payments Added */}
      {payments.length > 0 && (
        <>
          <div className="my-4 border-t border-border" />
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>{getPaymentMethodIcon(payment.method)}</span>
                  <span className="text-foreground">{payment.label}</span>
                  {payment.status === 'processing' && (
                    <div className="h-3 w-3 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
                  )}
                  {payment.status === 'failed' && (
                    <span className="text-destructive text-xs">Failed</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground">
                    {formatCurrency(payment.amount + (payment.tipAmount || 0))}
                  </span>
                  {!isProcessing && payment.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemovePayment(payment.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
