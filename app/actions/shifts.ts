// app/actions/shifts.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { generateShiftDates } from '@/lib/shift-helpers';
import type { ShiftInput, ConflictResolution } from '@/lib/shift-helpers';

/**
 * Create repeating shifts from a pattern
 * This is the PRIMARY method for setting up team member schedules
 */
export async function createRepeatingShifts(formData: FormData) {
  try {
    await requireAdmin();

    // Parse form data - CRITICAL: Keep dates as strings, never convert to Date objects
    const teamMemberId = formData.get('teamMemberId') as string;
    const venueId = formData.get('venueId') as string;
    const startDate = formData.get('startDate') as string; // YYYY-MM-DD string
    const endDate = formData.get('endDate') as string; // YYYY-MM-DD string
    const daysJson = formData.get('days') as string;
    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;
    const conflictResolution =
      (formData.get('conflictResolution') as ConflictResolution) || 'skip';

    if (
      !teamMemberId ||
      !venueId ||
      !startDate ||
      !endDate ||
      !daysJson ||
      !startTime ||
      !endTime
    ) {
      return { success: false, error: 'Missing required fields' };
    }

    const days: number[] = JSON.parse(daysJson);

    if (days.length === 0) {
      return { success: false, error: 'No days selected' };
    }

    // Generate shifts using UTC-safe functions
    // The dates are kept as strings throughout, no timezone conversion!
    const shifts: ShiftInput[] = generateShiftDates({
      days,
      startTime,
      endTime,
      startDate, // Pure YYYY-MM-DD string
      endDate, // Pure YYYY-MM-DD string
    });

    if (shifts.length === 0) {
      return { success: false, error: 'No shifts to create' };
    }

    // Handle conflict resolution
    if (conflictResolution === 'replace') {
      // Delete existing shifts in date range
      const firstDate = shifts[0].shift_date;
      const lastDate = shifts[shifts.length - 1].shift_date;

      await supabaseAdmin
        .from('shifts')
        .delete()
        .eq('team_member_id', teamMemberId)
        .eq('venue_id', venueId)
        .gte('shift_date', firstDate)
        .lte('shift_date', lastDate);
    }

    // Prepare shift records - dates are already strings in YYYY-MM-DD format
    const shiftRecords = shifts.map((shift) => ({
      team_member_id: teamMemberId,
      venue_id: venueId,
      shift_date: shift.shift_date, // Already YYYY-MM-DD string
      start_time: shift.start_time,
      end_time: shift.end_time,
    }));

    // Insert shifts
    if (conflictResolution === 'skip') {
      // Skip mode: Insert with onConflict ignore (upsert with no update)
      const { data, error } = await supabaseAdmin
        .from('shifts')
        .upsert(shiftRecords, {
          onConflict: 'team_member_id,venue_id,shift_date',
          ignoreDuplicates: true,
        })
        .select();

      if (error) {
        console.error('Error creating shifts:', error);
        return { success: false, error: 'Failed to create shifts' };
      }

      const created = data?.length || 0;
      const skipped = shifts.length - created;

      revalidatePath('/admin/team');

      return {
        success: true,
        message:
          created > 0
            ? `Created ${created} shift(s), skipped ${skipped}`
            : 'All shifts already exist',
        created,
        skipped,
      };
    } else {
      // Replace mode: Already deleted old shifts above, just insert new ones
      const { data, error } = await supabaseAdmin
        .from('shifts')
        .insert(shiftRecords)
        .select();

      if (error) {
        console.error('Error creating shifts:', error);
        return { success: false, error: 'Failed to create shifts' };
      }

      revalidatePath('/admin/team');

      return {
        success: true,
        message: `Successfully created ${data.length} shifts`,
        created: data.length,
        skipped: 0,
      };
    }
  } catch (error) {
    console.error('Error creating repeating shifts:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Create a single shift
 */
export async function createShift(formData: FormData) {
  try {
    await requireAdmin();

    const teamMemberId = formData.get('teamMemberId') as string;
    const venueId = formData.get('venueId') as string;
    const shiftDate = formData.get('shiftDate') as string;
    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;
    const notes = formData.get('notes') as string;

    if (!teamMemberId || !venueId || !shiftDate || !startTime || !endTime) {
      return { success: false, error: 'Missing required fields' };
    }

    // Check if venue is closed on this date
    const { data: closedDay } = await supabaseAdmin
      .from('venue_closed_days')
      .select('reason')
      .eq('venue_id', venueId)
      .eq('closed_date', shiftDate)
      .maybeSingle();

    if (closedDay) {
      return {
        success: false,
        error: `Cannot create shift: ${closedDay.reason || 'Venue is closed'}`,
      };
    }

    // Create shift
    const { error } = await supabaseAdmin.from('shifts').insert({
      team_member_id: teamMemberId,
      venue_id: venueId,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      notes: notes || null,
    });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Shift already exists for this date' };
      }
      console.error('Error creating shift:', error);
      return { success: false, error: 'Failed to create shift' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Shift created successfully',
    };
  } catch (error) {
    console.error('Error creating shift:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update a single shift
 */
export async function updateShift(shiftId: string, formData: FormData) {
  try {
    await requireAdmin();

    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;
    const notes = formData.get('notes') as string;

    if (!startTime || !endTime) {
      return { success: false, error: 'Missing required fields' };
    }

    const { error } = await supabaseAdmin
      .from('shifts')
      .update({
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shiftId);

    if (error) {
      console.error('Error updating shift:', error);
      return { success: false, error: 'Failed to update shift' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Shift updated successfully',
    };
  } catch (error) {
    console.error('Error updating shift:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete a single shift
 */
export async function deleteShift(shiftId: string) {
  try {
    await requireAdmin();

    // TODO: Check for existing appointments on this shift
    // For now, just delete the shift

    const { error } = await supabaseAdmin
      .from('shifts')
      .delete()
      .eq('id', shiftId);

    if (error) {
      console.error('Error deleting shift:', error);
      return { success: false, error: 'Failed to delete shift' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Shift deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting shift:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete all shifts for a team member at a venue (with date range)
 */
export async function deleteAllShifts(formData: FormData) {
  try {
    await requireAdmin();

    const teamMemberId = formData.get('teamMemberId') as string;
    const venueId = formData.get('venueId') as string;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;

    if (!teamMemberId || !venueId) {
      return { success: false, error: 'Missing required fields' };
    }

    let query = supabaseAdmin
      .from('shifts')
      .delete()
      .eq('team_member_id', teamMemberId)
      .eq('venue_id', venueId);

    if (startDate) {
      query = query.gte('shift_date', startDate);
    }

    if (endDate) {
      query = query.lte('shift_date', endDate);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting shifts:', error);
      return { success: false, error: 'Failed to delete shifts' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Shifts deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting all shifts:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get shifts for a venue in a date range (for calendar view)
 */
export async function getShiftsByWeek(
  venueId: string,
  startDate: string,
  endDate: string
) {
  try {
    await requireAdmin();

    const { data: shifts, error } = await supabaseAdmin
      .from('shifts')
      .select(
        `
        id,
        team_member_id,
        shift_date,
        start_time,
        end_time,
        notes,
        users!shifts_team_member_id_fkey (
          id,
          first_name,
          last_name,
          photo_url
        )
      `
      )
      .eq('venue_id', venueId)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .order('shift_date')
      .order('start_time');

    if (error) {
      console.error('Error fetching shifts:', error);
      return { success: false, error: 'Failed to fetch shifts' };
    }

    return {
      success: true,
      data: shifts,
    };
  } catch (error) {
    console.error('Error getting shifts by week:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Check for existing shifts (for conflict detection)
 */
export async function checkExistingShifts(
  teamMemberId: string,
  venueId: string,
  startDate: string,
  endDate: string
) {
  try {
    await requireAdmin();

    const { data: shifts, error } = await supabaseAdmin
      .from('shifts')
      .select('shift_date')
      .eq('team_member_id', teamMemberId)
      .eq('venue_id', venueId)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate);

    if (error) {
      console.error('Error checking existing shifts:', error);
      return { success: false, error: 'Failed to check shifts' };
    }

    return {
      success: true,
      count: shifts?.length || 0,
      dates: shifts?.map((s) => s.shift_date) || [],
    };
  } catch (error) {
    console.error('Error checking existing shifts:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update future shifts (from tomorrow onwards)
 */
export async function updateFutureShifts(formData: FormData) {
  try {
    await requireAdmin();

    const teamMemberId = formData.get('teamMemberId') as string;
    const venueId = formData.get('venueId') as string;
    const shiftsJson = formData.get('shifts') as string;

    if (!teamMemberId || !venueId || !shiftsJson) {
      return { success: false, error: 'Missing required fields' };
    }

    const shifts: ShiftInput[] = JSON.parse(shiftsJson);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Delete future shifts (from tomorrow onwards)
    await supabaseAdmin
      .from('shifts')
      .delete()
      .eq('team_member_id', teamMemberId)
      .eq('venue_id', venueId)
      .gt('shift_date', today);

    // Filter shifts to only include future dates
    const futureShifts = shifts.filter((shift) => shift.shift_date > today);

    if (futureShifts.length === 0) {
      return {
        success: true,
        message: 'No future shifts to update',
        created: 0,
      };
    }

    // Insert new shifts
    const shiftRecords = futureShifts.map((shift) => ({
      team_member_id: teamMemberId,
      venue_id: venueId,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
    }));

    const { data, error } = await supabaseAdmin
      .from('shifts')
      .insert(shiftRecords)
      .select();

    if (error) {
      console.error('Error updating future shifts:', error);
      return { success: false, error: 'Failed to update shifts' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: `Updated ${data.length} future shifts`,
      created: data.length,
    };
  } catch (error) {
    console.error('Error updating future shifts:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
