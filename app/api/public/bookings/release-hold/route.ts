// app/api/public/bookings/release-hold/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST handler for releasing holds (called via sendBeacon on page close)
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token required' },
        { status: 400 }
      );
    }

    // Get authenticated user (may not be present if called via sendBeacon)
    const { userId } = await auth();

    if (userId) {
      // Get user's internal ID
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('clerk_id', userId)
        .single();

      if (user) {
        // Delete holds for this session token and user
        await supabaseAdmin
          .from('booking_holds')
          .delete()
          .eq('session_token', sessionToken)
          .eq('user_id', user.id);
      }
    } else {
      // If no auth, just delete by session token
      // This is less secure but necessary for sendBeacon which may not include auth
      await supabaseAdmin
        .from('booking_holds')
        .delete()
        .eq('session_token', sessionToken);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error releasing hold:', error);
    return NextResponse.json(
      { error: 'Failed to release hold' },
      { status: 500 }
    );
  }
}
