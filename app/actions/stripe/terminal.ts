// app/actions/stripe/terminal.ts
'use server';

import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

// =====================================================
// LOCATION MANAGEMENT
// =====================================================

/**
 * Create a Stripe Terminal Location for a venue
 */
export async function createTerminalLocation(
  venueId: string,
  displayName: string,
  address: {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  }
) {
  try {
    await requireStaff();

    // Create location in Stripe
    const location = await stripe.terminal.locations.create({
      display_name: displayName,
      address: {
        line1: address.line1,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country,
      },
    });

    // Store in venues table (you may need to add this column)
    const { error } = await supabaseAdmin
      .from('venues')
      .update({ stripe_location_id: location.id })
      .eq('id', venueId);

    if (error) {
      console.error('Failed to save location to venue:', error);
    }

    return { locationId: location.id, error: null };
  } catch (error) {
    console.error('Error creating terminal location:', error);
    return { locationId: null, error: 'Failed to create location' };
  }
}

/**
 * Get Stripe Location ID for a venue
 */
export async function getVenueLocationId(venueId: string) {
  try {
    const { data: venue } = await supabaseAdmin
      .from('venues')
      .select('stripe_location_id')
      .eq('id', venueId)
      .single();

    return { locationId: venue?.stripe_location_id || null, error: null };
  } catch (error) {
    return { locationId: null, error: `${error} Failed to get location` };
  }
}

// =====================================================
// READER MANAGEMENT
// =====================================================

/**
 * Register a reader to a location
 */
export async function registerReader(
  venueId: string,
  registrationCode: string,
  label: string
) {
  try {
    await requireStaff();

    // Get venue's Stripe location
    const { data: venue } = await supabaseAdmin
      .from('venues')
      .select('stripe_location_id')
      .eq('id', venueId)
      .single();

    if (!venue?.stripe_location_id) {
      return {
        success: false,
        readerId: null,
        error: 'Venue has no Stripe location. Create one first.',
      };
    }

    // Register reader in Stripe
    const reader = await stripe.terminal.readers.create({
      registration_code: registrationCode,
      label: label,
      location: venue.stripe_location_id,
    });

    // Save to our database
    const { error: dbError } = await supabaseAdmin
      .from('stripe_terminals')
      .insert({
        venue_id: venueId,
        stripe_terminal_id: reader.id,
        stripe_location_id: venue.stripe_location_id,
        label: label,
        device_type: reader.device_type,
        serial_number: reader.serial_number || null,
        status: reader.status === 'online' ? 'online' : 'offline',
        is_active: true,
      });

    if (dbError) {
      console.error('Failed to save reader to database:', dbError);
    }

    // Return only plain data (no Stripe objects with methods)
    return {
      success: true,
      readerId: reader.id,
      deviceType: reader.device_type,
      label: reader.label,
      status: reader.status,
      error: null,
    };
  } catch (error: unknown) {
    console.error('Error registering reader:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to register reader';
    return { success: false, readerId: null, error: message };
  }
}

/**
 * Get all terminals for a venue from database
 */
export async function getVenueTerminals(venueId: string) {
  try {
    await requireStaff();

    const { data: terminals, error } = await supabaseAdmin
      .from('stripe_terminals')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true);

    if (error) {
      return { terminals: [], error: 'Failed to fetch terminals' };
    }

    return { terminals: terminals || [], error: null };
  } catch (error) {
    return { terminals: [], error: `${error} Failed to fetch terminals` };
  }
}

/**
 * Get reader status from Stripe (live status check)
 */
export async function getReaderStatus(stripeTerminalId: string) {
  try {
    await requireStaff();

    const reader = await stripe.terminal.readers.retrieve(stripeTerminalId);

    // Check if reader is deleted
    if ('deleted' in reader && reader.deleted) {
      return {
        status: 'offline',
        deviceType: null,
        label: null,
        error: 'Reader has been deleted',
      };
    }

    // Type assertion - we've confirmed it's not deleted
    const activeReader = reader as Stripe.Terminal.Reader;

    // Update our database with current status
    await supabaseAdmin
      .from('stripe_terminals')
      .update({
        status: activeReader.status === 'online' ? 'online' : 'offline',
        last_seen_at: new Date().toISOString(),
      })
      .eq('stripe_terminal_id', stripeTerminalId);

    return {
      status: activeReader.status,
      deviceType: activeReader.device_type,
      label: activeReader.label,
      error: null,
    };
  } catch (error) {
    return {
      status: 'offline',
      deviceType: null,
      label: null,
      error: `${error} Failed to get reader status`,
    };
  }
}

/**
 * List all readers from Stripe for a location
 */
