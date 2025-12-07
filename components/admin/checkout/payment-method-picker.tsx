// components/admin/checkout/payment-method-picker.tsx
'use client';

import {
  CreditCard,
  Smartphone,
  Keyboard,
  Banknote,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PaymentMethodPickerProps,
  PaymentMethodOption,
} from './checkout-types';
import type { PaymentMethodType } from '@/types/payments';

export function PaymentMethodPicker({
  selectedMethod,
  onSelectMethod,
  terminalStatus = 'offline',
  hasSavedCards = false,
  disabled = false,
}: PaymentMethodPickerProps) {
  const isDev = process.env.NODE_ENV === 'development';

  const paymentMethods: PaymentMethodOption[] = [
    {
      id: 'card_saved',
      label: 'Saved Card',
      icon: <CreditCard className="h-6 w-6" />,
      description: hasSavedCards ? 'Available' : 'No cards saved',
      disabled: !hasSavedCards,
    },
    {
      id: 'card_terminal',
      label: 'Card Terminal',
      icon: <Smartphone className="h-6 w-6" />,
      description: terminalStatus === 'online' ? 'Connected' : 'Offline',
      disabled: terminalStatus !== 'online',
    },
    {
      id: 'card_online',
      label: 'Manual Entry',
      icon: <Keyboard className="h-6 w-6" />,
      description: 'Type card details',
    },
    {
      id: 'cash',
      label: 'Cash',
      icon: <Banknote className="h-6 w-6" />,
    },
    {
      id: 'other',
      label: 'Test Payment',
      icon: <FlaskConical className="h-6 w-6" />,
      description: 'Dev testing only',
      devOnly: true,
    },
  ];

  const visibleMethods = paymentMethods.filter(
    (method) => !method.devOnly || isDev
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      {visibleMethods.map((method) => {
        const isSelected = selectedMethod === method.id;
        const isDisabled = disabled || method.disabled;

        return (
          <button
            key={method.id}
            onClick={() =>
              !isDisabled && onSelectMethod(method.id as PaymentMethodType)
            }
            disabled={isDisabled}
            className={cn(
              'relative flex flex-col items-center justify-center gap-2 p-4',
              'rounded-lg border-2 transition-all min-h-[100px]',
              isSelected
                ? 'border-primary bg-accent'
                : isDisabled
                ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50'
                : 'border-border bg-background hover:border-primary/50 hover:bg-accent/50'
            )}
          >
            <div
              className={cn(
                isSelected ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {method.icon}
            </div>

            <span className="text-sm font-medium">{method.label}</span>

            {method.description && (
              <span
                className={cn(
                  'text-xs',
                  isSelected
                    ? 'text-primary'
                    : method.id === 'card_terminal' &&
                      terminalStatus === 'online'
                    ? 'text-green-600'
                    : 'text-muted-foreground'
                )}
              >
                {method.description}
              </span>
            )}

            {method.devOnly && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                DEV
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
