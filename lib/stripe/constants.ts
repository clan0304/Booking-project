// lib/stripe/constants.ts

export const CURRENCY = 'aud';

export const PAYMENT_METHOD_TYPES = {
  CARD_ONLINE: 'card_online',
  CARD_TERMINAL: 'card_terminal',
  CARD_SAVED: 'card_saved',
  CASH: 'cash',
  OTHER: 'other',
} as const;

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;

export const REFUND_REASONS = {
  REQUESTED_BY_CUSTOMER: 'requested_by_customer',
  SERVICE_ISSUE: 'service_issue',
  PRODUCT_RETURN: 'product_return',
  DUPLICATE: 'duplicate',
  FRAUDULENT: 'fraudulent',
  LATE_CANCELLATION_WAIVED: 'late_cancellation_waived',
  OTHER: 'other',
} as const;

// Stripe webhook events we handle
export const WEBHOOK_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'setup_intent.succeeded',
  'setup_intent.setup_failed',
  'charge.refunded',
  'charge.refund.updated',
  'customer.created',
  'customer.deleted',
  'payment_method.attached',
  'payment_method.detached',
  'terminal.reader.action_succeeded',
  'terminal.reader.action_failed',
] as const;
