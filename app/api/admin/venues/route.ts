// app/api/admin/venues/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

/**
 * Get all active venues for admin filters
 * Returns id, name, address for venue selection dropdowns
 */
export async function GET() {
  try {
    await requireStaff();

    const { data: venues, error } = await supabaseAdmin
      .from('venues')
      .select('id, name, address')
      .eq('is_listed', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching venues:', error);
      return NextResponse.json(
        { error: 'Failed to fetch venues' },
        { status: 500 }
      );
    }

    return NextResponse.json(venues || []);
  } catch (error) {
    console.error('Error in venues API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
