// app/actions/venue-hours.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { VenueOperatingHours } from '@/types/database';

/**
 * Get venue operating hours for all days of the week
 */
export async function getVenueHours(venueId: string) {
  try {
    await requireAdmin();

    const { data: hours, error } = await supabaseAdmin
      .from('venue_operating_hours')
      .select('*')
      .eq('venue_id', venueId)
      .order('day_of_week');

    if (error) {
      console.error('Error fetching venue hours:', error);
      return { success: false, error: 'Failed to fetch venue hours' };
    }

    // Fill in missing days with default closed status
    const allDays: Partial<VenueOperatingHours>[] = [];
    for (let day = 0; day <= 6; day++) {
      const existing = hours?.find((h) => h.day_of_week === day);
      if (existing) {
        allDays.push(existing);
      } else {
        allDays.push({
          venue_id: venueId,
          day_of_week: day,
          start_time: null,
          end_time: null,
          is_closed: true,
        });
      }
    }

    return {
      success: true,
      data: allDays,
    };
  } catch (error) {
    console.error('Error getting venue hours:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Create or update venue operating hours for all days
 */
export async function saveVenueHours(
  venueId: string,
  hours: Array<{
    day_of_week: number;
    start_time: string | null;
    end_time: string | null;
    is_closed: boolean;
  }>
) {
  try {
    await requireAdmin();

    // Delete existing hours
    await supabaseAdmin
      .from('venue_operating_hours')
      .delete()
      .eq('venue_id', venueId);

    // Insert new hours (only for days that are not closed or have times)
    const hoursToInsert = hours
      .filter((h) => !h.is_closed || h.start_time || h.end_time)
      .map((h) => ({
        venue_id: venueId,
        day_of_week: h.day_of_week,
        start_time: h.is_closed ? null : h.start_time,
        end_time: h.is_closed ? null : h.end_time,
        is_closed: h.is_closed,
      }));

    if (hoursToInsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('venue_operating_hours')
        .insert(hoursToInsert);

      if (error) {
        console.error('Error saving venue hours:', error);
        return { success: false, error: 'Failed to save venue hours' };
      }
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Venue hours saved successfully',
    };
  } catch (error) {
    console.error('Error saving venue hours:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update operating hours for a single day
 */
export async function updateDayHours(
  venueId: string,
  dayOfWeek: number,
  startTime: string | null,
  endTime: string | null,
  isClosed: boolean
) {
  try {
    await requireAdmin();

    // Upsert (update or insert)
    const { error } = await supabaseAdmin.from('venue_operating_hours').upsert(
      {
        venue_id: venueId,
        day_of_week: dayOfWeek,
        start_time: isClosed ? null : startTime,
        end_time: isClosed ? null : endTime,
        is_closed: isClosed,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'venue_id,day_of_week',
      }
    );

    if (error) {
      console.error('Error updating day hours:', error);
      return { success: false, error: 'Failed to update hours' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Hours updated successfully',
    };
  } catch (error) {
    console.error('Error updating day hours:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Copy hours to all weekdays (Mon-Fri)
 */
export async function copyToWeekdays(
  venueId: string,
  startTime: string,
  endTime: string
) {
  try {
    await requireAdmin();

    const weekdayHours = [];
    for (let day = 1; day <= 5; day++) {
      weekdayHours.push({
        venue_id: venueId,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        is_closed: false,
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await supabaseAdmin
      .from('venue_operating_hours')
      .upsert(weekdayHours, {
        onConflict: 'venue_id,day_of_week',
      });

    if (error) {
      console.error('Error copying to weekdays:', error);
      return { success: false, error: 'Failed to copy hours' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Hours copied to all weekdays',
    };
  } catch (error) {
    console.error('Error copying to weekdays:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Copy hours to all days (Mon-Sun)
 */
export async function copyToAllDays(
  venueId: string,
  startTime: string,
  endTime: string
) {
  try {
    await requireAdmin();

    const allDayHours = [];
    for (let day = 0; day <= 6; day++) {
      allDayHours.push({
        venue_id: venueId,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        is_closed: false,
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await supabaseAdmin
      .from('venue_operating_hours')
      .upsert(allDayHours, {
        onConflict: 'venue_id,day_of_week',
      });

    if (error) {
      console.error('Error copying to all days:', error);
      return { success: false, error: 'Failed to copy hours' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Hours copied to all days',
    };
  } catch (error) {
    console.error('Error copying to all days:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Reset to default hours (9am-6pm weekdays, 10am-4pm Saturday, closed Sunday)
 */
export async function resetToDefaultHours(venueId: string) {
  try {
    await requireAdmin();

    // Delete existing
    await supabaseAdmin
      .from('venue_operating_hours')
      .delete()
      .eq('venue_id', venueId);

    // Insert defaults
    const defaultHours = [
      // Monday-Friday: 9am-6pm
      ...Array.from({ length: 5 }, (_, i) => ({
        venue_id: venueId,
        day_of_week: i + 1,
        start_time: '09:00',
        end_time: '18:00',
        is_closed: false,
      })),
      // Saturday: 10am-4pm
      {
        venue_id: venueId,
        day_of_week: 6,
        start_time: '10:00',
        end_time: '16:00',
        is_closed: false,
      },
      // Sunday: Closed
      {
        venue_id: venueId,
        day_of_week: 0,
        start_time: null,
        end_time: null,
        is_closed: true,
      },
    ];

    const { error } = await supabaseAdmin
      .from('venue_operating_hours')
      .insert(defaultHours);

    if (error) {
      console.error('Error resetting hours:', error);
      return { success: false, error: 'Failed to reset hours' };
    }

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Hours reset to default',
    };
  } catch (error) {
    console.error('Error resetting to default hours:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
