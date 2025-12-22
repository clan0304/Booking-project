// app/api/cron/cleanup-booking-holds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This endpoint should be called by a cron job every minute
// Vercel Cron: Add to vercel.json
// {
//   "crons": [{
//     "path": "/api/cron/cleanup-booking-holds",
//     "schedule": "* * * * *"
//   }]
// }

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete expired holds
    const { data: deletedCount, error } = await supabaseAdmin.rpc(
      'cleanup_expired_booking_holds'
    );

    if (error) {
      console.error('Error cleaning up expired holds:', error);
      return NextResponse.json(
        { error: 'Failed to cleanup holds' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in cleanup-booking-holds cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
