// =============================================
// STRIPE CUSTOMER
// =============================================
export interface StripeCustomer {
  id: string;
  client_id: string;
  stripe_customer_id: string;
  created_at: string;
}

// =============================================
// PAYMENT METHODS
// =============================================
export interface PaymentMethod {
  id: string;
  client_id: string;
  stripe_customer_id: string; // ADDED: Links to Stripe customer for integrity
  stripe_payment_method_id: string;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay'
  | 'unknown';

// =============================================
// STRIPE TERMINALS
// =============================================
export interface StripeTerminal {
  id: string;
  venue_id: string;
  stripe_terminal_id: string;
  stripe_location_id: string | null;
  label: string;
  device_type: string | null;
  serial_number: string | null;
  status: 'online' | 'offline';
  last_seen_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================
// CANCELLATION POLICIES
// =============================================
export interface CancellationPolicy {
  id: string;
  venue_id: string;
  notice_hours: number;
  late_cancel_fee_type: 'percentage' | 'fixed';
  late_cancel_fee_value: number;
  no_show_fee_type: 'percentage' | 'fixed';
  no_show_fee_value: number;
  require_card_for_booking: boolean;
  min_booking_value_for_card: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================
// TRANSACTIONS
// =============================================
export type PaymentMethodType =
  | 'card_online'
  | 'card_terminal'
  | 'card_saved'
  | 'cash'
  | 'other';

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'canceled';

export interface Transaction {
  id: string;
  booking_group_id: string;
  venue_id: string;
  client_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount: number;
  tip_amount: number;
  currency: string;
  payment_method: PaymentMethodType;
  payment_method_id: string | null;
  terminal_id: string | null;
  status: TransactionStatus;
  failure_reason: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  processed_by: string | null;
}

export interface TransactionWithDetails extends Transaction {
  items: TransactionItem[];
  refunds: Refund[];
  payment_method_details?: PaymentMethod;
  terminal_details?: StripeTerminal;
}

// =============================================
// TRANSACTION ITEMS
// =============================================
export type TransactionItemType = 'appointment' | 'product' | 'fee' | 'other';
export type RefundItemStatus = 'none' | 'partial' | 'full';

export interface TransactionItem {
  id: string;
  transaction_id: string;
  item_type: TransactionItemType;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  refunded_amount: number;
  refund_status: RefundItemStatus;
  created_at: string;
}

// =============================================
// REFUNDS
// =============================================
export type RefundStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type RefundReason =
  | 'requested_by_customer'
  | 'service_issue'
  | 'duplicate'
  | 'fraudulent'
  | 'late_cancellation' // For late cancel fee scenarios
  | 'no_show' // For no-show fee scenarios
  | 'other';

export interface Refund {
  id: string;
  transaction_id: string;
  stripe_refund_id: string | null;
  amount: number;
  reason: RefundReason | null; // Now nullable
  notes: string | null;
  status: RefundStatus;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  refunded_by: string;
}

export interface RefundItem {
  id: string;
  refund_id: string;
  transaction_item_id: string;
  amount: number;
  quantity: number;
  created_at: string;
}

export interface RefundWithItems extends Refund {
  items: RefundItem[];
}

// =============================================
// CHECKOUT TYPES
// =============================================
export interface CheckoutItem {
  type: TransactionItemType;
  id: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
}

export interface CheckoutPayment {
  method: PaymentMethodType;
  amount: number;
  tipAmount?: number;
  paymentMethodId?: string; // For saved cards
  terminalId?: string; // For EFTPOS
}

export interface CheckoutData {
  bookingGroupId: string;
  venueId: string;
  clientId: string | null;
  items: CheckoutItem[];
  payments: CheckoutPayment[];
  totalAmount: number;
  processedBy: string;
}

// =============================================
// API RESPONSE TYPES
// =============================================
export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface CreateSetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
}

export interface TerminalPaymentResponse {
  success: boolean;
  readerId: string;
  paymentIntentId: string;
}

// =============================================
// BOOKING GROUP PAYMENT EXTENSION
// =============================================
export type BookingPaymentStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'refunded'
  | 'partially_refunded';

export interface BookingGroupPayment {
  total_paid: number;
  payment_status: BookingPaymentStatus;
}
