'use server';

import { stripe } from '@/lib/stripe/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import type { StripeCustomer } from '@/types/payments';

/**
 * Get or create a Stripe customer for a client
 */
export async function getOrCreateStripeCustomer(
  clientId: string
): Promise<{ customerId: string; error: string | null }> {
  try {
    await requireStaff();

    // Check if customer already exists
    const { data: existing } = await supabaseAdmin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('client_id', clientId)
      .single();

    if (existing) {
      return { customerId: existing.stripe_customer_id, error: null };
    }

    // Get client details
    const { data: client, error: clientError } = await supabaseAdmin
      .from('users')
      .select('id, email, first_name, last_name, phone_number')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return { customerId: '', error: 'Client not found' };
    }

    // Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      email: client.email || undefined,
      name: `${client.first_name} ${client.last_name}`.trim() || undefined,
      phone: client.phone_number || undefined,
      metadata: {
        client_id: clientId,
      },
    });

    // Save to database
    const { error: insertError } = await supabaseAdmin
      .from('stripe_customers')
      .insert({
        client_id: clientId,
        stripe_customer_id: stripeCustomer.id,
      });

    if (insertError) {
      // Clean up Stripe customer if DB insert fails
      await stripe.customers.del(stripeCustomer.id);
      return { customerId: '', error: 'Failed to save customer' };
    }

    return { customerId: stripeCustomer.id, error: null };
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    return { customerId: '', error: 'Failed to create customer' };
  }
}

/**
 * Get Stripe customer ID for a client
 */
export async function getStripeCustomerId(
  clientId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('client_id', clientId)
    .single();

  return data?.stripe_customer_id || null;
}

/**
 * Get Stripe customer record for a client
 */
export async function getStripeCustomer(
  clientId: string
): Promise<{ customer: StripeCustomer | null; error: string | null }> {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('stripe_customers')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (error) {
      return { customer: null, error: 'Customer not found' };
    }

    return { customer: data, error: null };
  } catch (error) {
    console.error('Error fetching Stripe customer:', error);
    return { customer: null, error: 'Failed to fetch customer' };
  }
}

/**
 * Delete Stripe customer (when client is deleted)
 */
export async function deleteStripeCustomer(
  clientId: string
): Promise<{ error: string | null }> {
  try {
    await requireStaff();

    const { data: customer } = await supabaseAdmin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('client_id', clientId)
      .single();

    if (customer) {
      // Delete from Stripe
      await stripe.customers.del(customer.stripe_customer_id);

      // Delete from database (CASCADE will handle this, but being explicit)
      await supabaseAdmin
        .from('stripe_customers')
        .delete()
        .eq('client_id', clientId);
    }

    return { error: null };
  } catch (error) {
    console.error('Error deleting Stripe customer:', error);
    return { error: 'Failed to delete customer' };
  }
}

/**
 * Sync Stripe customer data (update email, name, phone)
 */
export async function syncStripeCustomer(
  clientId: string
): Promise<{ error: string | null }> {
  try {
    await requireStaff();

    // Get Stripe customer ID
    const stripeCustomerId = await getStripeCustomerId(clientId);
    if (!stripeCustomerId) {
      return { error: 'No Stripe customer found' };
    }

    // Get latest client details
    const { data: client, error: clientError } = await supabaseAdmin
      .from('users')
      .select('email, first_name, last_name, phone_number')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return { error: 'Client not found' };
    }

    // Update Stripe customer
    await stripe.customers.update(stripeCustomerId, {
      email: client.email || undefined,
      name: `${client.first_name} ${client.last_name}`.trim() || undefined,
      phone: client.phone_number || undefined,
    });

    return { error: null };
  } catch (error) {
    console.error('Error syncing Stripe customer:', error);
    return { error: 'Failed to sync customer' };
  }
}
