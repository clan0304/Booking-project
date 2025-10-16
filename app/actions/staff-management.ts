// app/actions/staff-management.ts
'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAuth, requireAdmin } from '@/lib/auth';

// =====================================================
// TYPES
// =====================================================

interface Break {
  start: string;
  end: string | null;
}

interface TimeEntry {
  id: string;
  team_member_id: string;
  venue_id: string;
  shift_date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  breaks: Break[];
  current_break_start: string | null;
  status: 'clocked_in' | 'on_break' | 'completed';
  total_hours: number | null;
  total_paid_hours: number | null;
  total_break_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  };
  venues: {
    id: string;
    name: string;
  };
}

interface ActiveShiftData {
  id: string;
  venue_id: string;
  clock_in_time: string;
  status: 'clocked_in' | 'on_break';
  current_break_start: string | null;
  breaks: Break[];
  venues: {
    name: string;
  } | null;
}

interface ActiveShift {
  id: string;
  venue_id: string;
  venue_name: string;
  clock_in_time: string;
  status: 'clocked_in' | 'on_break';
  current_break_start: string | null;
  breaks: Break[];
}

interface LongRunningShift {
  id: string;
  team_member_id: string;
  team_member_name: string;
  venue_id: string;
  venue_name: string;
  clock_in_time: string;
  hours_elapsed: number;
  status: string;
}

