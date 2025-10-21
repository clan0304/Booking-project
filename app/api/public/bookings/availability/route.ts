// app/api/public/bookings/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface BookingGroupData {
  booking_date: string;
  guest_first_name: string;
  guest_last_name: string | null;
  venue_id: string; // ✅ ADDED
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

    // Check for overlaps
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

    return NextResponse.json({
      available: !hasConflict,
    });
  } catch (error) {
    console.error('Error in availability API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// app/api/public/bookings/availability/route.ts
// FIXED: Added venue_id filtering to shift query

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

    // 1. Check if venue is closed on this date (if venueId provided)
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

    // 2. Get team member's shift for this date from shifts table
    // ✅ FIXED: Added venue_id filter to ensure only this venue's shifts are checked
    let shiftQuery = supabaseAdmin
      .from('shifts')
      .select('id, start_time, end_time, notes')
      .eq('team_member_id', teamMemberId)
      .eq('shift_date', date);

    // Only filter by venue if venueId is provided
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

    // If no shift, team member is not working that day AT THIS VENUE
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

    // 3. Get team member's existing appointments for this date
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

    // Format appointments for response
    const rawAppointments = (appointments || []) as RawAppointmentFromDB[];

    // ✅ ADDED: Filter appointments by venue if venueId provided
    let filteredAppointments = rawAppointments;
    if (venueId) {
      filteredAppointments = rawAppointments.filter((appt) => {
        const bookingGroup = Array.isArray(appt.booking_groups)
          ? appt.booking_groups[0]
          : appt.booking_groups;
        return bookingGroup.venue_id === venueId;
      });
    }

    // Transform to ensure booking_groups is a single object
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

    // 4. Generate available time slots based on shift hours and existing appointments
    const slots = generateAvailableSlots(
      typedShift.start_time,
      typedShift.end_time,
      bookedSlots,
      30 // 30-minute intervals
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
 * Generate available time slots within shift hours, excluding booked appointments
 */
function generateAvailableSlots(
  shiftStartTime: string,
  shiftEndTime: string,
  bookedAppointments: BookedSlot[],
  intervalMinutes: number
): string[] {
  const slots: string[] = [];

  const shiftStart = timeToMinutes(shiftStartTime);
  const shiftEnd = timeToMinutes(shiftEndTime);

  let current = shiftStart;

  while (current < shiftEnd) {
    const timeStr = minutesToTime(current);

    // Check if this slot conflicts with any booked appointments
    const isBooked = bookedAppointments.some((appointment) => {
      const apptStart = timeToMinutes(appointment.start_time);
      const apptEnd = timeToMinutes(appointment.end_time);
      // Check if slot overlaps with appointment
      return current >= apptStart && current < apptEnd;
    });

    if (!isBooked) {
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
