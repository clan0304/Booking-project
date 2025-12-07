'use server';

import { stripe } from '@/lib/stripe/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { getOrCreateStripeCustomer } from './customers';
import type {
  CreateSetupIntentResponse,
  PaymentMethod,
} from '@/types/payments';

/**
 * Create a SetupIntent to save a card without charging
 * Used for: booking card collection, adding new payment method
 */
export async function createSetupIntent(
  clientId: string
): Promise<{ data: CreateSetupIntentResponse | null; error: string | null }> {
  try {
    // Get or create Stripe customer
    const { customerId, error: customerError } =
      await getOrCreateStripeCustomer(clientId);

    if (customerError || !customerId) {
      return { data: null, error: customerError || 'Failed to get customer' };
    }

    // Create SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session', // Allow charging later without customer present
      metadata: {
        client_id: clientId,
        stripe_customer_id: customerId, // Pass this for webhook handler
      },
    });

    if (!setupIntent.client_secret) {
      return { data: null, error: 'Failed to create setup intent' };
    }

    return {
      data: {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error creating SetupIntent:', error);
    return { data: null, error: 'Failed to create setup intent' };
  }
}

/**
 * Save payment method after successful SetupIntent
 * Called from webhook or after confirmation
 *
 * IMPORTANT: Requires stripeCustomerId to ensure integrity
 */
export async function savePaymentMethod(
  clientId: string,
  stripePaymentMethodId: string,
  stripeCustomerId: string
): Promise<{ paymentMethod: PaymentMethod | null; error: string | null }> {
  try {
    // Retrieve payment method details from Stripe
    const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

    if (!pm.card) {
      return { paymentMethod: null, error: 'Invalid payment method' };
    }

    // Verify the payment method belongs to the correct customer
    if (pm.customer !== stripeCustomerId) {
      console.error('Payment method customer mismatch:', {
        expected: stripeCustomerId,
        actual: pm.customer,
      });
      return { paymentMethod: null, error: 'Payment method customer mismatch' };
    }

    // Check if this payment method already exists
    const { data: existing } = await supabaseAdmin
      .from('payment_methods')
      .select('id')
      .eq('stripe_payment_method_id', stripePaymentMethodId)
      .single();

    if (existing) {
      // Already saved, fetch and return
      const { data } = await supabaseAdmin
        .from('payment_methods')
        .select('*')
        .eq('id', existing.id)
        .single();

      return { paymentMethod: data, error: null };
    }

    // Check if client has any existing payment methods
    const { count } = await supabaseAdmin
      .from('payment_methods')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_active', true);

    const isFirstCard = (count || 0) === 0;

    // Save to database (includes stripe_customer_id for FK constraint)
    const { data: paymentMethod, error: insertError } = await supabaseAdmin
      .from('payment_methods')
      .insert({
        client_id: clientId,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: stripePaymentMethodId,
        card_brand: pm.card.brand,
        card_last4: pm.card.last4,
        card_exp_month: pm.card.exp_month,
        card_exp_year: pm.card.exp_year,
        is_default: isFirstCard, // First card is default
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving payment method:', insertError);
      return { paymentMethod: null, error: 'Failed to save payment method' };
    }

    return { paymentMethod, error: null };
  } catch (error) {
    console.error('Error saving payment method:', error);
    return { paymentMethod: null, error: 'Failed to save payment method' };
  }
}

/**
 * Get all saved payment methods for a client
 */
export async function getClientPaymentMethods(
  clientId: string
): Promise<{ paymentMethods: PaymentMethod[]; error: string | null }> {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { paymentMethods: [], error: 'Failed to fetch payment methods' };
    }

    return { paymentMethods: data || [], error: null };
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return { paymentMethods: [], error: 'Failed to fetch payment methods' };
  }
}

/**
 * Set a payment method as default
 */
export async function setDefaultPaymentMethod(
  clientId: string,
  paymentMethodId: string
): Promise<{ error: string | null }> {
  try {
    await requireStaff();

    // Remove default from all other methods
    await supabaseAdmin
      .from('payment_methods')
      .update({ is_default: false })
      .eq('client_id', clientId);

    // Set new default
    const { error } = await supabaseAdmin
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', paymentMethodId)
      .eq('client_id', clientId);

    if (error) {
      return { error: 'Failed to update default payment method' };
    }

    return { error: null };
  } catch (error) {
    console.error('Error setting default payment method:', error);
    return { error: 'Failed to set default payment method' };
  }
}

/**
 * Remove a saved payment method
 */
export async function removePaymentMethod(
  paymentMethodId: string
): Promise<{ error: string | null }> {
  try {
    await requireStaff();

    // Get the payment method
    const { data: pm } = await supabaseAdmin
      .from('payment_methods')
      .select('stripe_payment_method_id, client_id, is_default')
      .eq('id', paymentMethodId)
      .single();

    if (!pm) {
      return { error: 'Payment method not found' };
    }

    // Detach from Stripe
    try {
      await stripe.paymentMethods.detach(pm.stripe_payment_method_id);
    } catch (stripeError) {
      // Payment method may already be detached, continue with DB cleanup
      console.warn('Stripe detach warning:', stripeError);
    }

    // Soft delete in database
    await supabaseAdmin
      .from('payment_methods')
      .update({ is_active: false, is_default: false })
      .eq('id', paymentMethodId);

    // If this was default, set another as default
    if (pm.is_default) {
      const { data: nextDefault } = await supabaseAdmin
        .from('payment_methods')
        .select('id')
        .eq('client_id', pm.client_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (nextDefault) {
        await supabaseAdmin
          .from('payment_methods')
          .update({ is_default: true })
          .eq('id', nextDefault.id);
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Error removing payment method:', error);
    return { error: 'Failed to remove payment method' };
  }
}

/**
 * Check if a client has a saved payment method
 */
export async function clientHasPaymentMethod(
  clientId: string
): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('payment_methods')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('is_active', true);

  return (count || 0) > 0;
}

/**
 * Get default payment method for a client
 */
export async function getDefaultPaymentMethod(
  clientId: string
): Promise<{ paymentMethod: PaymentMethod | null; error: string | null }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (error) {
      // No default found, try to get any active payment method
      const { data: anyMethod } = await supabaseAdmin
        .from('payment_methods')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return { paymentMethod: anyMethod || null, error: null };
    }

    return { paymentMethod: data, error: null };
  } catch (error) {
    console.error('Error fetching default payment method:', error);
    return { paymentMethod: null, error: 'Failed to fetch payment method' };
  }
}
