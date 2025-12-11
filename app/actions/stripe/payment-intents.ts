'use server';

import Stripe from 'stripe';
import { stripe, formatAmountForStripe } from '@/lib/stripe/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireStaff, requireAdmin } from '@/lib/auth';
import { getOrCreateStripeCustomer, getStripeCustomerId } from './customers';
import type {
  CreatePaymentIntentResponse,
  Transaction,
  CheckoutItem,
  PaymentMethodType,
} from '@/types/payments';

/**
 * Create a PaymentIntent for online card payment
 */
export async function createPaymentIntent(
  bookingGroupId: string,
  amount: number,
  clientId: string | null,
  description?: string
): Promise<{ data: CreatePaymentIntentResponse | null; error: string | null }> {
  try {
    const { userId } = await requireStaff();

    // Get customer ID if client exists
    let customerId: string | undefined;
    if (clientId) {
      const { customerId: cid } = await getOrCreateStripeCustomer(clientId);
      customerId = cid || undefined;
    }

    // Get booking details for metadata
    const { data: booking } = await supabaseAdmin
      .from('booking_groups')
      .select('venue_id')
      .eq('id', bookingGroupId)
      .single();

    if (!booking) {
      return { data: null, error: 'Booking not found' };
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency: 'aud',
      customer: customerId,
      description: description || 'Service payment',
      metadata: {
        booking_group_id: bookingGroupId,
        venue_id: booking.venue_id,
        client_id: clientId || '',
        processed_by: userId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    if (!paymentIntent.client_secret) {
      return { data: null, error: 'Failed to create payment intent' };
    }

    return {
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error creating PaymentIntent:', error);
    return { data: null, error: 'Failed to create payment' };
  }
}

/**
 * Charge a saved payment method (for auto-charge scenarios)
 * Only admins can auto-charge (for late cancellation, no-show)
 */
export async function chargePaymentMethod(
  bookingGroupId: string,
  amount: number,
  clientId: string,
  paymentMethodId: string,
  description: string
): Promise<{ transaction: Transaction | null; error: string | null }> {
  try {
    const { userId } = await requireAdmin();

    // Get Stripe customer ID
    const stripeCustomerId = await getStripeCustomerId(clientId);
    if (!stripeCustomerId) {
      return { transaction: null, error: 'Customer not found' };
    }

    // Get payment method details
    const { data: pm } = await supabaseAdmin
      .from('payment_methods')
      .select('stripe_payment_method_id')
      .eq('id', paymentMethodId)
      .single();

    if (!pm) {
      return { transaction: null, error: 'Payment method not found' };
    }

    // Get booking details
    const { data: booking } = await supabaseAdmin
      .from('booking_groups')
      .select('venue_id')
      .eq('id', bookingGroupId)
      .single();

    if (!booking) {
      return { transaction: null, error: 'Booking not found' };
    }

    // Create and confirm PaymentIntent
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: formatAmountForStripe(amount),
        currency: 'aud',
        customer: stripeCustomerId,
        payment_method: pm.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description,
        metadata: {
          booking_group_id: bookingGroupId,
          venue_id: booking.venue_id,
          client_id: clientId,
          processed_by: userId,
          auto_charge: 'true',
        },
      });
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeCardError;
      console.error('Stripe charge error:', stripeError);
      return {
        transaction: null,
        error: stripeError.message || 'Card was declined',
      };
    }

    // Get charge ID
    const chargeId =
      typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id ?? null;

    // Create transaction record
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        booking_group_id: bookingGroupId,
        venue_id: booking.venue_id,
        client_id: clientId,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: chargeId,
        amount,
        payment_method: 'card_saved' as PaymentMethodType,
        payment_method_id: paymentMethodId,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        description,
        processed_by: userId,
      })
      .select()
      .single();

    if (txError) {
      console.error('Error creating transaction:', txError);
      return {
        transaction: null,
        error: 'Payment succeeded but failed to record',
      };
    }

    return { transaction, error: null };
  } catch (error) {
    console.error('Error charging payment method:', error);
    return { transaction: null, error: 'Failed to charge card' };
  }
}

