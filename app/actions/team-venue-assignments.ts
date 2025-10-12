// app/actions/team-venue-assignments.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Get all team members assigned to a venue
 */
export async function getTeamMembersByVenue(venueId: string) {
  try {
    await requireAdmin();

    const { data: assignments, error } = await supabaseAdmin
      .from('team_member_venues')
      .select(
        `
        id,
        is_active,
        users!inner (
          id,
          first_name,
          last_name,
          photo_url,
          email,
          team_members (
            position,
            is_active
          )
        )
      `
      )
      .eq('venue_id', venueId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching team members:', error);
      return { success: false, error: 'Failed to fetch team members' };
    }

    return {
      success: true,
      data: assignments || [],
    };
  } catch (error) {
    console.error('Error getting team members by venue:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get all venues a team member is assigned to
 */
export async function getVenuesByTeamMember(teamMemberId: string) {
  try {
    await requireAdmin();

    const { data: assignments, error } = await supabaseAdmin
      .from('team_member_venues')
      .select(
        `
        id,
        is_active,
        venues!inner (
          id,
          name,
          address,
          photo_url
        )
      `
      )
      .eq('team_member_id', teamMemberId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching venues:', error);
      return { success: false, error: 'Failed to fetch venues' };
    }

    return {
      success: true,
      data: assignments || [],
    };
  } catch (error) {
    console.error('Error getting venues by team member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get team members NOT assigned to a specific venue
 */
export async function getUnassignedTeamMembers(venueId: string) {
  try {
    await requireAdmin();

    // Get all team members
    const { data: allTeamMembers, error: teamError } = await supabaseAdmin
      .from('users')
      .select(
        `
        id,
        first_name,
        last_name,
        photo_url,
        email,
        team_members (
          position,
          is_active
        )
      `
      )
      .contains('roles', ['team_member']);

    if (teamError) {
      console.error('Error fetching team members:', teamError);
      return { success: false, error: 'Failed to fetch team members' };
    }

    // Get already assigned team members
    const { data: assigned, error: assignedError } = await supabaseAdmin
      .from('team_member_venues')
      .select('team_member_id')
      .eq('venue_id', venueId)
      .eq('is_active', true);

    if (assignedError) {
      console.error('Error fetching assignments:', assignedError);
      return { success: false, error: 'Failed to fetch assignments' };
    }

    const assignedIds = new Set(assigned?.map((a) => a.team_member_id) || []);

    // Filter out assigned team members
    const unassigned = allTeamMembers?.filter((tm) => !assignedIds.has(tm.id));

    return {
      success: true,
      data: unassigned || [],
    };
  } catch (error) {
    console.error('Error getting unassigned team members:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Assign a team member to a venue
 */
export async function assignTeamMemberToVenue(
  teamMemberId: string,
  venueId: string
) {
  try {
    await requireAdmin();

    // Check if already assigned (active or inactive)
    const { data: existing } = await supabaseAdmin
      .from('team_member_venues')
      .select('id, is_active')
      .eq('team_member_id', teamMemberId)
      .eq('venue_id', venueId)
      .maybeSingle();

    if (existing) {
      if (existing.is_active) {
        return {
          success: true,
          message: 'Team member already assigned to this venue',
        };
      }

      // Reactivate
      const { error } = await supabaseAdmin
        .from('team_member_venues')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Error reactivating assignment:', error);
        return { success: false, error: 'Failed to assign team member' };
      }
    } else {
      // Create new assignment
      const { error } = await supabaseAdmin.from('team_member_venues').insert({
        team_member_id: teamMemberId,
        venue_id: venueId,
        is_active: true,
      });

      if (error) {
        console.error('Error creating assignment:', error);
        return { success: false, error: 'Failed to assign team member' };
      }
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Team member assigned successfully',
    };
  } catch (error) {
    console.error('Error assigning team member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Unassign a team member from a venue
 */
export async function unassignTeamMemberFromVenue(
  teamMemberId: string,
  venueId: string
) {
  try {
    await requireAdmin();

    // Mark as inactive instead of deleting (preserve history)
    const { error } = await supabaseAdmin
      .from('team_member_venues')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('team_member_id', teamMemberId)
      .eq('venue_id', venueId);

    if (error) {
      console.error('Error unassigning team member:', error);
      return { success: false, error: 'Failed to unassign team member' };
    }

    // Note: We don't delete shifts automatically
    // Admin can choose to delete them separately if needed

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Team member unassigned successfully',
    };
  } catch (error) {
    console.error('Error unassigning team member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Bulk assign multiple team members to a venue
 */
export async function bulkAssignTeamMembers(
  teamMemberIds: string[],
  venueId: string
) {
  try {
    await requireAdmin();

    if (teamMemberIds.length === 0) {
      return { success: false, error: 'No team members selected' };
    }

    // Get existing assignments
    const { data: existing } = await supabaseAdmin
      .from('team_member_venues')
      .select('team_member_id, is_active')
      .eq('venue_id', venueId)
      .in('team_member_id', teamMemberIds);

    const existingMap = new Map(
      existing?.map((e) => [e.team_member_id, e.is_active]) || []
    );

    // Prepare assignments
    const toInsert = [];
    const toReactivate = [];

    for (const teamMemberId of teamMemberIds) {
      const isActive = existingMap.get(teamMemberId);

      if (isActive === undefined) {
        // New assignment
        toInsert.push({
          team_member_id: teamMemberId,
          venue_id: venueId,
          is_active: true,
        });
      } else if (isActive === false) {
        // Reactivate
        toReactivate.push(teamMemberId);
      }
      // If already active, skip
    }

    // Insert new assignments
    if (toInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('team_member_venues')
        .insert(toInsert);

      if (insertError) {
        console.error('Error inserting assignments:', insertError);
        return { success: false, error: 'Failed to assign team members' };
      }
    }

    // Reactivate inactive assignments
    if (toReactivate.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('team_member_venues')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('venue_id', venueId)
        .in('team_member_id', toReactivate);

      if (updateError) {
        console.error('Error reactivating assignments:', updateError);
        return { success: false, error: 'Failed to assign team members' };
      }
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: `Successfully assigned ${teamMemberIds.length} team member(s)`,
    };
  } catch (error) {
    console.error('Error bulk assigning team members:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Bulk unassign multiple team members from a venue
 */
export async function bulkUnassignTeamMembers(
  teamMemberIds: string[],
  venueId: string
) {
  try {
    await requireAdmin();

    if (teamMemberIds.length === 0) {
      return { success: false, error: 'No team members selected' };
    }

    const { error } = await supabaseAdmin
      .from('team_member_venues')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('venue_id', venueId)
      .in('team_member_id', teamMemberIds);

    if (error) {
      console.error('Error unassigning team members:', error);
      return { success: false, error: 'Failed to unassign team members' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: `Successfully unassigned ${teamMemberIds.length} team member(s)`,
    };
  } catch (error) {
    console.error('Error bulk unassigning team members:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
