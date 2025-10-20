// lib/supabase/jwt-client.ts
// Supabase client with Clerk JWT integration for RLS

import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

/**
 * Creates a Supabase client with Clerk JWT authentication
 * This client respects RLS policies based on the authenticated user
 * Use this ONLY for products feature server actions
 *
 * Token Configuration:
 * - Lifetime: 4 hours (14400 seconds) - configured in Clerk Dashboard
 * - Auto-refresh: Handled automatically by Clerk on server-side
 * - Caching: Tokens are cached and only refreshed when expired
 */
export async function createSupabaseJWTClient() {
  const { getToken } = await auth();

  // Get JWT token from Clerk with the 'supabase' template
  // Note: Server-side getToken() only accepts 'template' option
  // Token refresh is handled automatically by Clerk
  const token = await getToken({ template: 'supabase' });

  if (!token) {
    throw new Error('No authentication token available');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}
