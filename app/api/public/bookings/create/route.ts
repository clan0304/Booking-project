// app/api/public/bookings/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface CreateBookingRequest {
  venue_id: string;
  client_id?: string | null;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string;
  booking_date: string;
  notes?: string;
  appointments: Array<{
    service_id: string;
    team_member_id: string; // Can be 'any' or specific ID
    start_time: string;
    end_time: string;
    duration_minutes: number;
    service_name: string;
    price: number;
    notes?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateBookingRequest = await request.json();

    // Validate required fields
    if (
      !body.venue_id ||
      !body.guest_first_name ||
      !body.guest_email ||
      !body.guest_phone
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!body.appointments || body.appointments.length === 0) {
      return NextResponse.json(
        { error: 'At least one appointment is required' },
        { status: 400 }
      );
    }

    // ✅ NEW: Process appointments and assign team members for "any" selections
    const processedAppointments = [];

    for (const appt of body.appointments) {
      let finalTeamMemberId = appt.team_member_id;

      // If "any" professional was selected, find available team members
      if (appt.team_member_id === 'any') {
        const availableTeamMembers = await getAvailableTeamMembers(
          body.venue_id,
          body.booking_date,
          appt.start_time,
          appt.end_time
        );

        if (availableTeamMembers.length === 0) {
          return NextResponse.json(
            {
              error: `No team members available for time slot ${appt.start_time} - ${appt.end_time}`,
            },
            { status: 409 }
          );
        }

        // Randomly select one of the available team members
        const randomIndex = Math.floor(
          Math.random() * availableTeamMembers.length
        );
        finalTeamMemberId = availableTeamMembers[randomIndex];
      }

      processedAppointments.push({
        ...appt,
        team_member_id: finalTeamMemberId,
      });
    }

    // Check availability for all processed appointments
    for (const appt of processedAppointments) {
      const { data: isAvailable, error: availError } = await supabaseAdmin.rpc(
        'is_time_slot_available',
        {
          p_team_member_id: appt.team_member_id,
          p_date: body.booking_date,
          p_start_time: appt.start_time,
          p_end_time: appt.end_time,
        }
      );

      if (availError || !isAvailable) {
        return NextResponse.json(
          {
            error: `Time slot ${appt.start_time} - ${appt.end_time} is not available`,
          },
          { status: 409 }
        );
      }
    }

    // Calculate totals
    const total_appointments = processedAppointments.length;
    const total_price = processedAppointments.reduce(
      (sum, appt) => sum + appt.price,
      0
    );

    // Create booking group
    const { data: bookingGroup, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .insert({
        venue_id: body.venue_id,
        client_id: body.client_id || null,
        guest_first_name: body.guest_first_name,
        guest_last_name: body.guest_last_name,
        guest_email: body.guest_email,
        guest_phone: body.guest_phone,
        booking_date: body.booking_date,
        total_appointments,
        total_price,
        notes: body.notes || null,
        booking_source: 'online',
        status: 'confirmed',
      })
      .select()
      .single();

    if (bookingError || !bookingGroup) {
      console.error('Error creating booking:', bookingError);
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }

    // Create appointments with assigned team members
    const appointmentsData = processedAppointments.map((appt) => ({
      booking_group_id: bookingGroup.id,
      service_id: appt.service_id,
      team_member_id: appt.team_member_id, // Now always has a real team member ID
      start_time: appt.start_time,
      end_time: appt.end_time,
      duration_minutes: appt.duration_minutes,
      service_name: appt.service_name,
      price: appt.price,
      notes: appt.notes || null,
      status: 'confirmed',
    }));

    const { error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .insert(appointmentsData);

    if (appointmentsError) {
      console.error('Error creating appointments:', appointmentsError);
      // Rollback: delete booking group
      await supabaseAdmin
        .from('booking_groups')
        .delete()
        .eq('id', bookingGroup.id);
      return NextResponse.json(
        { error: 'Failed to create appointments' },
        { status: 500 }
      );
    }

    // TODO: Send confirmation email to guest

    return NextResponse.json(
      {
        success: true,
        data: bookingGroup,
        message: 'Booking created successfully!',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in create booking API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Get list of team member IDs who are available for a specific time slot
 */
async function getAvailableTeamMembers(
  venueId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<string[]> {
  try {
    // 1. Get all team members with shifts at this venue on this date
    const { data: shifts, error: shiftsError } = await supabaseAdmin
      .from('shifts')
      .select('team_member_id, start_time, end_time')
      .eq('venue_id', venueId)
      .eq('shift_date', date);

    if (shiftsError || !shifts || shifts.length === 0) {
      return [];
    }

    // 2. Filter team members whose shift covers the requested time slot
    const availableTeamMembers: string[] = [];

    for (const shift of shifts) {
      const shiftStart = timeToMinutes(shift.start_time);
      const shiftEnd = timeToMinutes(shift.end_time);
      const requestStart = timeToMinutes(startTime);
      const requestEnd = timeToMinutes(endTime);

      // Check if shift covers the requested time
      if (shiftStart <= requestStart && shiftEnd >= requestEnd) {
        // Check if team member has no conflicting appointments
        const { data: isAvailable } = await supabaseAdmin.rpc(
          'is_time_slot_available',
          {
            p_team_member_id: shift.team_member_id,
            p_date: date,
            p_start_time: startTime,
            p_end_time: endTime,
          }
        );

        if (isAvailable) {
          availableTeamMembers.push(shift.team_member_id);
        }
      }
    }

    return availableTeamMembers;
  } catch (error) {
    console.error('Error getting available team members:', error);
    return [];
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
