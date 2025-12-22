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
  booking_date: string;
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
  shift_date: string;
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
  blocked_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

// Team member info for display
interface TeamMemberInfo {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
}

// Response for single date (updated with team member info)
interface SingleDateResponse {
  available: boolean;
  reason: string;
  message: string;
  slots: string[];
  teamMemberSlots: Record<string, string[]>;
  teamMemberInfo: Record<string, TeamMemberInfo>; // NEW: Team member details
  slotToTeamMember: Record<string, string>; // NEW: slot -> first available team member ID
}

// Response for date range (batch mode)
interface BatchDateResponse {
  availability: Record<
    string,
    {
      available: boolean;
      slots: string[];
    }
  >;
}

/**
 * GET /api/public/bookings/availability/combined
 *
 * Supports TWO modes:
 * 1. Single date (backward compatible): ?date=2025-12-09&venue_id=xxx
 * 2. Batch date range: ?start_date=2025-12-09&end_date=2025-12-15&venue_id=xxx
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const venueId = searchParams.get('venue_id');
  const singleDate = searchParams.get('date');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  if (!venueId) {
    return NextResponse.json({ error: 'Missing venue_id' }, { status: 400 });
  }

  // Mode 1: Single date request
  if (singleDate) {
    return handleSingleDateRequest(venueId, singleDate);
  }

  // Mode 2: Batch date range request
  if (startDate && endDate) {
    return handleBatchDateRequest(venueId, startDate, endDate);
  }

  return NextResponse.json(
    { error: 'Missing date or date range parameters' },
    { status: 400 }
  );
}

/**
 * Handle batch date range request
 */
async function handleBatchDateRequest(
  venueId: string,
  startDate: string,
  endDate: string
): Promise<NextResponse<BatchDateResponse | { error: string }>> {
  // Generate array of dates in range
  const dates: string[] = [];
  const currentDate = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Fetch all closed days in range
  const { data: closedDays } = await supabaseAdmin
    .from('venue_closed_days')
    .select('closed_date')
    .eq('venue_id', venueId)
    .gte('closed_date', startDate)
    .lte('closed_date', endDate);

  const closedDatesSet = new Set(
    (closedDays || []).map((d) => d.closed_date as string)
  );

  // Fetch all shifts in range
  const { data: shifts } = await supabaseAdmin
    .from('shifts')
    .select('id, team_member_id, shift_date, start_time, end_time, notes')
    .eq('venue_id', venueId)
    .gte('shift_date', startDate)
    .lte('shift_date', endDate);

  const shiftsByDate = new Map<string, Shift[]>();
  (shifts || []).forEach((shift) => {
    const typedShift = shift as Shift;
    const existing = shiftsByDate.get(typedShift.shift_date) || [];
    existing.push(typedShift);
    shiftsByDate.set(typedShift.shift_date, existing);
  });

  // Fetch all appointments in range
  const { data: appointments } = await supabaseAdmin
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
    .gte('booking_groups.booking_date', startDate)
    .lte('booking_groups.booking_date', endDate)
    .neq('status', 'cancelled');

  const appointmentsByDate = new Map<string, AppointmentWithBookingGroup[]>();
  ((appointments || []) as RawAppointmentFromDB[]).forEach((appt) => {
    const bookingGroup = Array.isArray(appt.booking_groups)
      ? appt.booking_groups[0]
      : appt.booking_groups;
    const date = bookingGroup.booking_date;
    const existing = appointmentsByDate.get(date) || [];
    existing.push({
      id: appt.id,
      team_member_id: appt.team_member_id,
      start_time: appt.start_time,
      end_time: appt.end_time,
      service_name: appt.service_name,
      status: appt.status,
      booking_date: date,
      booking_groups: bookingGroup,
    });
    appointmentsByDate.set(date, existing);
  });

  // Fetch all blocked times in range
  const { data: blockedTimes } = await supabaseAdmin
    .from('blocked_times')
    .select('id, team_member_id, blocked_date, start_time, end_time, reason')
    .eq('venue_id', venueId)
    .gte('blocked_date', startDate)
    .lte('blocked_date', endDate);

  const blockedByDate = new Map<string, BlockedTime[]>();
  ((blockedTimes || []) as BlockedTime[]).forEach((blocked) => {
    const existing = blockedByDate.get(blocked.blocked_date) || [];
    existing.push(blocked);
    blockedByDate.set(blocked.blocked_date, existing);
  });

  // Build availability for each date
  const availability: Record<string, { available: boolean; slots: string[] }> =
    {};

  for (const date of dates) {
    // Check if venue is closed
    if (closedDatesSet.has(date)) {
      availability[date] = { available: false, slots: [] };
      continue;
    }

    // Get shifts for this date
    const dayShifts = shiftsByDate.get(date) || [];
    if (dayShifts.length === 0) {
      availability[date] = { available: false, slots: [] };
      continue;
    }

    // Get appointments and blocked times for this date
    const dayAppointments = appointmentsByDate.get(date) || [];
    const dayBlocked = blockedByDate.get(date) || [];

    // Generate slots for each team member
    const allSlots = new Set<string>();

    for (const shift of dayShifts) {
      // Get this team member's appointments
      const memberAppointments = dayAppointments.filter(
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

      // Get this team member's blocked times
      const memberBlocked = dayBlocked.filter(
        (b) => b.team_member_id === shift.team_member_id
      );

      // Generate available slots
      const slots = generateAvailableSlots(
        shift.start_time,
        shift.end_time,
        bookedSlots,
        memberBlocked,
        30
      );

      slots.forEach((slot) => allSlots.add(slot));
    }

    availability[date] = {
      available: allSlots.size > 0,
      slots: Array.from(allSlots).sort(),
    };
  }

  return NextResponse.json({ availability });
}

/**
 * Handle single date request (updated with team member info)
 */
async function handleSingleDateRequest(
  venueId: string,
  date: string
): Promise<NextResponse<SingleDateResponse | { error: string }>> {
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
      teamMemberInfo: {},
      slotToTeamMember: {},
    });
  }

  // 2. Get all shifts for this venue on this date (with team member info)
  const { data: shifts, error: shiftsError } = await supabaseAdmin
    .from('shifts')
    .select(
      `
      id, 
      team_member_id, 
      shift_date, 
      start_time, 
      end_time, 
      notes,
      users!shifts_team_member_id_fkey(
        id,
        first_name,
        last_name,
        photo_url
      )
    `
    )
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
      teamMemberInfo: {},
      slotToTeamMember: {},
    });
  }

  // Extract team member info
  const teamMemberInfo: Record<string, TeamMemberInfo> = {};
  const typedShifts: Shift[] = [];

  for (const shift of shifts) {
    const shiftData = shift as Shift & {
      users: TeamMemberInfo | TeamMemberInfo[];
    };

    typedShifts.push({
      id: shiftData.id,
      team_member_id: shiftData.team_member_id,
      shift_date: shiftData.shift_date,
      start_time: shiftData.start_time,
      end_time: shiftData.end_time,
      notes: shiftData.notes,
    });

    // Store team member info
    const userInfo = Array.isArray(shiftData.users)
      ? shiftData.users[0]
      : shiftData.users;
    if (userInfo) {
      teamMemberInfo[shiftData.team_member_id] = {
        id: userInfo.id,
        first_name: userInfo.first_name,
        last_name: userInfo.last_name,
        photo_url: userInfo.photo_url,
      };
    }
  }

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

  const typedAppointments: AppointmentWithBookingGroup[] = rawAppointments.map(
    (appt) => ({
      id: appt.id,
      team_member_id: appt.team_member_id,
      start_time: appt.start_time,
      end_time: appt.end_time,
      service_name: appt.service_name,
      status: appt.status,
      booking_date: date,
      booking_groups: Array.isArray(appt.booking_groups)
        ? appt.booking_groups[0]
        : appt.booking_groups,
    })
  );

  // 4. Get all blocked times for this venue on this date
  const { data: blockedTimes, error: blockedError } = await supabaseAdmin
    .from('blocked_times')
    .select('id, team_member_id, blocked_date, start_time, end_time, reason')
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

  // NEW: Track which team member has each slot (for auto-assignment)
  const slotToTeamMember: Record<string, string> = {};

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

    // Get this team member's blocked times
    const memberBlockedTimes = typedBlockedTimes.filter(
      (blocked) => blocked.team_member_id === shift.team_member_id
    );

    // Generate available slots for this team member
    const slots = generateAvailableSlots(
      shift.start_time,
      shift.end_time,
      bookedSlots,
      memberBlockedTimes,
      30
    );

    teamMemberSlots[shift.team_member_id] = slots;

    // Add all slots to the set and track first available team member for each slot
    slots.forEach((slot) => {
      allPossibleSlots.add(slot);

      // Only set if not already set (first team member with this slot wins)
      if (!slotToTeamMember[slot]) {
        slotToTeamMember[slot] = shift.team_member_id;
      }
    });
  }

  // 6. Convert set to sorted array
  const combinedSlots = Array.from(allPossibleSlots).sort();

  return NextResponse.json({
    available: combinedSlots.length > 0,
    reason: combinedSlots.length > 0 ? 'available' : 'fully_booked',
    message:
      combinedSlots.length > 0
        ? `${combinedSlots.length} time slots available`
        : 'All time slots are booked',
    slots: combinedSlots,
    teamMemberSlots,
    teamMemberInfo,
    slotToTeamMember,
  });
}