// =====================================================
// CLOCK IN
// =====================================================
export async function clockIn(venueId: string, teamMemberId?: string) {
  try {
    // ✅ FIX: Support kiosk mode - admin can clock in for any team member
    const { supabaseUserId, roles } = await requireAuth();
    const isAdmin = roles.includes('admin');

    // Admin can clock in for any team member (kiosk mode)
    // Non-admin can only clock in for themselves
    const targetUserId =
      isAdmin && teamMemberId ? teamMemberId : supabaseUserId;

    const { data: activeShift } = await supabaseAdmin
      .from('staff_time_entries')
      .select('id, status')
      .eq('team_member_id', targetUserId)
      .in('status', ['clocked_in', 'on_break'])
      .single();

    if (activeShift) {
      return {
        success: false,
        error: 'You already have an active shift. Please clock out first.',
      };
    }

    const now = new Date().toISOString();
    const shiftDate = now.split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('staff_time_entries')
      .insert({
        team_member_id: targetUserId,
        venue_id: venueId,
        shift_date: shiftDate,
        clock_in_time: now,
        status: 'clocked_in',
        created_by: supabaseUserId, // Track who created it (admin)
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true, data };
  } catch (error) {
    console.error('Clock in error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clock in',
    };
  }
}

// =====================================================
// CLOCK OUT
// =====================================================
export async function clockOut(entryId: string, teamMemberId?: string) {
  try {
    // ✅ FIX: Support kiosk mode
    const { supabaseUserId, roles } = await requireAuth();
    const isAdmin = roles.includes('admin');

    // Build query - admin can clock out anyone, non-admin only themselves
    let query = supabaseAdmin
      .from('staff_time_entries')
      .select('*')
      .eq('id', entryId);

    if (!isAdmin || !teamMemberId) {
      query = query.eq('team_member_id', supabaseUserId);
    }

    const { data: entry } = await query.single();

    if (!entry) return { success: false, error: 'Time entry not found' };
    if (entry.status === 'on_break')
      return {
        success: false,
        error: 'Please end your break before clocking out',
      };
    if (entry.status === 'completed')
      return { success: false, error: 'This shift is already completed' };

    const now = new Date().toISOString();

    const { data: payRate } = await supabaseAdmin.rpc(
      'get_effective_pay_rate',
      {
        p_team_member_id: entry.team_member_id,
        p_date: entry.shift_date,
      }
    );

    const { data: hours } = await supabaseAdmin.rpc('calculate_shift_hours', {
      p_clock_in: entry.clock_in_time,
      p_clock_out: now,
      p_breaks: entry.breaks,
      p_paid_break_minutes: payRate?.[0]?.paid_break_minutes || 30,
    });

    const { error } = await supabaseAdmin
      .from('staff_time_entries')
      .update({
        clock_out_time: now,
        status: 'completed',
        total_hours: hours?.[0]?.total_hours || 0,
        total_paid_hours: hours?.[0]?.total_paid_hours || 0,
        total_break_minutes: hours?.[0]?.total_break_minutes || 0,
        updated_by: supabaseUserId,
      })
      .eq('id', entryId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Clock out error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clock out',
    };
  }
}

// =====================================================
// START BREAK
// =====================================================
export async function startBreak(entryId: string, teamMemberId?: string) {
  try {
    // ✅ FIX: Support kiosk mode
    const { supabaseUserId, roles } = await requireAuth();
    const isAdmin = roles.includes('admin');

    // Build query - admin can start break for anyone, non-admin only themselves
    let query = supabaseAdmin
      .from('staff_time_entries')
      .select('*')
      .eq('id', entryId);

    if (!isAdmin || !teamMemberId) {
      query = query.eq('team_member_id', supabaseUserId);
    }

    const { data: entry } = await query.single();

    if (!entry) return { success: false, error: 'Time entry not found' };
    if (entry.status !== 'clocked_in')
      return {
        success: false,
        error: 'You must be clocked in to start a break',
      };
    if (entry.current_break_start)
      return { success: false, error: 'Break already in progress' };

    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('staff_time_entries')
      .update({
        status: 'on_break',
        current_break_start: now,
        updated_by: supabaseUserId,
      })
      .eq('id', entryId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Start break error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start break',
    };
  }
}

// =====================================================
// END BREAK
// =====================================================
export async function endBreak(entryId: string, teamMemberId?: string) {
  try {
    // ✅ FIX: Support kiosk mode
    const { supabaseUserId, roles } = await requireAuth();
    const isAdmin = roles.includes('admin');

    // Build query - admin can end break for anyone, non-admin only themselves
    let query = supabaseAdmin
      .from('staff_time_entries')
      .select('*')
      .eq('id', entryId);

    if (!isAdmin || !teamMemberId) {
      query = query.eq('team_member_id', supabaseUserId);
    }

    const { data: entry } = await query.single();

    if (!entry) return { success: false, error: 'Time entry not found' };
    if (entry.status !== 'on_break')
      return { success: false, error: 'No break in progress' };
    if (!entry.current_break_start)
      return { success: false, error: 'Break not started properly' };

    const now = new Date().toISOString();
    const updatedBreaks = [
      ...(entry.breaks || []),
      { start: entry.current_break_start, end: now },
    ];

    const { error } = await supabaseAdmin
      .from('staff_time_entries')
      .update({
        status: 'clocked_in',
        breaks: updatedBreaks,
        current_break_start: null,
        updated_by: supabaseUserId,
      })
      .eq('id', entryId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('End break error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end break',
    };
  }
}

// =====================================================
// GET ACTIVE SHIFT
// =====================================================
export async function getActiveShift(teamMemberId?: string): Promise<{
  success: boolean;
  data?: ActiveShift;
  error?: string;
}> {
  try {
    // ✅ FIX: Use provided teamMemberId for kiosk mode, otherwise use logged-in user
    const { supabaseUserId, roles } = await requireAuth();
    const isAdmin = roles.includes('admin');

    // Admin can check any team member's shift (kiosk mode)
    // Non-admin can only check their own shift
    const targetUserId =
      isAdmin && teamMemberId ? teamMemberId : supabaseUserId;

    const { data, error } = await supabaseAdmin
      .from('staff_time_entries')
      .select(
        'id, venue_id, clock_in_time, status, current_break_start, breaks, venues(name)'
      )
      .eq('team_member_id', targetUserId)
      .in('status', ['clocked_in', 'on_break'])
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, data: undefined };
      }
      throw error;
    }

    const typedData = data as unknown as ActiveShiftData;

    if (!typedData) return { success: true, data: undefined };

    const activeShift: ActiveShift = {
      id: typedData.id,
      venue_id: typedData.venue_id,
      venue_name: typedData.venues?.name || 'Unknown Venue',
      clock_in_time: typedData.clock_in_time,
      status: typedData.status,
      current_break_start: typedData.current_break_start,
      breaks: typedData.breaks || [],
    };

    return { success: true, data: activeShift };
  } catch (error) {
    console.error('Get active shift error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get active shift',
    };
  }
}

