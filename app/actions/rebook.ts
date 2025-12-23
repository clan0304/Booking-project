// app/actions/rebook.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { detectClientType } from '@/lib/client-type-helpers';

// =====================================================
// TYPES
// =====================================================

interface RebookService {
  serviceId: string;
  serviceName: string;
  duration: number;
  price: number;
  categoryColor?: string | null;
}

interface RebookClient {
  clientId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

interface CreateRebookingData {
  venueId: string;
  teamMemberId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  services: RebookService[];
  client: RebookClient;
  originalBookingId?: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins
    .toString()
    .padStart(2, '0')}`;
}

// =====================================================
// CREATE REBOOKING
// =====================================================

export async function createRebooking(data: CreateRebookingData): Promise<{
  success: boolean;
  bookingId?: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    const { venueId, teamMemberId, date, startTime, services, client } = data;

    // Validate services
    if (!services || services.length === 0) {
      return { success: false, error: 'At least one service is required' };
    }

    // Calculate total duration and price
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

    // Detect client type for commission tracking
    let clientType = null;
    if (client.clientId) {
      clientType = await detectClientType(client.clientId, teamMemberId);
    }

    // Create booking group
    const { data: bookingGroup, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .insert({
        venue_id: venueId,
        client_id: client.clientId,
        guest_first_name: client.firstName,
        guest_last_name: client.lastName,
        guest_email: client.email,
        guest_phone: client.phone,
        booking_date: date,
        total_appointments: services.length,
        total_price: totalPrice,
        status: 'confirmed',
        booking_source: 'admin',
        client_type: clientType,
        notes: `Rebooked (${totalDuration} min total)`,
      })
      .select('id')
      .single();

    if (bookingError || !bookingGroup) {
      console.error('Error creating booking group:', bookingError);
      return { success: false, error: 'Failed to create booking' };
    }

    // Create appointments for each service
    let currentTime = startTime;
    const appointments = [];

    for (const service of services) {
      const endTime = addMinutesToTime(currentTime, service.duration);

      appointments.push({
        booking_group_id: bookingGroup.id,
        service_id: service.serviceId,
        service_name: service.serviceName,
        team_member_id: teamMemberId,
        start_time: `${currentTime}:00`,
        end_time: `${endTime}:00`,
        duration_minutes: service.duration,
        price: service.price,
        status: 'confirmed',
      });

      currentTime = endTime;
    }

    const { error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .insert(appointments);

    if (appointmentsError) {
      console.error('Error creating appointments:', appointmentsError);
      // Try to clean up the booking group
      await supabaseAdmin
        .from('booking_groups')
        .delete()
        .eq('id', bookingGroup.id);
      return { success: false, error: 'Failed to create appointments' };
    }

    // Revalidate calendar
    revalidatePath('/admin/calendar');

    return {
      success: true,
      bookingId: bookingGroup.id,
    };
  } catch (error) {
    console.error('Error in createRebooking:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
