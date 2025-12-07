// components/admin/checkout/checkout-types.ts

import type { PaymentMethodType } from '@/types/payments';

// =====================================================
// CHECKOUT ITEM
// =====================================================
export interface CheckoutItem {
  id: string;
  type: 'appointment' | 'product';
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  categoryColor?: string;
}

// =====================================================
// PAYMENT ENTRY
// =====================================================
export interface PaymentEntry {
  id: string;
  method: PaymentMethodType;
  amount: number;
  tipAmount?: number;
  label: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  paymentMethodId?: string;
  terminalId?: string;
  paymentIntentId?: string;
}

// =====================================================
// SAVED CARD
// =====================================================
export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

// =====================================================
// TERMINAL INFO
// =====================================================
export interface TerminalInfo {
  id: string;
  label: string;
  status: 'online' | 'offline';
  stripeTerminalId: string;
}

// =====================================================
// CHECKOUT STATE
// =====================================================
export interface CheckoutState {
  items: CheckoutItem[];
  payments: PaymentEntry[];
  subtotal: number;
  tax: number;
  total: number;
  totalPaid: number;
  remaining: number;
  selectedMethod: PaymentMethodType | null;
  isProcessing: boolean;
  error: string | null;
}

// =====================================================
// PAYMENT METHOD OPTION
// =====================================================
export interface PaymentMethodOption {
  id: PaymentMethodType | 'test';
  label: string;
  icon: React.ReactNode;
  description?: string;
  disabled?: boolean;
  devOnly?: boolean;
}

// =====================================================
// COMPONENT PROPS
// =====================================================
export interface PaymentMethodPickerProps {
  selectedMethod: PaymentMethodType | null;
  onSelectMethod: (method: PaymentMethodType) => void;
  terminalStatus?: 'online' | 'offline';
  hasSavedCards?: boolean;
  disabled?: boolean;
}

export interface OrderSummaryProps {
  items: CheckoutItem[];
  payments: PaymentEntry[];
  subtotal: number;
  tax: number;
  total: number;
  remaining: number;
  onRemovePayment: (paymentId: string) => void;
  isProcessing: boolean;
}

export interface SavedCardFormProps {
  clientId: string;
  amount: number;
  onPaymentComplete: (paymentEntry: PaymentEntry) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export interface TerminalFormProps {
  venueId: string;
  amount: number;
  bookingGroupId: string;
  onPaymentComplete: (paymentEntry: PaymentEntry) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export interface ManualCardFormProps {
  clientId: string | null;
  bookingGroupId: string;
  venueId: string;
  amount: number;
  onPaymentComplete: (paymentEntry: PaymentEntry) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export interface CashFormProps {
  amount: number;
  remaining: number;
  onPaymentComplete: (paymentEntry: PaymentEntry) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export interface TestPaymentFormProps {
  amount: number;
  onPaymentComplete: (paymentEntry: PaymentEntry) => void;
  onCancel: () => void;
  disabled?: boolean;
}