// =====================================================
// GET TIME ENTRIES
// =====================================================
export async function getTimeEntries(filters?: {
  teamMemberId?: string;
  venueId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: TimeEntry[];
  error?: string;
}> {
  try {
    // ✅ FIX: Use supabaseUserId
    const { supabaseUserId, roles } = await requireAuth();
    const isAdmin = roles.includes('admin');

    // ✅ FIX: Specify which users relationship to use with hint syntax
    let query = supabaseAdmin
      .from('staff_time_entries')
      .select(
        `*, users!staff_time_entries_team_member_id_fkey(id, first_name, last_name, photo_url), venues(id, name)`
      )
      .order('shift_date', { ascending: false })
      .order('clock_in_time', { ascending: false });

    if (!isAdmin) {
      query = query.eq('team_member_id', supabaseUserId);
    } else if (filters?.teamMemberId) {
      query = query.eq('team_member_id', filters.teamMemberId);
    }

    if (filters?.venueId) query = query.eq('venue_id', filters.venueId);
    if (filters?.startDate) query = query.gte('shift_date', filters.startDate);
    if (filters?.endDate) query = query.lte('shift_date', filters.endDate);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;

    const typedData = data as unknown as TimeEntry[];

    return { success: true, data: typedData || [] };
  } catch (error) {
    console.error('Get time entries error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get time entries',
    };
  }
}

// =====================================================
// GET LONG-RUNNING SHIFTS (ADMIN)
// =====================================================
export async function getLongRunningShifts(
  hoursThreshold: number = 12
): Promise<{
  success: boolean;
  data?: LongRunningShift[];
  error?: string;
}> {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin.rpc('get_long_running_shifts', {
      p_hours_threshold: hoursThreshold,
    });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get long-running shifts error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get long-running shifts',
    };
  }
}