export async function listStripeReaders(locationId: string) {
  try {
    await requireStaff();

    const readers = await stripe.terminal.readers.list({
      location: locationId,
      limit: 100,
    });

    // Return only plain data (no Stripe objects with methods)
    const plainReaders = readers.data.map((reader) => ({
      id: reader.id,
      label: reader.label,
      deviceType: reader.device_type,
      status: reader.status,
      serialNumber: reader.serial_number,
      location: reader.location,
    }));

    return { readers: plainReaders, error: null };
  } catch (error) {
    return { readers: [], error: `${error} Failed to list readers` };
  }
}

// =====================================================
// PAYMENT PROCESSING
// =====================================================

/**
 * Create a PaymentIntent for terminal payment
 */
export async function createTerminalPaymentIntent(
  amount: number,
  bookingGroupId: string,
  venueId: string,
  description?: string
) {
  try {
    await requireStaff();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'aud',
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      description: description || 'Service payment',
      metadata: {
        booking_group_id: bookingGroupId,
        venue_id: venueId,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      error: null,
    };
  } catch (error) {
    console.error('Error creating terminal payment intent:', error);
    return {
      clientSecret: null,
      paymentIntentId: null,
      error: 'Failed to create payment',
    };
  }
}

/**
 * Process payment on terminal reader (send to device)
 */
export async function processTerminalPayment(
  stripeTerminalId: string,
  paymentIntentId: string
) {
  try {
    await requireStaff();

    // Send payment to the physical reader
    const reader = await stripe.terminal.readers.processPaymentIntent(
      stripeTerminalId,
      {
        payment_intent: paymentIntentId,
      }
    );

    // Return only plain data (no Stripe objects with methods)
    return {
      success: true,
      actionStatus: reader.action?.status || null,
      readerId: reader.id,
      readerStatus: reader.status,
      error: null,
    };
  } catch (error: unknown) {
    console.error('Terminal payment error:', error);
    const message =
      error instanceof Error ? error.message : 'Terminal payment failed';
    return {
      success: false,
      actionStatus: 'failed',
      readerId: null,
      readerStatus: null,
      error: message,
    };
  }
}

/**
 * Check the status of a reader's current action
 */
export async function getReaderAction(stripeTerminalId: string) {
  try {
    await requireStaff();

    const reader = await stripe.terminal.readers.retrieve(stripeTerminalId);

    // Check if reader is deleted
    if ('deleted' in reader && reader.deleted) {
      return {
        status: null,
        failureCode: null,
        failureMessage: null,
        error: 'Reader has been deleted',
      };
    }

    // Type assertion - we've confirmed it's not deleted
    const activeReader = reader as Stripe.Terminal.Reader;
    const action = activeReader.action;

    // Return only plain data (no Stripe objects with methods)
    return {
      status: action?.status || null,
      failureCode: action?.failure_code || null,
      failureMessage: action?.failure_message || null,
      error: null,
    };
  } catch (error) {
    return {
      status: null,
      failureCode: null,
      failureMessage: null,
      error: `${error} Failed to get reader action`,
    };
  }
}

/**
 * Cancel the current action on a reader
 */
export async function cancelReaderAction(stripeTerminalId: string) {
  try {
    await requireStaff();

    await stripe.terminal.readers.cancelAction(stripeTerminalId);

    return { error: null };
  } catch (error: unknown) {
    console.error('Error canceling reader action:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel';
    return { error: message };
  }
}

/**
 * Cancel a PaymentIntent by ID (used when user cancels terminal payment)
 */
export async function cancelPaymentIntent(paymentIntentId: string) {
  try {
    await requireStaff();

    await stripe.paymentIntents.cancel(paymentIntentId);

    return { error: null };
  } catch (error: unknown) {
    console.error('Error canceling payment intent:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to cancel payment';
    return { error: message };
  }
}

/**
 * Simulate a terminal payment (for testing with simulated readers)
 */
export async function simulateTerminalPayment(stripeTerminalId: string) {
  try {
    await requireStaff();

    // This only works with simulated readers in test mode
    // It simulates a card being presented to the reader
    const reader =
      await stripe.testHelpers.terminal.readers.presentPaymentMethod(
        stripeTerminalId
      );

    // Return only plain data (no Stripe objects with methods)
    return {
      success: true,
      readerId: reader.id,
      actionStatus: reader.action?.status || null,
      error: null,
    };
  } catch (error: unknown) {
    console.error('Error simulating payment:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to simulate payment';
    return {
      success: false,
      readerId: null,
      actionStatus: null,
      error: message,
    };
  }
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface TerminalInfo {
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
