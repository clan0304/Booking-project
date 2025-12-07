'use server';

import Stripe from 'stripe';
import { stripe, formatAmountForStripe } from '@/lib/stripe/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import type { Refund, RefundReason } from '@/types/payments';

interface RefundItemInput {
  transactionItemId: string;
  amount: number;
  quantity: number;
}

/**
 * Map our internal refund reason to Stripe's accepted values
 */
function mapToStripeReason(
  reason: RefundReason | null
): Stripe.RefundCreateParams.Reason | undefined {
  if (!reason) return undefined;

  switch (reason) {
    case 'duplicate':
      return 'duplicate';
    case 'fraudulent':
      return 'fraudulent';
    case 'requested_by_customer':
    case 'service_issue':
    case 'late_cancellation':
    case 'no_show':
    case 'other':
      return 'requested_by_customer';
    default:
      return undefined;
  }
}

/**
 * Process a refund (full or partial)
 *
 * @param transactionId - The transaction to refund from
 * @param amount - Amount to refund
 * @param reason - Optional reason (nullable)
 * @param notes - Optional notes
 * @param items - Optional array of specific items being refunded
 */
export async function processRefund(
  transactionId: string,
  amount: number,
  reason: RefundReason | null = null,
  notes: string | null = null,
  items?: RefundItemInput[]
): Promise<{ refund: Refund | null; error: string | null }> {
  try {
    const { userId } = await requireAdmin();

    // Get transaction details
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      return { refund: null, error: 'Transaction not found' };
    }

    // Validate refund amount
    const alreadyRefunded = await getTotalRefundedAmount(transactionId);
    const availableToRefund = Number(transaction.amount) - alreadyRefunded;

    if (amount > availableToRefund) {
      return {
        refund: null,
        error: `Maximum refundable amount is $${availableToRefund.toFixed(2)}`,
      };
    }

    if (amount <= 0) {
      return { refund: null, error: 'Refund amount must be greater than 0' };
    }

    let stripeRefundId: string | null = null;

    // Process Stripe refund if it was a card payment
    if (transaction.stripe_payment_intent_id) {
      try {
        const refundParams: Stripe.RefundCreateParams = {
          payment_intent: transaction.stripe_payment_intent_id,
          amount: formatAmountForStripe(amount),
          reason: mapToStripeReason(reason),
          metadata: {
            transaction_id: transactionId,
            refunded_by: userId,
            internal_reason: reason || '',
            notes: notes || '',
          },
        };

        const stripeRefund = await stripe.refunds.create(refundParams);
        stripeRefundId = stripeRefund.id;
      } catch (error) {
        const stripeError = error as Stripe.errors.StripeError;
        console.error('Stripe refund error:', stripeError);
        return {
          refund: null,
          error: stripeError.message || 'Failed to process refund',
        };
      }
    }

    // Create refund record (reason is now nullable)
    const { data: refund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .insert({
        transaction_id: transactionId,
        stripe_refund_id: stripeRefundId,
        amount,
        reason,
        notes,
        status: 'succeeded',
        refunded_by: userId,
      })
      .select()
      .single();

    if (refundError) {
      console.error('Error creating refund record:', refundError);
      return { refund: null, error: 'Refund processed but failed to record' };
    }

    // Create refund items if provided
    if (items && items.length > 0) {
      const refundItems = items.map((item) => ({
        refund_id: refund.id,
        transaction_item_id: item.transactionItemId,
        amount: item.amount,
        quantity: item.quantity,
      }));

      await supabaseAdmin.from('refund_items').insert(refundItems);

      // Update transaction items refund status
      for (const item of items) {
        const { data: txItem } = await supabaseAdmin
          .from('transaction_items')
          .select('total_price, refunded_amount')
          .eq('id', item.transactionItemId)
          .single();

        if (txItem) {
          const newRefundedAmount =
            (Number(txItem.refunded_amount) || 0) + item.amount;
          const refundStatus =
            newRefundedAmount >= Number(txItem.total_price)
              ? 'full'
              : 'partial';

          await supabaseAdmin
            .from('transaction_items')
            .update({
              refunded_amount: newRefundedAmount,
              refund_status: refundStatus,
            })
            .eq('id', item.transactionItemId);
        }
      }
    }

    // Update transaction status
    const newTotalRefunded = alreadyRefunded + amount;
    const newStatus =
      newTotalRefunded >= Number(transaction.amount)
        ? 'refunded'
        : 'partially_refunded';

    await supabaseAdmin
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', transactionId);

    return { refund, error: null };
  } catch (error) {
    console.error('Error processing refund:', error);
    return { refund: null, error: 'Failed to process refund' };
  }
}

/**
 * Get total refunded amount for a transaction
 */
async function getTotalRefundedAmount(transactionId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('refunds')
    .select('amount')
    .eq('transaction_id', transactionId)
    .eq('status', 'succeeded');

  return data?.reduce((sum, r) => sum + Number(r.amount), 0) || 0;
}

/**
 * Get refund details
 */
export async function getRefund(
  refundId: string
): Promise<{ refund: Refund | null; error: string | null }> {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from('refunds')
      .select('*')
      .eq('id', refundId)
      .single();

    if (error) {
      return { refund: null, error: 'Refund not found' };
    }

    return { refund: data, error: null };
  } catch (error) {
    console.error('Error fetching refund:', error);
    return { refund: null, error: 'Failed to fetch refund' };
  }
}

/**
 * Get all refunds for a transaction
 */
export async function getTransactionRefunds(
  transactionId: string
): Promise<{ refunds: Refund[]; error: string | null }> {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from('refunds')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false });

    if (error) {
      return { refunds: [], error: 'Failed to fetch refunds' };
    }

    return { refunds: data || [], error: null };
  } catch (error) {
    console.error('Error fetching refunds:', error);
    return { refunds: [], error: 'Failed to fetch refunds' };
  }
}

/**
 * Get all refunds for a booking group
 */
export async function getBookingRefunds(
  bookingGroupId: string
): Promise<{ refunds: Refund[]; error: string | null }> {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from('refunds')
      .select(
        `
        *,
        transactions!inner(booking_group_id)
      `
      )
      .eq('transactions.booking_group_id', bookingGroupId)
      .order('created_at', { ascending: false });

    if (error) {
      return { refunds: [], error: 'Failed to fetch refunds' };
    }

    return { refunds: data || [], error: null };
  } catch (error) {
    console.error('Error fetching booking refunds:', error);
    return { refunds: [], error: 'Failed to fetch refunds' };
  }
}

/**
 * Get refund items for a refund
 */
export async function getRefundItems(refundId: string): Promise<{
  items: Array<{
    id: string;
    refund_id: string;
    transaction_item_id: string;
    amount: number;
    quantity: number;
    created_at: string;
  }>;
  error: string | null;
}> {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from('refund_items')
      .select('*')
      .eq('refund_id', refundId);

    if (error) {
      return { items: [], error: 'Failed to fetch refund items' };
    }

    return { items: data || [], error: null };
  } catch (error) {
    console.error('Error fetching refund items:', error);
    return { items: [], error: 'Failed to fetch refund items' };
  }
}