// =====================================================
// ADMIN CLOCK OUT
// =====================================================
export async function adminClockOut(
  entryId: string,
  clockOutTime: string,
  notes?: string
) {
  try {
    // ✅ FIX: Use supabaseUserId
    const { supabaseUserId } = await requireAdmin();

    const { data: entry } = await supabaseAdmin
      .from('staff_time_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (!entry) return { success: false, error: 'Time entry not found' };
    if (entry.status === 'completed')
      return { success: false, error: 'This shift is already completed' };

    let updatedBreaks = entry.breaks || [];
    if (entry.status === 'on_break' && entry.current_break_start) {
      updatedBreaks = [
        ...updatedBreaks,
        { start: entry.current_break_start, end: clockOutTime },
      ];
    }

    const { data: payRate } = await supabaseAdmin.rpc(
      'get_effective_pay_rate',
      {
        p_team_member_id: entry.team_member_id,
        p_date: entry.shift_date,
      }
    );

    const { data: hours } = await supabaseAdmin.rpc('calculate_shift_hours', {
      p_clock_in: entry.clock_in_time,
      p_clock_out: clockOutTime,
      p_breaks: updatedBreaks,
      p_paid_break_minutes: payRate?.[0]?.paid_break_minutes || 30,
    });

    const adminNote = notes ? `\n\nAdmin note: ${notes}` : '';
    const updatedNotes = entry.notes
      ? `${entry.notes}${adminNote}`
      : adminNote.trim();

    const { error } = await supabaseAdmin
      .from('staff_time_entries')
      .update({
        clock_out_time: clockOutTime,
        status: 'completed',
        breaks: updatedBreaks,
        current_break_start: null,
        total_hours: hours?.[0]?.total_hours || 0,
        total_paid_hours: hours?.[0]?.total_paid_hours || 0,
        total_break_minutes: hours?.[0]?.total_break_minutes || 0,
        notes: updatedNotes || null,
        updated_by: supabaseUserId,
      })
      .eq('id', entryId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Admin clock out error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to clock out shift',
    };
  }
}

// =====================================================
// UPDATE TIME ENTRY (ADMIN)
// =====================================================
export async function updateTimeEntry(
  entryId: string,
  updates: {
    clock_in_time?: string;
    clock_out_time?: string;
    notes?: string;
  }
) {
  try {
    // ✅ FIX: Use supabaseUserId
    const { supabaseUserId } = await requireAdmin();

    const { data: entry } = await supabaseAdmin
      .from('staff_time_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (!entry) return { success: false, error: 'Time entry not found' };

    const finalUpdates: Record<string, unknown> = { ...updates };

    if (updates.clock_in_time || updates.clock_out_time) {
      const clockIn = updates.clock_in_time || entry.clock_in_time;
      const clockOut = updates.clock_out_time || entry.clock_out_time;

      if (clockOut) {
        const { data: payRate } = await supabaseAdmin.rpc(
          'get_effective_pay_rate',
          {
            p_team_member_id: entry.team_member_id,
            p_date: entry.shift_date,
          }
        );

        const { data: hours } = await supabaseAdmin.rpc(
          'calculate_shift_hours',
          {
            p_clock_in: clockIn,
            p_clock_out: clockOut,
            p_breaks: entry.breaks,
            p_paid_break_minutes: payRate?.[0]?.paid_break_minutes || 30,
          }
        );

        if (hours?.[0]) {
          finalUpdates.total_hours = hours[0].total_hours;
          finalUpdates.total_paid_hours = hours[0].total_paid_hours;
          finalUpdates.total_break_minutes = hours[0].total_break_minutes;
        }
      }
    }

    finalUpdates.updated_by = supabaseUserId;

    const { error } = await supabaseAdmin
      .from('staff_time_entries')
      .update(finalUpdates)
      .eq('id', entryId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Update time entry error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update time entry',
    };
  }
}

// =====================================================
// DELETE TIME ENTRY (ADMIN)
// =====================================================
export async function deleteTimeEntry(entryId: string) {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin
      .from('staff_time_entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Delete time entry error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete time entry',
    };
  }
}

// =====================================================
// CREATE MANUAL ENTRY (ADMIN)
// =====================================================
export async function createManualEntry(data: {
  team_member_id: string;
  venue_id: string;
  shift_date: string;
  clock_in_time: string;
  clock_out_time: string;
  notes?: string;
}) {
  try {
    // ✅ FIX: Use supabaseUserId
    const { supabaseUserId } = await requireAdmin();

    const clockIn = new Date(data.clock_in_time);
    const clockOut = new Date(data.clock_out_time);

    if (clockOut <= clockIn) {
      return {
        success: false,
        error: 'Clock out time must be after clock in time',
      };
    }

    const { data: payRate } = await supabaseAdmin.rpc(
      'get_effective_pay_rate',
      {
        p_team_member_id: data.team_member_id,
        p_date: data.shift_date,
      }
    );

    const { data: hours } = await supabaseAdmin.rpc('calculate_shift_hours', {
      p_clock_in: data.clock_in_time,
      p_clock_out: data.clock_out_time,
      p_breaks: [],
      p_paid_break_minutes: payRate?.[0]?.paid_break_minutes || 30,
    });

    const { error } = await supabaseAdmin.from('staff_time_entries').insert({
      team_member_id: data.team_member_id,
      venue_id: data.venue_id,
      shift_date: data.shift_date,
      clock_in_time: data.clock_in_time,
      clock_out_time: data.clock_out_time,
      status: 'completed',
      notes: data.notes,
      total_hours: hours?.[0]?.total_hours || 0,
      total_paid_hours: hours?.[0]?.total_paid_hours || 0,
      total_break_minutes: 0,
      created_by: supabaseUserId,
    });

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Create manual entry error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create manual entry',
    };
  }
}
