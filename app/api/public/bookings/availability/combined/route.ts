// app/api/public/bookings/availability/combined/route.ts
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
  team_member_id: string;
  start_time: string;
  end_time: string;
  service_name: string;
  status: string;
  booking_groups: BookingGroupData[] | BookingGroupData;
}

interface AppointmentWithBookingGroup {
  id: string;
  team_member_id: string;
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
  team_member_id: string;
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
  team_member_id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

/**
 * GET /api/public/bookings/availability/combined
 * Returns combined availability across ALL team members at a venue
 * Used when customer selects "Any professional"
 * ✅ UPDATED: Now excludes blocked times from availability
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const venueId = searchParams.get('venue_id');

    if (!date || !venueId) {
      return NextResponse.json(
        { error: 'Missing date or venue_id parameter' },
        { status: 400 }
      );
    }

    // 1. Check if venue is closed on this date
    const { data: closedDays } = await supabaseAdmin
      .from('venue_closed_days')
      .select('closed_date, reason')
      .eq('venue_id', venueId)
      .eq('closed_date', date)
      .maybeSingle();

    if (closedDays) {
      const typedClosedDay = closedDays as VenueClosedDay;
      return NextResponse.json({
        available: false,
        reason: 'venue_closed',
        message: `Venue is closed: ${
          typedClosedDay.reason || 'No reason provided'
        }`,
        slots: [],
        teamMemberSlots: {},
      });
    }

    // 2. Get all shifts for this venue on this date
    const { data: shifts, error: shiftsError } = await supabaseAdmin
      .from('shifts')
      .select('id, team_member_id, start_time, end_time, notes')
      .eq('venue_id', venueId)
      .eq('shift_date', date);

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      return NextResponse.json(
        { error: 'Failed to fetch shifts' },
        { status: 500 }
      );
    }

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({
        available: false,
        reason: 'no_shifts',
        message: 'No team members are scheduled to work on this date',
        slots: [],
        teamMemberSlots: {},
      });
    }

    const typedShifts = shifts as Shift[];

    // 3. Get all appointments for this venue on this date
    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select(
        `
        id,
        team_member_id,
        start_time,
        end_time,
        service_name,
        status,
        booking_groups!inner(booking_date, guest_first_name, guest_last_name, venue_id)
      `
      )
      .eq('booking_groups.venue_id', venueId)
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

    const typedAppointments: AppointmentWithBookingGroup[] =
      rawAppointments.map((appt) => ({
        id: appt.id,
        team_member_id: appt.team_member_id,
        start_time: appt.start_time,
        end_time: appt.end_time,
        service_name: appt.service_name,
        status: appt.status,
        booking_groups: Array.isArray(appt.booking_groups)
          ? appt.booking_groups[0]
          : appt.booking_groups,
      }));

    // 4. ✅ NEW: Get all blocked times for this venue on this date
    const { data: blockedTimes, error: blockedError } = await supabaseAdmin
      .from('blocked_times')
      .select('id, team_member_id, start_time, end_time, reason')
      .eq('venue_id', venueId)
      .eq('blocked_date', date);

    if (blockedError) {
      console.error('Error fetching blocked times:', blockedError);
      return NextResponse.json(
        { error: 'Failed to fetch blocked times' },
        { status: 500 }
      );
    }

    const typedBlockedTimes = (blockedTimes || []) as BlockedTime[];

    // 5. Generate available slots for each team member
    const teamMemberSlots: Record<string, string[]> = {};
    const allPossibleSlots = new Set<string>();

    for (const shift of typedShifts) {
      // Get this team member's appointments
      const memberAppointments = typedAppointments.filter(
        (appt) => appt.team_member_id === shift.team_member_id
      );

      const bookedSlots: BookedSlot[] = memberAppointments.map((appt) => ({
        appointment_id: appt.id,
        start_time: appt.start_time,
        end_time: appt.end_time,
        service_name: appt.service_name,
        client_name: `${appt.booking_groups.guest_first_name} ${
          appt.booking_groups.guest_last_name || ''
        }`.trim(),
        status: appt.status,
      }));

      // ✅ NEW: Get this team member's blocked times
      const memberBlockedTimes = typedBlockedTimes.filter(
        (blocked) => blocked.team_member_id === shift.team_member_id
      );

      // Generate available slots for this team member (excluding appointments AND blocked times)
      const slots = generateAvailableSlots(
        shift.start_time,
        shift.end_time,
        bookedSlots,
        memberBlockedTimes, // ✅ NEW: Pass blocked times
        30 // 30-minute intervals
      );

      teamMemberSlots[shift.team_member_id] = slots;

      // Add all slots to the set of possible slots
      slots.forEach((slot) => allPossibleSlots.add(slot));
    }

    // 6. Convert set to sorted array
    const combinedSlots = Array.from(allPossibleSlots).sort();

    return NextResponse.json({
      available: combinedSlots.length > 0,
      reason: combinedSlots.length > 0 ? 'available' : 'fully_booked',
      message:
        combinedSlots.length > 0
          ? `${combinedSlots.length} time slots available across ${typedShifts.length} team members`
          : 'All team members are fully booked or blocked for this date',
      slots: combinedSlots,
      teamMemberSlots, // Which team members are available for each slot
    });
  } catch (error) {
    console.error('Error in combined availability API:', error);
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
  shiftStart: string,
  shiftEnd: string,
  bookedSlots: BookedSlot[],
  blockedTimes: BlockedTime[], // ✅ NEW parameter
  intervalMinutes: number
): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const [endHour, endMin] = shiftEnd.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  for (
    let minutes = startMinutes;
    minutes < endMinutes;
    minutes += intervalMinutes
  ) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    const timeSlot = `${hour.toString().padStart(2, '0')}:${min
      .toString()
      .padStart(2, '0')}`;

    // Check if this slot overlaps with any booked appointment
    const isBooked = bookedSlots.some((booked) => {
      const bookedStart = timeToMinutes(booked.start_time);
      const bookedEnd = timeToMinutes(booked.end_time);
      return minutes >= bookedStart && minutes < bookedEnd;
    });

    // ✅ NEW: Check if this slot overlaps with any blocked time
    const isBlocked = blockedTimes.some((blocked) => {
      const blockedStart = timeToMinutes(blocked.start_time);
      const blockedEnd = timeToMinutes(blocked.end_time);
      return minutes >= blockedStart && minutes < blockedEnd;
    });

    // Only add slot if it's neither booked nor blocked
    if (!isBooked && !isBlocked) {
      slots.push(timeSlot);
    }
  }

  return slots;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