/**
 * Record a cash payment
 */
export async function recordCashPayment(
  bookingGroupId: string,
  venueId: string,
  amount: number,
  clientId: string | null,
  items: CheckoutItem[],
  tipAmount: number = 0
): Promise<{ transaction: Transaction | null; error: string | null }> {
  try {
    const { userId } = await requireStaff();

    // Create transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        booking_group_id: bookingGroupId,
        venue_id: venueId,
        client_id: clientId,
        amount,
        tip_amount: tipAmount,
        payment_method: 'cash' as PaymentMethodType,
        status: 'succeeded',
        description: 'Cash payment',
        processed_by: userId,
      })
      .select()
      .single();

    if (txError) {
      return { transaction: null, error: 'Failed to record payment' };
    }

    // Create transaction items
    if (items.length > 0) {
      const transactionItems = items.map((item) => ({
        transaction_id: transaction.id,
        item_type: item.type,
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discountAmount || 0,
        total_price:
          item.quantity * item.unitPrice - (item.discountAmount || 0),
      }));

      await supabaseAdmin.from('transaction_items').insert(transactionItems);
    }

    return { transaction, error: null };
  } catch (error) {
    console.error('Error recording cash payment:', error);
    return { transaction: null, error: 'Failed to record payment' };
  }
}

/**
 * Record a successful card payment (called after Stripe confirmation)
 */
export async function recordCardPayment(
  bookingGroupId: string,
  venueId: string,
  paymentIntentId: string,
  amount: number,
  clientId: string | null,
  items: CheckoutItem[],
  paymentMethodType: 'card_online' | 'card_terminal' | 'card_saved',
  tipAmount: number = 0,
  paymentMethodId?: string,
  terminalId?: string
): Promise<{ transaction: Transaction | null; error: string | null }> {
  try {
    const { userId } = await requireStaff();

    // Get charge ID from PaymentIntent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const chargeId =
      typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id ?? null;

    // Create transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        booking_group_id: bookingGroupId,
        venue_id: venueId,
        client_id: clientId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
        amount,
        tip_amount: tipAmount,
        payment_method: paymentMethodType,
        payment_method_id: paymentMethodId || null,
        terminal_id: terminalId || null,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        description: 'Card payment',
        processed_by: userId,
      })
      .select()
      .single();

    if (txError) {
      return { transaction: null, error: 'Failed to record payment' };
    }

    // Create transaction items
    if (items.length > 0) {
      const transactionItems = items.map((item) => ({
        transaction_id: transaction.id,
        item_type: item.type,
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discountAmount || 0,
        total_price:
          item.quantity * item.unitPrice - (item.discountAmount || 0),
      }));

      await supabaseAdmin.from('transaction_items').insert(transactionItems);
    }

    return { transaction, error: null };
  } catch (error) {
    console.error('Error recording card payment:', error);
    return { transaction: null, error: 'Failed to record payment' };
  }
}

/**
 * Get transaction by ID
 */
export async function getTransaction(
  transactionId: string
): Promise<{ transaction: Transaction | null; error: string | null }> {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) {
      return { transaction: null, error: 'Transaction not found' };
    }

    return { transaction: data, error: null };
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return { transaction: null, error: 'Failed to fetch transaction' };
  }
}

/**
 * Get all transactions for a booking group
 */
export async function getBookingTransactions(
  bookingGroupId: string
): Promise<{ transactions: Transaction[]; error: string | null }> {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('booking_group_id', bookingGroupId)
      .order('created_at', { ascending: false });

    if (error) {
      return { transactions: [], error: 'Failed to fetch transactions' };
    }

    return { transactions: data || [], error: null };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return { transactions: [], error: 'Failed to fetch transactions' };
  }
}

/**
 * Cancel a pending payment
 */
