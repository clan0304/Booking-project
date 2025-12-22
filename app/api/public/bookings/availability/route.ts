// app/api/public/bookings/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

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

// =====================================================
// NEW: Booking Hold Interface
// =====================================================
interface BookingHold {
  id: string;
  start_time: string;
  end_time: string;
  user_id: string | null;
  expires_at: string;
}

// =====================================================
// HELPER: Get current user's internal ID
// =====================================================
async function getCurrentUserInternalId(): Promise<string | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    return user?.id || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

// =====================================================
// HELPER: Fetch active booking holds for a team member
// =====================================================
async function getActiveHoldsForTeamMember(
  venueId: string,
  teamMemberId: string,
  date: string,
  excludeUserId?: string | null
): Promise<BookingHold[]> {
  try {
    let query = supabaseAdmin
      .from('booking_holds')
      .select('id, start_time, end_time, user_id, expires_at')
      .eq('venue_id', venueId)
      .eq('team_member_id', teamMemberId)
      .eq('hold_date', date)
      .gt('expires_at', new Date().toISOString()); // Only non-expired holds

    // Exclude current user's holds (they can overwrite their own holds)
    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching booking holds:', error);
      return [];
    }

    return (data || []) as BookingHold[];
  } catch (error) {
    console.error('Error in getActiveHoldsForTeamMember:', error);
    return [];
  }
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
    const { data: conflictingAppointments, error: appointmentError } =
      await supabaseAdmin
        .from('appointments')
        .select(
          `
        id,
        start_time,
        end_time,
        booking_groups!inner(booking_date)
      `
        )
        .eq('team_member_id', team_member_id)
        .eq('booking_groups.booking_date', date)
        .neq('status', 'cancelled');

    if (appointmentError) {
      console.error('Error checking appointments:', appointmentError);
      return NextResponse.json(
        { error: 'Failed to check availability' },
        { status: 500 }
      );
    }

    // Check for overlaps with existing appointments
    const hasConflict = (conflictingAppointments || []).some(
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

    // Check for overlaps with blocked times
    const { data: blockedTimes, error: blockedError } = await supabaseAdmin
      .from('blocked_times')
      .select('start_time, end_time')
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

    // NEW: Support for date range (batch mode)
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!teamMemberId) {
      return NextResponse.json(
        { error: 'Missing required parameter: team_member_id' },
        { status: 400 }
      );
    }

    // Get current user's internal ID to exclude their own holds
    const currentUserId = await getCurrentUserInternalId();

    // Handle batch mode (date range)
    if (startDate && endDate && venueId) {
      return handleBatchRequest(
        teamMemberId,
        venueId,
        startDate,
        endDate,
        currentUserId
      );
    }

    // Handle single date mode
    if (!date) {
      return NextResponse.json(
        { error: 'Missing required parameter: date' },
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
          ? 'Team member is not scheduled at this venue on this date'
          : 'Team member is not scheduled on this date',
        slots: [],
        shift: null,
      });
    }

    const typedShift = shift as Shift;

    // 3. Get all appointments for this team member on this date
    const { data: appointments, error: appointmentError } = await supabaseAdmin
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

    if (appointmentError) {
      console.error('Error fetching appointments:', appointmentError);
      return NextResponse.json(
        { error: 'Failed to fetch appointments' },
        { status: 500 }
      );
    }

    const rawAppointments = (appointments || []) as RawAppointmentFromDB[];
    const typedAppointments: AppointmentWithBookingGroup[] =
      rawAppointments.map((appt) => ({
        ...appt,
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

    // 4. Get blocked times for this team member on this date
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

    // =====================================================
    // 5. NEW: Get booking holds for this team member on this date
    // =====================================================
    let bookingHolds: BookingHold[] = [];
    if (venueId) {
      bookingHolds = await getActiveHoldsForTeamMember(
        venueId,
        teamMemberId,
        date,
        currentUserId
      );
    }

    // 6. Generate available slots (excluding both appointments, blocked times, AND holds)
    const slots = generateAvailableSlots(
      typedShift.start_time,
      typedShift.end_time,
      bookedSlots,
      typedBlockedTimes,
      bookingHolds, // NEW: Pass booking holds
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
      blocked: typedBlockedTimes,
    });
  } catch (error) {
    console.error('Error in availability GET API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Types for batch request
interface BatchAppointment {
  start_time: string;
  end_time: string;
  booking_groups: { booking_date: string } | Array<{ booking_date: string }>;
}

interface BatchShift {
  shift_date: string;
  start_time: string;
  end_time: string;
}

interface BatchBlockedTime {
  blocked_date: string;
  start_time: string;
  end_time: string;
}

interface BatchBookingHold {
  hold_date: string;
  start_time: string;
  end_time: string;
  user_id: string | null;
}

/**
 * Handle batch request for date range (specific team member)
 */
async function handleBatchRequest(
  teamMemberId: string,
  venueId: string,
  startDate: string,
  endDate: string,
  currentUserId: string | null
): Promise<NextResponse> {
  // Generate array of dates in range
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  // 1. Fetch closed days
  const { data: closedDays } = await supabaseAdmin
    .from('venue_closed_days')
    .select('closed_date')
    .eq('venue_id', venueId)
    .gte('closed_date', startDate)
    .lte('closed_date', endDate);

  const closedDatesSet = new Set(
    (closedDays || []).map((d: { closed_date: string }) => d.closed_date)
  );

  // 2. Fetch shifts for this team member
  const { data: shifts } = await supabaseAdmin
    .from('shifts')
    .select('shift_date, start_time, end_time')
    .eq('team_member_id', teamMemberId)
    .eq('venue_id', venueId)
    .gte('shift_date', startDate)
    .lte('shift_date', endDate);

  const typedShifts = (shifts || []) as BatchShift[];
  const shiftsByDate = new Map<
    string,
    { start_time: string; end_time: string }
  >();
  for (const shift of typedShifts) {
    shiftsByDate.set(shift.shift_date, {
      start_time: shift.start_time,
      end_time: shift.end_time,
    });
  }

  // 3. Fetch appointments
  const { data: appointments } = await supabaseAdmin
    .from('appointments')
    .select(
      `
      start_time,
      end_time,
      booking_groups!inner(booking_date)
    `
    )
    .eq('team_member_id', teamMemberId)
    .eq('booking_groups.venue_id', venueId)
    .gte('booking_groups.booking_date', startDate)
    .lte('booking_groups.booking_date', endDate)
    .neq('status', 'cancelled');

  const typedAppointments = (appointments || []) as BatchAppointment[];
  const appointmentsByDate = new Map<
    string,
    Array<{ start_time: string; end_time: string }>
  >();
  for (const appt of typedAppointments) {
    const bookingDate = Array.isArray(appt.booking_groups)
      ? appt.booking_groups[0].booking_date
      : appt.booking_groups.booking_date;

    const existing = appointmentsByDate.get(bookingDate) || [];
    existing.push({ start_time: appt.start_time, end_time: appt.end_time });
    appointmentsByDate.set(bookingDate, existing);
  }

  // 4. Fetch blocked times
  const { data: blockedTimes } = await supabaseAdmin
    .from('blocked_times')
    .select('blocked_date, start_time, end_time')
    .eq('team_member_id', teamMemberId)
    .eq('venue_id', venueId)
    .gte('blocked_date', startDate)
    .lte('blocked_date', endDate);

  const typedBlockedTimes = (blockedTimes || []) as BatchBlockedTime[];
  const blockedByDate = new Map<
    string,
    Array<{ start_time: string; end_time: string }>
  >();
  for (const blocked of typedBlockedTimes) {
    const existing = blockedByDate.get(blocked.blocked_date) || [];
    existing.push({
      start_time: blocked.start_time,
      end_time: blocked.end_time,
    });
    blockedByDate.set(blocked.blocked_date, existing);
  }

  // =====================================================
  // 5. NEW: Fetch booking holds for this team member
  // =====================================================
  let holdsQuery = supabaseAdmin
    .from('booking_holds')
    .select('hold_date, start_time, end_time, user_id')
    .eq('venue_id', venueId)
    .eq('team_member_id', teamMemberId)
    .gte('hold_date', startDate)
    .lte('hold_date', endDate)
    .gt('expires_at', new Date().toISOString());

  if (currentUserId) {
    holdsQuery = holdsQuery.neq('user_id', currentUserId);
  }

  const { data: bookingHolds } = await holdsQuery;

  const typedHolds = (bookingHolds || []) as BatchBookingHold[];
  const holdsByDate = new Map<
    string,
    Array<{ start_time: string; end_time: string }>
  >();
  for (const hold of typedHolds) {
    const existing = holdsByDate.get(hold.hold_date) || [];
    existing.push({ start_time: hold.start_time, end_time: hold.end_time });
    holdsByDate.set(hold.hold_date, existing);
  }

  // 6. Build availability for each date
  const availability: Record<string, { available: boolean; slots: string[] }> =
    {};

  for (const date of dates) {
    // Check if venue is closed
    if (closedDatesSet.has(date)) {
      availability[date] = { available: false, slots: [] };
      continue;
    }

    // Check if team member has shift
    const shift = shiftsByDate.get(date);
    if (!shift) {
      availability[date] = { available: false, slots: [] };
      continue;
    }

    // Get appointments, blocked times, and holds for this date
    const dayAppointments = appointmentsByDate.get(date) || [];
    const dayBlocked = blockedByDate.get(date) || [];
    const dayHolds = holdsByDate.get(date) || [];

    // Generate available slots
    const slots = generateAvailableSlotsSimple(
      shift.start_time,
      shift.end_time,
      dayAppointments,
      dayBlocked,
      dayHolds,
      30
    );

    availability[date] = {
      available: slots.length > 0,
      slots,
    };
  }

  return NextResponse.json({ availability });
}

/**
 * Generate available time slots excluding appointments, blocked times, AND booking holds
 */
function generateAvailableSlots(
  shiftStartTime: string,
  shiftEndTime: string,
  bookedAppointments: BookedSlot[],
  blockedTimes: BlockedTime[],
  bookingHolds: BookingHold[], // NEW parameter
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

    // Check if slot conflicts with blocked times
    const isBlocked = blockedTimes.some((blocked) => {
      const blockedStart = timeToMinutes(blocked.start_time);
      const blockedEnd = timeToMinutes(blocked.end_time);
      return current >= blockedStart && current < blockedEnd;
    });

    // NEW: Check if slot conflicts with booking holds
    const isHeld = bookingHolds.some((hold) => {
      const holdStart = timeToMinutes(hold.start_time);
      const holdEnd = timeToMinutes(hold.end_time);
      return current >= holdStart && current < holdEnd;
    });

    // Only add slot if it's neither booked, blocked, nor held
    if (!isBooked && !isBlocked && !isHeld) {
      slots.push(timeStr);
    }

    current += intervalMinutes;
  }

  return slots;
}

/**
 * Simplified version for batch mode (without full interfaces)
 */
function generateAvailableSlotsSimple(
  shiftStartTime: string,
  shiftEndTime: string,
  bookedAppointments: Array<{ start_time: string; end_time: string }>,
  blockedTimes: Array<{ start_time: string; end_time: string }>,
  bookingHolds: Array<{ start_time: string; end_time: string }>,
  intervalMinutes: number
): string[] {
  const slots: string[] = [];

  const shiftStart = timeToMinutes(shiftStartTime);
  const shiftEnd = timeToMinutes(shiftEndTime);

  let current = shiftStart;

  while (current < shiftEnd) {
    const timeStr = minutesToTime(current);

    const isBooked = bookedAppointments.some((appt) => {
      const apptStart = timeToMinutes(appt.start_time);
      const apptEnd = timeToMinutes(appt.end_time);
      return current >= apptStart && current < apptEnd;
    });

    const isBlocked = blockedTimes.some((blocked) => {
      const blockedStart = timeToMinutes(blocked.start_time);
      const blockedEnd = timeToMinutes(blocked.end_time);
      return current >= blockedStart && current < blockedEnd;
    });

    const isHeld = bookingHolds.some((hold) => {
      const holdStart = timeToMinutes(hold.start_time);
      const holdEnd = timeToMinutes(hold.end_time);
      return current >= holdStart && current < holdEnd;
    });

    if (!isBooked && !isBlocked && !isHeld) {
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
