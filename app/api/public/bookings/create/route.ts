// app/api/public/bookings/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface CreateBookingRequest {
  venue_id: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string;
  booking_date: string;
  notes?: string;
  appointments: Array<{
    service_id: string;
    variant_id?: string | null;
    team_member_id: string;
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

    // Check availability for all appointments
    for (const appt of body.appointments) {
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
    const total_appointments = body.appointments.length;
    const total_price = body.appointments.reduce(
      (sum, appt) => sum + appt.price,
      0
    );

    // Create booking group
    const { data: bookingGroup, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .insert({
        venue_id: body.venue_id,
        client_id: null, // Public booking, no client_id
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

    // Create appointments
    const appointmentsData = body.appointments.map((appt) => ({
      booking_group_id: bookingGroup.id,
      service_id: appt.service_id,
      variant_id: appt.variant_id || null,
      team_member_id: appt.team_member_id,
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
