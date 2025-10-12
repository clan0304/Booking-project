// app/actions/venue-closed-days.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Mark venue as closed for a single day
 */
export async function markVenueClosed(formData: FormData) {
  try {
    await requireAdmin();

    const venueId = formData.get('venueId') as string;
    const closedDate = formData.get('closedDate') as string;
    const reason = formData.get('reason') as string;

    if (!venueId || !closedDate) {
      return { success: false, error: 'Missing required fields' };
    }

    // Check for existing appointments (future feature)
    // const appointmentCount = await countAppointmentsOnDate(venueId, closedDate);

    // Insert closed day record
    const { error } = await supabaseAdmin.from('venue_closed_days').insert({
      venue_id: venueId,
      closed_date: closedDate,
      reason: reason || null,
      is_recurring: false,
    });

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'Venue already marked as closed on this date',
        };
      }
      console.error('Error marking venue closed:', error);
      return { success: false, error: 'Failed to mark venue as closed' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Venue marked as closed',
      // appointmentsToHandle: appointmentCount, // Future feature
    };
  } catch (error) {
    console.error('Error marking venue closed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Mark venue as closed for multiple days (date range)
 */
export async function markVenueClosedMultipleDays(formData: FormData) {
  try {
    await requireAdmin();

    const venueId = formData.get('venueId') as string;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const reason = formData.get('reason') as string;

    if (!venueId || !startDate || !endDate) {
      return { success: false, error: 'Missing required fields' };
    }

    // Generate all dates in range
    const dates: string[] = [];
    const currentDate = new Date(startDate + 'T00:00:00');
    const endDateObj = new Date(endDate + 'T00:00:00');

    while (currentDate <= endDateObj) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Insert all closed day records
    const closedDayRecords = dates.map((date) => ({
      venue_id: venueId,
      closed_date: date,
      reason: reason || null,
      is_recurring: false,
    }));

    const { error } = await supabaseAdmin
      .from('venue_closed_days')
      .insert(closedDayRecords);

    if (error) {
      console.error('Error marking multiple days closed:', error);
      return { success: false, error: 'Failed to mark dates as closed' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: `Venue closed for ${dates.length} days`,
    };
  } catch (error) {
    console.error('Error marking multiple days closed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Set recurring closed day (e.g., every Sunday)
 */
export async function setRecurringClosedDay(formData: FormData) {
  try {
    await requireAdmin();

    const venueId = formData.get('venueId') as string;
    const dayOfWeek = parseInt(formData.get('dayOfWeek') as string);
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const reason = formData.get('reason') as string;

    if (!venueId || isNaN(dayOfWeek) || !startDate || !endDate) {
      return { success: false, error: 'Missing required fields' };
    }

    // Generate all occurrences of the day in the range
    const dates: string[] = [];
    const currentDate = new Date(startDate + 'T00:00:00');
    const endDateObj = new Date(endDate + 'T00:00:00');

    // Find first occurrence
    const currentDay = currentDate.getDay();
    const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
    currentDate.setDate(currentDate.getDate() + daysToAdd);

    // Generate all occurrences
    while (currentDate <= endDateObj) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 7); // Next week
    }

    if (dates.length === 0) {
      return { success: false, error: 'No dates generated in the range' };
    }

    // Insert closed day records
    const closedDayRecords = dates.map((date) => ({
      venue_id: venueId,
      closed_date: date,
      reason: reason || null,
      is_recurring: true,
      recurrence_rule: `WEEKLY:${dayOfWeek}`,
    }));

    const { error } = await supabaseAdmin
      .from('venue_closed_days')
      .insert(closedDayRecords);

    if (error) {
      console.error('Error setting recurring closed day:', error);
      return { success: false, error: 'Failed to set recurring closure' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: `Set ${dates.length} recurring closed days`,
    };
  } catch (error) {
    console.error('Error setting recurring closed day:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Reopen venue on a previously closed day
 */
export async function reopenVenue(venueId: string, closedDate: string) {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin
      .from('venue_closed_days')
      .delete()
      .eq('venue_id', venueId)
      .eq('closed_date', closedDate);

    if (error) {
      console.error('Error reopening venue:', error);
      return { success: false, error: 'Failed to reopen venue' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Venue reopened for this date',
    };
  } catch (error) {
    console.error('Error reopening venue:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update closed day reason
 */
export async function updateClosedDayReason(
  closedDayId: string,
  reason: string
) {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin
      .from('venue_closed_days')
      .update({ reason })
      .eq('id', closedDayId);

    if (error) {
      console.error('Error updating reason:', error);
      return { success: false, error: 'Failed to update reason' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Reason updated successfully',
    };
  } catch (error) {
    console.error('Error updating closed day reason:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get all closed days for a venue in a date range
 */
export async function getClosedDays(
  venueId: string,
  startDate: string,
  endDate: string
) {
  try {
    await requireAdmin();

    const { data: closedDays, error } = await supabaseAdmin
      .from('venue_closed_days')
      .select('*')
      .eq('venue_id', venueId)
      .gte('closed_date', startDate)
      .lte('closed_date', endDate)
      .order('closed_date');

    if (error) {
      console.error('Error fetching closed days:', error);
      return { success: false, error: 'Failed to fetch closed days' };
    }

    return {
      success: true,
      data: closedDays || [],
    };
  } catch (error) {
    console.error('Error getting closed days:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Check if venue is closed on a specific date
 */
export async function isVenueClosed(venueId: string, date: string) {
  try {
    await requireAdmin();

    const { data: closedDay } = await supabaseAdmin
      .from('venue_closed_days')
      .select('id, reason')
      .eq('venue_id', venueId)
      .eq('closed_date', date)
      .maybeSingle();

    return {
      success: true,
      isClosed: !!closedDay,
      reason: closedDay?.reason || null,
    };
  } catch (error) {
    console.error('Error checking if venue closed:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get all closed days for a venue (no date filter)
 */
export async function getAllClosedDays(venueId: string) {
  try {
    await requireAdmin();

    const { data: closedDays, error } = await supabaseAdmin
      .from('venue_closed_days')
      .select('*')
      .eq('venue_id', venueId)
      .order('closed_date', { ascending: false });

    if (error) {
      console.error('Error fetching all closed days:', error);
      return { success: false, error: 'Failed to fetch closed days' };
    }

    return {
      success: true,
      data: closedDays || [],
    };
  } catch (error) {
    console.error('Error getting all closed days:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete all recurring closed days for a specific day of week
 */
export async function deleteRecurringClosedDays(
  venueId: string,
  dayOfWeek: number
) {
  try {
    await requireAdmin();

    const recurrenceRule = `WEEKLY:${dayOfWeek}`;

    const { error } = await supabaseAdmin
      .from('venue_closed_days')
      .delete()
      .eq('venue_id', venueId)
      .eq('recurrence_rule', recurrenceRule);

    if (error) {
      console.error('Error deleting recurring closed days:', error);
      return { success: false, error: 'Failed to delete recurring closures' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Recurring closure removed',
    };
  } catch (error) {
    console.error('Error deleting recurring closed days:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
