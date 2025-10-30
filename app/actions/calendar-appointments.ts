// app/actions/calendar-appointments.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { calculateAppointmentTimes } from '@/lib/booking-helpers';

interface CreateCalendarAppointmentData {
  venueId: string;
  bookingDate: string; // YYYY-MM-DD
  teamMemberId: string;
  startTime: string; // HH:MM

  // Client info (ONE of these required)
  clientId?: string; // Existing client
  walkIn?: boolean; // Walk-in flag
  newClient?: {
    // New client to create
    firstName: string; // REQUIRED
    lastName?: string;
    email?: string;
    phone?: string;
    birthday?: string;
  };

  // Services (at least one required)
  services: Array<{
    serviceId: string;
    variantId?: string;
    addonIds?: string[];
    duration: number;
    serviceName: string;
    price: number;
  }>;

  // Optional notes
  bookingNotes?: string;
  internalNotes?: string;
}

// REPLACE the entire createCalendarAppointment function in app/actions/calendar-appointments.ts

export async function createCalendarAppointment(
  data: CreateCalendarAppointmentData
) {
  try {
    await requireAdmin();

    // =====================================================
    // 1. VALIDATE INPUTS
    // =====================================================

    if (!data.venueId || !data.bookingDate || !data.teamMemberId) {
      return { success: false, error: 'Missing required booking information' };
    }

    if (!data.services || data.services.length === 0) {
      return {
        success: false,
        error: 'At least one service is required',
      };
    }

    // =====================================================
    // 2. HANDLE CLIENT CREATION/SELECTION
    // =====================================================

    let finalClientId: string | null = null;
    let guestFirstName: string;
    let guestLastName: string | null = null;
    let guestEmail: string | null = null;
    let guestPhone: string | null = null;

    if (data.walkIn) {
      // ✅ Walk-in: No user record, just guest info
      guestFirstName = 'Walk-In';
      finalClientId = null;
    } else if (data.newClient) {
      // ✅ Create new client user record
      const { firstName, lastName, email, phone, birthday } = data.newClient;

      if (!firstName) {
        return { success: false, error: 'Client first name is required' };
      }

      // Check email uniqueness if provided
      if (email) {
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (existing) {
          return { success: false, error: 'Email already exists' };
        }
      }

      // Create user record
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          email: email?.toLowerCase() || null,
          first_name: firstName,
          last_name: lastName || null,
          phone_number: phone || null,
          birthday: birthday || null,
          roles: ['client'],
          is_registered: false,
          clerk_user_id: null,
          onboarding_completed: true,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('Error creating client:', createError);
        return { success: false, error: 'Failed to create client' };
      }

      // ✅ NEW: Populate guest fields from newly created user
      finalClientId = newUser.id;
      guestFirstName = newUser.first_name;
      guestLastName = newUser.last_name;
      guestEmail = newUser.email;
      guestPhone = newUser.phone_number;
    } else if (data.clientId) {
      // ✅ NEW: Fetch existing client's information
      const { data: existingClient, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, email, phone_number')
        .eq('id', data.clientId)
        .single();

      if (fetchError || !existingClient) {
        console.error('Error fetching client:', fetchError);
        return { success: false, error: 'Client not found' };
      }

      // ✅ NEW: Populate guest fields from existing user
      finalClientId = existingClient.id;
      guestFirstName = existingClient.first_name;
      guestLastName = existingClient.last_name;
      guestEmail = existingClient.email;
      guestPhone = existingClient.phone_number;
    } else {
      return {
        success: false,
        error:
          'Client information required (select existing, create new, or walk-in)',
      };
    }

    // =====================================================
    // 3. CALCULATE APPOINTMENT TIMES
    // =====================================================

    const appointmentTimes = calculateAppointmentTimes(
      data.startTime,
      data.services
    );

    const totalPrice = data.services.reduce((sum, s) => sum + s.price, 0);

    // =====================================================
    // 4. CREATE BOOKING GROUP
    // =====================================================

    const { data: bookingGroup, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .insert({
        venue_id: data.venueId,
        booking_date: data.bookingDate,
        booking_source: 'admin',
        client_id: finalClientId,
        // ✅ FIXED: Guest fields now properly populated
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        total_appointments: data.services.length,
        total_price: totalPrice,
        status: 'confirmed',
        notes: data.bookingNotes || null,
        internal_notes: data.internalNotes || null,
      })
      .select()
      .single();

    if (bookingError || !bookingGroup) {
      console.error('Error creating booking group:', bookingError);
      return { success: false, error: 'Failed to create booking' };
    }

    // =====================================================
    // 5. CREATE APPOINTMENTS
    // =====================================================

    const appointmentInserts = data.services.map((service, index) => {
      const times = appointmentTimes[index];
      return {
        booking_group_id: bookingGroup.id,
        team_member_id: data.teamMemberId,
        service_id: service.serviceId,
        service_name: service.serviceName,
        start_time: times.startTime + ':00', // Add seconds
        end_time: times.endTime + ':00',
        duration_minutes: service.duration,
        price: service.price,
        status: 'confirmed',
      };
    });

    const { error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .insert(appointmentInserts);

    if (appointmentsError) {
      console.error('Error creating appointments:', appointmentsError);
      // Rollback booking group
      await supabaseAdmin
        .from('booking_groups')
        .delete()
        .eq('id', bookingGroup.id);
      return { success: false, error: 'Failed to create appointments' };
    }

    // =====================================================
    // 6. SUCCESS - REVALIDATE & RETURN
    // =====================================================

    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');

    return {
      success: true,
      message: 'Appointment created successfully',
      bookingId: bookingGroup.id,
    };
  } catch (error) {
    console.error('Error in createCalendarAppointment:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
/**
 * Search clients for booking (simplified version for calendar)
 */
export async function searchClientsForBooking(query: string) {
  try {
    await requireAdmin();

    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, phone_number, photo_url')
      .contains('roles', ['client'])
      .or(
        `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone_number.ilike.%${query}%`
      )
      .order('first_name')
      .limit(20);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error searching clients:', error);
    return { success: false, error: 'Failed to search clients' };
  }
}

/**
 * Get recent clients (for quick selection)
 * FIXED: Specify exact foreign key relationship to avoid ambiguity
 */
export async function getRecentClients(venueId: string, limit: number = 10) {
  try {
    await requireAdmin();

    // Get clients who have bookings at this venue, ordered by most recent
    // ✅ FIXED: Use explicit relationship hint to avoid PGRST201 error
    const { data, error } = await supabaseAdmin
      .from('booking_groups')
      .select(
        `
        client_id,
        users!booking_groups_client_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number,
          photo_url
        )
      `
      )
      .eq('venue_id', venueId)
      .not('client_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit * 3); // Get more to account for duplicates

    if (error) {
      console.error('Error fetching recent clients:', error);
      throw error;
    }

    // Deduplicate clients by ID
    const uniqueClients = new Map<
      string,
      {
        id: string;
        first_name: string;
        last_name: string | null;
        email: string | null;
        phone_number: string | null;
        photo_url: string | null;
      }
    >();

    // Type for the booking with user relationship
    interface BookingWithUser {
      client_id: string;
      users:
        | {
            id: string;
            first_name: string;
            last_name: string | null;
            email: string | null;
            phone_number: string | null;
            photo_url: string | null;
          }
        | {
            id: string;
            first_name: string;
            last_name: string | null;
            email: string | null;
            phone_number: string | null;
            photo_url: string | null;
          }[]
        | null;
    }

    (data as BookingWithUser[])?.forEach((booking) => {
      // Handle both array and single object from Supabase
      const user = Array.isArray(booking.users)
        ? booking.users[0]
        : booking.users;

      if (user && !uniqueClients.has(user.id)) {
        uniqueClients.set(user.id, user);
      }
    });

    const clients = Array.from(uniqueClients.values()).slice(0, limit);

    return { success: true, data: clients };
  } catch (error) {
    console.error('Error fetching recent clients:', error);
    return { success: false, error: 'Failed to fetch recent clients' };
  }
}
