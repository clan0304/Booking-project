// app/api/public/team/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Public API endpoint for team members
 * Only exposes: id, first_name, photo_url
 * Private data (email, phone, last_name) is NOT included
 */
export async function GET() {
  try {
    // Fetch active team members with LIMITED fields
    const { data: teamMembers, error } = await supabaseAdmin
      .from('users')
      .select(
        `
        id,
        first_name,
        photo_url,
        team_members!inner(
          is_active
        )
      `
      )
      .eq('team_members.is_active', true)
      .contains('roles', ['team_member'])
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching team members:', error);
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      );
    }

    // Extra safety: Map to ensure ONLY public fields are returned
    const publicTeamMembers = teamMembers?.map((member) => ({
      id: member.id,
      first_name: member.first_name,
      photo_url: member.photo_url,
    }));

    return NextResponse.json(
      {
        success: true,
        data: publicTeamMembers || [],
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Error in public team API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