export async function cancelPayment(
  transactionId: string
): Promise<{ error: string | null }> {
  try {
    await requireAdmin();

    // Get transaction
    const { data: transaction } = await supabaseAdmin
      .from('transactions')
      .select('stripe_payment_intent_id, status')
      .eq('id', transactionId)
      .single();

    if (!transaction) {
      return { error: 'Transaction not found' };
    }

    if (transaction.status !== 'pending') {
      return { error: 'Can only cancel pending payments' };
    }

    // Cancel in Stripe if applicable
    if (transaction.stripe_payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(
          transaction.stripe_payment_intent_id
        );
      } catch (stripeError) {
        console.warn('Stripe cancel warning:', stripeError);
      }
    }

    // Update transaction status
    await supabaseAdmin
      .from('transactions')
      .update({ status: 'canceled' })
      .eq('id', transactionId);

    return { error: null };
  } catch (error) {
    console.error('Error canceling payment:', error);
    return { error: 'Failed to cancel payment' };
  }
}
/**
 * Charge a saved payment method during checkout
 * Creates PaymentIntent, confirms it, and records transaction
 */
export async function chargeSavedCard(
  bookingGroupId: string,
  venueId: string,
  amount: number,
  clientId: string,
  paymentMethodDbId: string,
  items: CheckoutItem[],
  tipAmount: number = 0
): Promise<{
  transaction: Transaction | null;
  paymentIntentId: string | null;
  error: string | null;
}> {
  try {
    const { supabaseUserId } = await requireStaff(); // ← Use supabaseUserId, not userId

    // Get Stripe customer ID
    const stripeCustomerId = await getStripeCustomerId(clientId);
    if (!stripeCustomerId) {
      return {
        transaction: null,
        paymentIntentId: null,
        error: 'Customer not found in Stripe',
      };
    }

    // Get the Stripe payment method ID from our database
    const { data: pm } = await supabaseAdmin
      .from('payment_methods')
      .select('stripe_payment_method_id')
      .eq('id', paymentMethodDbId)
      .single();

    if (!pm) {
      return {
        transaction: null,
        paymentIntentId: null,
        error: 'Payment method not found',
      };
    }

    // Create and confirm PaymentIntent in one step
    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: formatAmountForStripe(amount + tipAmount),
        currency: 'aud',
        customer: stripeCustomerId,
        payment_method: pm.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: 'Service payment',
        metadata: {
          booking_group_id: bookingGroupId,
          venue_id: venueId,
          client_id: clientId,
          processed_by: supabaseUserId, // ← Use supabaseUserId for metadata too
        },
      });
    } catch (stripeError) {
      const err = stripeError as Stripe.errors.StripeCardError;
      console.error('Stripe charge error:', err);
      return {
        transaction: null,
        paymentIntentId: null,
        error: err.message || 'Card was declined',
      };
    }

    // Get charge ID
    const chargeId =
      typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id ?? null;

    // Create transaction record
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        booking_group_id: bookingGroupId,
        venue_id: venueId,
        client_id: clientId,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: chargeId,
        amount,
        tip_amount: tipAmount,
        payment_method: 'card_saved' as PaymentMethodType,
        payment_method_id: paymentMethodDbId,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        description: 'Card payment (saved card)',
        processed_by: supabaseUserId, // ← Use supabaseUserId here
      })
      .select()
      .single();

    if (txError) {
      console.error('Error creating transaction:', txError);
      return {
        transaction: null,
        paymentIntentId: paymentIntent.id,
        error: 'Payment succeeded but failed to record transaction',
      };
    }

    // Create transaction items
    if (items.length > 0) {
      const transactionItems = items.map((item) => ({
        transaction_id: transaction.id,
        item_type: item.type,
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: 0,
        total_price: item.quantity * item.unitPrice,
      }));

      await supabaseAdmin.from('transaction_items').insert(transactionItems);
    }

    return { transaction, paymentIntentId: paymentIntent.id, error: null };
  } catch (error) {
    console.error('Error charging saved card:', error);
    return {
      transaction: null,
      paymentIntentId: null,
      error: 'Failed to process payment',
    };
  }
}
