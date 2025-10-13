// app/api/admin/team/all-members/route.ts
import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Get all team members (admin/staff only)
 * Returns all users with team_member role
 */
export async function GET() {
  try {
    // Verify admin or staff access
    await requireStaff();

    // Fetch all users with team_member role
    const { data: teamMembers, error } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, photo_url')
      .contains('roles', ['team_member'])
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching all team members:', error);
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      members: teamMembers || [],
    });
  } catch (error) {
    console.error('Error in all-members API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
