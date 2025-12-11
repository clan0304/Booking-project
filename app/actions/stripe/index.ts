// =============================================
// STRIPE SERVER ACTIONS
// Export all Stripe-related server actions
// =============================================

// Customer management
export {
  getOrCreateStripeCustomer,
  getOrCreateStripeCustomerPublic,
  getStripeCustomerId,
  getStripeCustomer,
  deleteStripeCustomer,
  syncStripeCustomer,
} from './customers';

// Setup intents (save cards without charging)
export {
  createSetupIntent,
  savePaymentMethod,
  getClientPaymentMethods,
  setDefaultPaymentMethod,
  removePaymentMethod,
  clientHasPaymentMethod,
  getDefaultPaymentMethod,
  // NEW: Public functions
  createPublicSetupIntent,
  getPublicPaymentInfo,
} from './setup-intents';

// Payment intents (charge cards)
export {
  createPaymentIntent,
  chargePaymentMethod,
  recordCashPayment,
  recordCardPayment,
  getTransaction,
  getBookingTransactions,
  cancelPayment,
  chargeSavedCard,
} from './payment-intents';

// Refunds
export {
  processRefund,
  getRefund,
  getTransactionRefunds,
  getBookingRefunds,
  getRefundItems,
} from './refunds';

// Terminal (EFTPOS readers)
export {
  createTerminalLocation,
  getVenueLocationId,
  registerReader,
  getVenueTerminals,
  getReaderStatus,
  listStripeReaders,
  createTerminalPaymentIntent,
  processTerminalPayment,
  getReaderAction,
  cancelReaderAction,
  simulateTerminalPayment,
} from './terminal';

export type { TerminalInfo } from './terminal';