/**
 * Generate available time slots for a shift
 * Excludes booked appointments and blocked times
 */
function generateAvailableSlots(
  shiftStart: string,
  shiftEnd: string,
  bookedSlots: BookedSlot[],
  blockedTimes: BlockedTime[],
  intervalMinutes: number
): string[] {
  const slots: string[] = [];

  // Parse shift times
  const [startHour, startMin] = shiftStart.split(':').map(Number);
  const [endHour, endMin] = shiftEnd.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  const shiftEndMinutes = endHour * 60 + endMin;

  while (currentMinutes < shiftEndMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const minute = currentMinutes % 60;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0'
    )}`;

    // Check if this slot overlaps with any booking
    const isBooked = bookedSlots.some((booking) => {
      const [bookStartHour, bookStartMin] = booking.start_time
        .split(':')
        .map(Number);
      const [bookEndHour, bookEndMin] = booking.end_time.split(':').map(Number);
      const bookStart = bookStartHour * 60 + bookStartMin;
      const bookEnd = bookEndHour * 60 + bookEndMin;
      return currentMinutes >= bookStart && currentMinutes < bookEnd;
    });

    // Check if this slot overlaps with any blocked time
    const isBlocked = blockedTimes.some((blocked) => {
      const [blockStartHour, blockStartMin] = blocked.start_time
        .split(':')
        .map(Number);
      const [blockEndHour, blockEndMin] = blocked.end_time
        .split(':')
        .map(Number);
      const blockStart = blockStartHour * 60 + blockStartMin;
      const blockEnd = blockEndHour * 60 + blockEndMin;
      return currentMinutes >= blockStart && currentMinutes < blockEnd;
    });

    if (!isBooked && !isBlocked) {
      slots.push(timeStr);
    }

    currentMinutes += intervalMinutes;
  }

  return slots;
}
