import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { savePaymentMethod } from '@/app/actions/stripe/setup-intents';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      const webhookError =
        error as Stripe.errors.StripeSignatureVerificationError;
      console.error(
        'Webhook signature verification failed:',
        webhookError.message
      );
      return NextResponse.json(
        { error: `Webhook Error: ${webhookError.message}` },
        { status: 400 }
      );
    }

    // Check if we've already processed this event (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Process the event
    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(
          event.data.object as Stripe.SetupIntent
        );
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'terminal.reader.action_succeeded':
        await handleTerminalActionSucceeded(
          event.data.object as Stripe.Terminal.Reader
        );
        break;

      case 'terminal.reader.action_failed':
        await handleTerminalActionFailed(
          event.data.object as Stripe.Terminal.Reader
        );
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Record processed event
    await supabaseAdmin.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data.object as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// =============================================
// Event Handlers
// =============================================

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  console.log(`PaymentIntent succeeded: ${paymentIntent.id}`);

  // Update transaction status if it exists
  const { error } = await supabaseAdmin
    .from('transactions')
    .update({
      status: 'succeeded',
      stripe_charge_id:
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id ?? null,
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (error) {
    console.error('Error updating transaction:', error);
  }
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  console.log(`PaymentIntent failed: ${paymentIntent.id}`);

  const failureMessage =
    paymentIntent.last_payment_error?.message || 'Payment failed';

  await supabaseAdmin
    .from('transactions')
    .update({
      status: 'failed',
      failure_reason: failureMessage,
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);
}

async function handleSetupIntentSucceeded(
  setupIntent: Stripe.SetupIntent
): Promise<void> {
  console.log(`SetupIntent succeeded: ${setupIntent.id}`);

  const clientId = setupIntent.metadata?.client_id;

  // payment_method can be string or PaymentMethod object
  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;

  // customer can be string or Customer object
  const stripeCustomerId =
    typeof setupIntent.customer === 'string'
      ? setupIntent.customer
      : setupIntent.customer?.id;

  if (!clientId || !paymentMethodId || !stripeCustomerId) {
    console.error('Missing required data for saving payment method:', {
      clientId,
      paymentMethodId,
      stripeCustomerId,
    });
    return;
  }

  // Save payment method with all required fields
  const { error } = await savePaymentMethod(
    clientId,
    paymentMethodId,
    stripeCustomerId
  );

  if (error) {
    console.error('Failed to save payment method from webhook:', error);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  console.log(`Charge refunded: ${charge.id}`);

  // This is handled by our refund action, but we can sync status here
  if (charge.payment_intent) {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent.id;

    const status =
      charge.amount_refunded >= charge.amount
        ? 'refunded'
        : 'partially_refunded';

    await supabaseAdmin
      .from('transactions')
      .update({ status })
      .eq('stripe_payment_intent_id', paymentIntentId);
  }
}

async function handleTerminalActionSucceeded(
  reader: Stripe.Terminal.Reader
): Promise<void> {
  console.log(`Terminal action succeeded for reader: ${reader.id}`);

  // Update terminal status
  await supabaseAdmin
    .from('stripe_terminals')
    .update({
      status: 'online',
      last_seen_at: new Date().toISOString(),
    })
    .eq('stripe_terminal_id', reader.id);

  // Terminal payment success is typically handled by polling in the UI
  // This webhook provides a backup confirmation
}

async function handleTerminalActionFailed(
  reader: Stripe.Terminal.Reader
): Promise<void> {
  console.log(`Terminal action failed for reader: ${reader.id}`);

  // Log terminal failures for debugging
  // You could also update terminal status or create an alert
  await supabaseAdmin
    .from('stripe_terminals')
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq('stripe_terminal_id', reader.id);
}
