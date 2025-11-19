// app/api/public/bookings/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface BookingGroupData {
  booking_date: string;
  guest_first_name: string;
  guest_last_name: string | null;
  venue_id: string;
}

interface RawAppointmentFromDB {
  id: string;
  start_time: string;
  end_time: string;
  service_name: string;
  status: string;
  booking_groups: BookingGroupData[] | BookingGroupData;
}

interface AppointmentWithBookingGroup {
  id: string;
  start_time: string;
  end_time: string;
  service_name: string;
  status: string;
  booking_groups: BookingGroupData;
}

interface BookedSlot {
  appointment_id: string;
  start_time: string;
  end_time: string;
  service_name: string;
  client_name: string;
  status: string;
}

interface Shift {
  id: string;
  start_time: string;
  end_time: string;
  notes: string | null;
}

interface VenueClosedDay {
  closed_date: string;
  reason: string | null;
}

interface BlockedTime {
  id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_member_id, date, start_time, end_time } = body;

    if (!team_member_id || !date || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if time slot is available by querying booking_groups and appointments
    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('start_time, end_time, booking_groups!inner(booking_date)')
      .eq('team_member_id', team_member_id)
      .eq('booking_groups.booking_date', date)
      .neq('status', 'cancelled');

    if (error) {
      console.error('Error checking availability:', error);
      return NextResponse.json(
        { error: 'Failed to check availability' },
        { status: 500 }
      );
    }

    // Check for overlaps with appointments
    const hasConflict = (appointments || []).some(
      (appt: { start_time: string; end_time: string }) => {
        const apptStart = timeToMinutes(appt.start_time);
        const apptEnd = timeToMinutes(appt.end_time);
        const requestStart = timeToMinutes(start_time);
        const requestEnd = timeToMinutes(end_time);

        return (
          (requestStart >= apptStart && requestStart < apptEnd) ||
          (requestEnd > apptStart && requestEnd <= apptEnd) ||
          (requestStart <= apptStart && requestEnd >= apptEnd)
        );
      }
    );

    if (hasConflict) {
      return NextResponse.json({
        available: false,
      });
    }

    // ✅ NEW: Check for overlaps with blocked times
    const { data: blockedTimes, error: blockedError } = await supabaseAdmin
      .from('blocked_times')
      .select('id, start_time, end_time, reason')
      .eq('team_member_id', team_member_id)
      .eq('blocked_date', date);

    if (blockedError) {
      console.error('Error checking blocked times:', blockedError);
      return NextResponse.json(
        { error: 'Failed to check blocked times' },
        { status: 500 }
      );
    }

    const hasBlockedConflict = (blockedTimes || []).some(
      (blocked: { start_time: string; end_time: string }) => {
        const blockedStart = timeToMinutes(blocked.start_time);
        const blockedEnd = timeToMinutes(blocked.end_time);
        const requestStart = timeToMinutes(start_time);
        const requestEnd = timeToMinutes(end_time);

        return (
          (requestStart >= blockedStart && requestStart < blockedEnd) ||
          (requestEnd > blockedStart && requestEnd <= blockedEnd) ||
          (requestStart <= blockedStart && requestEnd >= blockedEnd)
        );
      }
    );

    return NextResponse.json({
      available: !hasBlockedConflict,
    });
  } catch (error) {
    console.error('Error in availability API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamMemberId = searchParams.get('team_member_id');
    const date = searchParams.get('date');
    const venueId = searchParams.get('venue_id');

    if (!teamMemberId || !date) {
      return NextResponse.json(
        { error: 'Missing required parameters: team_member_id and date' },
        { status: 400 }
      );
    }

    // 1. Check if venue is closed on this date
    if (venueId) {
      const { data: closedDay } = await supabaseAdmin
        .from('venue_closed_days')
        .select('closed_date, reason')
        .eq('venue_id', venueId)
        .eq('closed_date', date)
        .maybeSingle();

      if (closedDay) {
        const typedClosedDay = closedDay as VenueClosedDay;
        return NextResponse.json({
          available: false,
          reason: 'venue_closed',
          message: typedClosedDay.reason || 'Venue is closed on this date',
          slots: [],
          shift: null,
        });
      }
    }

    // 2. Get team member's shift
    let shiftQuery = supabaseAdmin
      .from('shifts')
      .select('id, start_time, end_time, notes')
      .eq('team_member_id', teamMemberId)
      .eq('shift_date', date);

    if (venueId) {
      shiftQuery = shiftQuery.eq('venue_id', venueId);
    }

    const { data: shift, error: shiftError } = await shiftQuery.maybeSingle();

    if (shiftError) {
      console.error('Error fetching shift:', shiftError);
      return NextResponse.json(
        { error: 'Failed to fetch shift information' },
        { status: 500 }
      );
    }

    if (!shift) {
      return NextResponse.json({
        available: false,
        reason: 'no_shift',
        message: venueId
          ? 'Team member is not scheduled to work at this venue on this date'
          : 'Team member is not scheduled to work on this date',
        slots: [],
        shift: null,
      });
    }

    const typedShift = shift as Shift;

    // 3. Get existing appointments
    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select(
        `
        id,
        start_time,
        end_time,
        service_name,
        status,
        booking_groups!inner(booking_date, guest_first_name, guest_last_name, venue_id)
      `
      )
      .eq('team_member_id', teamMemberId)
      .eq('booking_groups.booking_date', date)
      .neq('status', 'cancelled');

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      return NextResponse.json(
        { error: 'Failed to fetch appointments' },
        { status: 500 }
      );
    }

    const rawAppointments = (appointments || []) as RawAppointmentFromDB[];

    // Filter by venue if provided
    let filteredAppointments = rawAppointments;
    if (venueId) {
      filteredAppointments = rawAppointments.filter((appt) => {
        const bookingGroup = Array.isArray(appt.booking_groups)
          ? appt.booking_groups[0]
          : appt.booking_groups;
        return bookingGroup.venue_id === venueId;
      });
    }

    const typedAppointments: AppointmentWithBookingGroup[] =
      filteredAppointments.map((appt) => ({
        id: appt.id,
        start_time: appt.start_time,
        end_time: appt.end_time,
        service_name: appt.service_name,
        status: appt.status,
        booking_groups: Array.isArray(appt.booking_groups)
          ? appt.booking_groups[0]
          : appt.booking_groups,
      }));

    const bookedSlots: BookedSlot[] = typedAppointments.map((appt) => ({
      appointment_id: appt.id,
      start_time: appt.start_time,
      end_time: appt.end_time,
      service_name: appt.service_name,
      client_name: `${appt.booking_groups.guest_first_name} ${
        appt.booking_groups.guest_last_name || ''
      }`.trim(),
      status: appt.status,
    }));

    // 4. ✅ NEW: Get blocked times
    let blockedQuery = supabaseAdmin
      .from('blocked_times')
      .select('id, start_time, end_time, reason')
      .eq('team_member_id', teamMemberId)
      .eq('blocked_date', date);

    if (venueId) {
      blockedQuery = blockedQuery.eq('venue_id', venueId);
    }

    const { data: blockedTimes, error: blockedError } = await blockedQuery;

    if (blockedError) {
      console.error('Error fetching blocked times:', blockedError);
      return NextResponse.json(
        { error: 'Failed to fetch blocked times' },
        { status: 500 }
      );
    }

    const typedBlockedTimes = (blockedTimes || []) as BlockedTime[];

    // 5. Generate available slots (excluding both appointments AND blocked times)
    const slots = generateAvailableSlots(
      typedShift.start_time,
      typedShift.end_time,
      bookedSlots,
      typedBlockedTimes, // ✅ NEW: Pass blocked times
      30
    );

    return NextResponse.json({
      available: slots.length > 0,
      reason: slots.length > 0 ? 'available' : 'fully_booked',
      message:
        slots.length > 0
          ? `${slots.length} time slots available`
          : 'No available time slots',
      slots,
      shift: {
        start_time: typedShift.start_time,
        end_time: typedShift.end_time,
        notes: typedShift.notes,
      },
      booked: bookedSlots,
      blocked: typedBlockedTimes, // ✅ NEW: Include blocked times in response
    });
  } catch (error) {
    console.error('Error in availability GET API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * ✅ UPDATED: Generate available time slots excluding BOTH appointments AND blocked times
 */
function generateAvailableSlots(
  shiftStartTime: string,
  shiftEndTime: string,
  bookedAppointments: BookedSlot[],
  blockedTimes: BlockedTime[], // ✅ NEW parameter
  intervalMinutes: number
): string[] {
  const slots: string[] = [];

  const shiftStart = timeToMinutes(shiftStartTime);
  const shiftEnd = timeToMinutes(shiftEndTime);

  let current = shiftStart;

  while (current < shiftEnd) {
    const timeStr = minutesToTime(current);

    // Check if slot conflicts with booked appointments
    const isBooked = bookedAppointments.some((appointment) => {
      const apptStart = timeToMinutes(appointment.start_time);
      const apptEnd = timeToMinutes(appointment.end_time);
      return current >= apptStart && current < apptEnd;
    });

    // ✅ NEW: Check if slot conflicts with blocked times
    const isBlocked = blockedTimes.some((blocked) => {
      const blockedStart = timeToMinutes(blocked.start_time);
      const blockedEnd = timeToMinutes(blocked.end_time);
      return current >= blockedStart && current < blockedEnd;
    });

    // Only add slot if it's neither booked nor blocked
    if (!isBooked && !isBlocked) {
      slots.push(timeStr);
    }

    current += intervalMinutes;
  }

  return slots;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}`;
}
