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
  payment_method_id?: string | null;
  appointments: Array<{
    service_id: string;
    team_member_id: string | null;
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

    console.log('Creating booking with data:', JSON.stringify(body, null, 2));

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

    // Process appointments and assign team members for "any" selections
    const processedAppointments = [];

    for (const appt of body.appointments) {
      let finalTeamMemberId = appt.team_member_id;

      // Handle null, undefined, empty string, AND 'any'
      if (!appt.team_member_id || appt.team_member_id === 'any') {
        console.log(
          `Finding available team member for slot ${appt.start_time} - ${appt.end_time}`
        );

        const availableTeamMembers = await getAvailableTeamMembers(
          body.venue_id,
          body.booking_date,
          appt.start_time,
          appt.end_time
        );

        console.log(
          `Found ${availableTeamMembers.length} available team members:`,
          availableTeamMembers
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

        console.log(`Assigned team member: ${finalTeamMemberId}`);
      }

      // Double-check we have a valid team_member_id
      if (!finalTeamMemberId) {
        return NextResponse.json(
          {
            error: `Could not assign a team member for ${
              appt.service_name || 'service'
            }`,
          },
          { status: 409 }
        );
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

      if (availError) {
        console.error('Error checking availability:', availError);
      }

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
      console.error('Error creating booking group:', bookingError);
      return NextResponse.json(
        { error: 'Failed to create booking', details: bookingError?.message },
        { status: 500 }
      );
    }

    // Create appointments with all required fields
    const appointmentsData = processedAppointments.map((appt) => ({
      booking_group_id: bookingGroup.id,
      service_id: appt.service_id,
      team_member_id: appt.team_member_id,
      start_time: appt.start_time,
      end_time: appt.end_time,
      duration_minutes: appt.duration_minutes,
      service_name: appt.service_name, // Required field
      price: appt.price,
      notes: appt.notes || null,
      status: 'confirmed',
    }));

    console.log(
      'Inserting appointments:',
      JSON.stringify(appointmentsData, null, 2)
    );

    const { error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .insert(appointmentsData);

    if (appointmentsError) {
      console.error('Error creating appointments:', appointmentsError);
      console.error(
        'Appointment data:',
        JSON.stringify(appointmentsData, null, 2)
      );

      // Rollback: delete booking group
      await supabaseAdmin
        .from('booking_groups')
        .delete()
        .eq('id', bookingGroup.id);

      return NextResponse.json(
        {
          error: 'Failed to create appointments',
          details: appointmentsError.message,
        },
        { status: 500 }
      );
    }

    console.log('Booking created successfully:', bookingGroup.id);

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
      {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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
    console.log('Getting available team members for:', {
      venueId,
      date,
      startTime,
      endTime,
    });

    // 1. Get all team members with shifts at this venue on this date
    const { data: shifts, error: shiftsError } = await supabaseAdmin
      .from('shifts')
      .select('team_member_id, start_time, end_time')
      .eq('venue_id', venueId)
      .eq('shift_date', date);

    console.log(`Found ${shifts?.length || 0} shifts for this date:`, shifts);

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      return [];
    }

    if (!shifts || shifts.length === 0) {
      console.log('No shifts found for this date');
      return [];
    }

    // 2. Filter team members whose shift covers the requested time slot
    const availableTeamMembers: string[] = [];

    for (const shift of shifts) {
      const shiftStart = timeToMinutes(shift.start_time);
      const shiftEnd = timeToMinutes(shift.end_time);
      const requestStart = timeToMinutes(startTime);
      const requestEnd = timeToMinutes(endTime);

      const coversSlot = shiftStart <= requestStart && shiftEnd >= requestEnd;

      console.log('Checking shift:', {
        team_member_id: shift.team_member_id,
        shiftTime: `${shift.start_time} - ${shift.end_time}`,
        requestTime: `${startTime} - ${endTime}`,
        coversSlot,
      });

      // Check if shift covers the requested time
      if (coversSlot) {
        // Check if team member has no conflicting appointments
        const { data: isAvailable, error: rpcError } = await supabaseAdmin.rpc(
          'is_time_slot_available',
          {
            p_team_member_id: shift.team_member_id,
            p_date: date,
            p_start_time: startTime,
            p_end_time: endTime,
          }
        );

        if (rpcError) {
          console.error(
            `RPC error for team member ${shift.team_member_id}:`,
            rpcError
          );
        }

        console.log(
          `Team member ${shift.team_member_id} availability:`,
          isAvailable
        );

        if (isAvailable) {
          availableTeamMembers.push(shift.team_member_id);
        }
      }
    }

    console.log('Final available team members:', availableTeamMembers);
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
