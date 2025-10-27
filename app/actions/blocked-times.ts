// app/actions/blocked-times.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// =====================================================
// TYPES
// =====================================================

export interface BlockedTime {
  id: string;
  team_member_id: string;
  venue_id: string;
  blocked_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBlockedTimeData {
  team_member_id: string;
  venue_id: string;
  blocked_date: string;
  start_time: string;
  end_time: string;
  reason?: string | null;
}

export interface UpdateBlockedTimeData {
  start_time?: string;
  end_time?: string;
  reason?: string | null;
}

// =====================================================
// CREATE
// =====================================================

export async function createBlockedTime(data: CreateBlockedTimeData) {
  try {
    await requireAdmin();

    // Validate time range
    if (data.start_time >= data.end_time) {
      return {
        success: false,
        error: 'End time must be after start time',
      };
    }

    // Check for overlapping blocked times
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('blocked_times')
      .select('id, start_time, end_time')
      .eq('team_member_id', data.team_member_id)
      .eq('venue_id', data.venue_id)
      .eq('blocked_date', data.blocked_date);

    if (checkError) {
      console.error('Error checking for overlaps:', checkError);
      return {
        success: false,
        error: 'Failed to check for conflicts',
      };
    }

    // Check if new blocked time overlaps with existing ones
    if (existing && existing.length > 0) {
      const hasOverlap = existing.some((block) => {
        return (
          (data.start_time >= block.start_time &&
            data.start_time < block.end_time) ||
          (data.end_time > block.start_time &&
            data.end_time <= block.end_time) ||
          (data.start_time <= block.start_time &&
            data.end_time >= block.end_time)
        );
      });

      if (hasOverlap) {
        return {
          success: false,
          error: 'This time overlaps with an existing blocked time',
        };
      }
    }

    // Create blocked time
    const { data: created, error: insertError } = await supabaseAdmin
      .from('blocked_times')
      .insert(data)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating blocked time:', insertError);
      return {
        success: false,
        error: 'Failed to create blocked time',
      };
    }

    revalidatePath('/admin/calendar');
    return { success: true, data: created };
  } catch (error) {
    console.error('Error in createBlockedTime:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// =====================================================
// UPDATE
// =====================================================

export async function updateBlockedTime(
  id: string,
  data: UpdateBlockedTimeData
) {
  try {
    await requireAdmin();

    // Validate time range if both times provided
    if (data.start_time && data.end_time && data.start_time >= data.end_time) {
      return {
        success: false,
        error: 'End time must be after start time',
      };
    }

    // Get the existing blocked time to check for overlaps
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('blocked_times')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return {
        success: false,
        error: 'Blocked time not found',
      };
    }

    const updatedStartTime = data.start_time || current.start_time;
    const updatedEndTime = data.end_time || current.end_time;

    // Check for overlapping blocked times (excluding current one)
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('blocked_times')
      .select('id, start_time, end_time')
      .eq('team_member_id', current.team_member_id)
      .eq('venue_id', current.venue_id)
      .eq('blocked_date', current.blocked_date)
      .neq('id', id);

    if (checkError) {
      console.error('Error checking for overlaps:', checkError);
      return {
        success: false,
        error: 'Failed to check for conflicts',
      };
    }

    // Check if updated time overlaps with existing ones
    if (existing && existing.length > 0) {
      const hasOverlap = existing.some((block) => {
        return (
          (updatedStartTime >= block.start_time &&
            updatedStartTime < block.end_time) ||
          (updatedEndTime > block.start_time &&
            updatedEndTime <= block.end_time) ||
          (updatedStartTime <= block.start_time &&
            updatedEndTime >= block.end_time)
        );
      });

      if (hasOverlap) {
        return {
          success: false,
          error: 'This time overlaps with an existing blocked time',
        };
      }
    }

    // Update blocked time
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('blocked_times')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating blocked time:', updateError);
      return {
        success: false,
        error: 'Failed to update blocked time',
      };
    }

    revalidatePath('/admin/calendar');
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error in updateBlockedTime:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// =====================================================
// DELETE
// =====================================================

export async function deleteBlockedTime(id: string) {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin
      .from('blocked_times')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting blocked time:', error);
      return {
        success: false,
        error: 'Failed to delete blocked time',
      };
    }

    revalidatePath('/admin/calendar');
    return { success: true };
  } catch (error) {
    console.error('Error in deleteBlockedTime:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// =====================================================
// READ
// =====================================================

export async function getBlockedTimes(
  venueId: string,
  startDate: string,
  endDate: string
) {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from('blocked_times')
      .select('*')
      .eq('venue_id', venueId)
      .gte('blocked_date', startDate)
      .lte('blocked_date', endDate)
      .order('blocked_date')
      .order('start_time');

    if (error) {
      console.error('Error fetching blocked times:', error);
      return {
        success: false,
        error: 'Failed to fetch blocked times',
      };
    }

    return { success: true, data: data as BlockedTime[] };
  } catch (error) {
    console.error('Error in getBlockedTimes:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

export async function getBlockedTimesByTeamMember(
  teamMemberId: string,
  venueId: string,
  date: string
) {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from('blocked_times')
      .select('*')
      .eq('team_member_id', teamMemberId)
      .eq('venue_id', venueId)
      .eq('blocked_date', date)
      .order('start_time');

    if (error) {
      console.error('Error fetching blocked times:', error);
      return {
        success: false,
        error: 'Failed to fetch blocked times',
      };
    }

    return { success: true, data: data as BlockedTime[] };
  } catch (error) {
    console.error('Error in getBlockedTimesByTeamMember:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
