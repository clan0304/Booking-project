// app/actions/team-venue-assignments.ts
'use server';

import { requireStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Get all team members assigned to a specific venue
 */
export async function getTeamMembersByVenue(venueId: string) {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('team_member_venues')
      .select(
        `
        id,
        is_active,
        users!team_member_venues_team_member_id_fkey (
          id,
          first_name,
          last_name,
          email,
          photo_url
        )
      `
      )
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('users(first_name)', { ascending: true });

    if (error) {
      console.error('Error fetching team members by venue:', error);
      return { success: false, error: 'Failed to fetch team members' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in getTeamMembersByVenue:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get all team members NOT assigned to a specific venue
 */
export async function getUnassignedTeamMembers(venueId: string) {
  try {
    await requireStaff();

    // Get all users with team_member role
    const { data: allTeamMembers, error: allError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, photo_url')
      .contains('roles', ['team_member'])
      .order('first_name', { ascending: true });

    if (allError) {
      console.error('Error fetching all team members:', allError);
      return { success: false, error: 'Failed to fetch team members' };
    }

    // Get currently assigned team members
    const { data: assigned, error: assignedError } = await supabaseAdmin
      .from('team_member_venues')
      .select('team_member_id')
      .eq('venue_id', venueId)
      .eq('is_active', true);

    if (assignedError) {
      console.error('Error fetching assigned team members:', assignedError);
      return { success: false, error: 'Failed to fetch assigned members' };
    }

    // Filter out assigned members
    const assignedIds = new Set(assigned?.map((a) => a.team_member_id) || []);
    const unassigned = allTeamMembers?.filter(
      (member) => !assignedIds.has(member.id)
    );

    return { success: true, data: unassigned || [] };
  } catch (error) {
    console.error('Error in getUnassignedTeamMembers:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Bulk assign team members to a venue
 */
export async function bulkAssignTeamMembers(
  teamMemberIds: string[],
  venueId: string
) {
  try {
    if (!teamMemberIds.length) {
      return { success: false, error: 'No team members provided' };
    }

    // Check for existing assignments
    const { data: existing } = await supabaseAdmin
      .from('team_member_venues')
      .select('team_member_id, is_active')
      .eq('venue_id', venueId)
      .in('team_member_id', teamMemberIds);

    const existingMap = new Map(
      existing?.map((e) => [e.team_member_id, e.is_active]) || []
    );

    const toInsert: Array<{
      team_member_id: string;
      venue_id: string;
      is_active: boolean;
    }> = [];
    const toReactivate: string[] = [];

    teamMemberIds.forEach((memberId) => {
      const existingStatus = existingMap.get(memberId);
      if (existingStatus === undefined) {
        // New assignment
        toInsert.push({
          team_member_id: memberId,
          venue_id: venueId,
          is_active: true,
        });
      } else if (existingStatus === false) {
        // Reactivate existing but inactive assignment
        toReactivate.push(memberId);
      }
      // If existingStatus === true, already assigned and active, skip
    });

    // Insert new assignments
    if (toInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('team_member_venues')
        .insert(toInsert);

      if (insertError) {
        console.error('Error inserting team member assignments:', insertError);
        return { success: false, error: 'Failed to assign team members' };
      }
    }

    // Reactivate existing assignments
    if (toReactivate.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('team_member_venues')
        .update({ is_active: true })
        .eq('venue_id', venueId)
        .in('team_member_id', toReactivate);

      if (updateError) {
        console.error('Error reactivating team members:', updateError);
        return { success: false, error: 'Failed to reactivate team members' };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error in bulkAssignTeamMembers:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Bulk unassign team members from a venue
 * Sets is_active to false instead of deleting records
 */
export async function bulkUnassignTeamMembers(
  teamMemberIds: string[],
  venueId: string
) {
  try {
    await requireStaff();

    if (!teamMemberIds.length) {
      return { success: false, error: 'No team members provided' };
    }

    console.log('Unassigning team members:', {
      teamMemberIds,
      venueId,
      count: teamMemberIds.length,
    });

    // Set is_active to false for these assignments
    const { data, error } = await supabaseAdmin
      .from('team_member_venues')
      .update({ is_active: false })
      .eq('venue_id', venueId)
      .in('team_member_id', teamMemberIds)
      .select();

    if (error) {
      console.error('Error unassigning team members:', error);
      return { success: false, error: 'Failed to unassign team members' };
    }

    console.log('Successfully unassigned:', data?.length || 0, 'members');

    return { success: true, data };
  } catch (error) {
    console.error('Error in bulkUnassignTeamMembers:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Check if a team member is assigned to a venue
 */
export async function isTeamMemberAssignedToVenue(
  teamMemberId: string,
  venueId: string
) {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('team_member_venues')
      .select('id')
      .eq('team_member_id', teamMemberId)
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected
      console.error('Error checking team member assignment:', error);
      return { success: false, error: 'Failed to check assignment' };
    }

    return { success: true, isAssigned: !!data };
  } catch (error) {
    console.error('Error in isTeamMemberAssignedToVenue:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
