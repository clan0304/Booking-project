// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SECRET');
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Webhook verification failed', { status: 400 });
  }

  // Handle the event
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    const email = email_addresses[0]?.email_address;

    if (!email) {
      return new Response('No email found', { status: 400 });
    }

    // Check if user already exists (account claiming scenario)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      // Update existing user with Clerk ID (account claiming)
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          clerk_user_id: id,
          is_registered: true,
          first_name: first_name || existingUser.first_name,
          last_name: last_name || existingUser.last_name,
          photo_url: image_url || existingUser.photo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      if (error) {
        console.error('Error updating user in Supabase:', error);
        return new Response('Error updating user', { status: 500 });
      }

      console.log(`✅ User ${existingUser.id} claimed existing account`);
    } else {
      // Insert new user into Supabase using admin client
      const { error } = await supabaseAdmin.from('users').insert({
        clerk_user_id: id,
        email: email,
        first_name: first_name || null,
        last_name: last_name || null,
        photo_url: image_url || null,
        roles: ['client'],
        is_registered: true,
        onboarding_completed: false,
      });

      if (error) {
        console.error('Error creating user in Supabase:', error);
        return new Response('Error creating user', { status: 500 });
      }

      console.log(`✅ User ${id} created successfully`);
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        email: email_addresses[0].email_address,
        first_name: first_name || null,
        last_name: last_name || null,
        photo_url: image_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', id);

    if (error) {
      console.error('Error updating user in Supabase:', error);
      return new Response('Error updating user', { status: 500 });
    }

    console.log(`✅ User ${id} updated successfully`);
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    // Soft delete: remove clerk_user_id and mark as not registered
    // This preserves booking history and notes
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        clerk_user_id: null,
        is_registered: false,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', id);

    if (error) {
      console.error('Error soft deleting user from Supabase:', error);
      return new Response('Error deleting user', { status: 500 });
    }

    console.log(`✅ User ${id} soft deleted successfully`);
  }

  return new Response('Webhook processed', { status: 200 });
}
