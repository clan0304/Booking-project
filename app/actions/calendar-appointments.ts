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

interface UpdateCalendarAppointmentData {
  appointmentId: string;
  bookingId: string;

  // Optional fields to update
  serviceId?: string;
  serviceName?: string;
  teamMemberId?: string;
  startTime?: string; // HH:MM
  duration?: number;
  price?: number;
  bookingNotes?: string;
  internalNotes?: string;
}

interface AppointmentUpdateFields {
  service_id?: string;
  service_name?: string;
  team_member_id?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  price?: number;
  notes?: string;
}

interface BookingGroupUpdateFields {
  total_price?: number;
  total_appointments?: number;
  internal_notes?: string;
}

interface ExistingAppointment {
  id: string;
  service_id: string;
  service_name: string;
  team_member_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  price: number;
  notes: string | null;
  booking_group_id: string;
}

interface AppointmentPriceData {
  price: number;
  duration_minutes: number;
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

// =====================================================
// UPDATE APPOINTMENT
// =====================================================

/**
 * Update calendar appointment
 */
export async function updateCalendarAppointment(
  data: UpdateCalendarAppointmentData
) {
  try {
    await requireAdmin();

    // =====================================================
    // 1. VALIDATE INPUTS
    // =====================================================

    if (!data.appointmentId || !data.bookingId) {
      return { success: false, error: 'Missing required IDs' };
    }

    // =====================================================
    // 2. GET EXISTING APPOINTMENT DATA
    // =====================================================

    const { data: existingAppointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('id', data.appointmentId)
      .eq('booking_group_id', data.bookingId)
      .single();

    if (fetchError || !existingAppointment) {
      return { success: false, error: 'Appointment not found' };
    }

    const existing = existingAppointment as ExistingAppointment;

    // =====================================================
    // 3. PREPARE UPDATE DATA
    // =====================================================

    const appointmentUpdate: AppointmentUpdateFields = {};
    let needsRecalculation = false;

    // Update service if changed
    if (data.serviceId && data.serviceId !== existing.service_id) {
      appointmentUpdate.service_id = data.serviceId;
      appointmentUpdate.service_name =
        data.serviceName || existing.service_name;
      needsRecalculation = true;
    }

    // Update team member if changed
    if (data.teamMemberId && data.teamMemberId !== existing.team_member_id) {
      appointmentUpdate.team_member_id = data.teamMemberId;
    }

    // Update times if changed
    if (data.startTime || data.duration !== undefined) {
      const startTime = data.startTime || existing.start_time.substring(0, 5); // Remove :00 if present
      const duration =
        data.duration !== undefined ? data.duration : existing.duration_minutes;

      // Calculate end time manually
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const totalMinutes = startHours * 60 + startMinutes + duration;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(
        endMinutes
      ).padStart(2, '0')}`;

      appointmentUpdate.start_time = startTime + ':00'; // Add seconds
      appointmentUpdate.end_time = endTime + ':00';
      appointmentUpdate.duration_minutes = duration;
      needsRecalculation = true;
    }

    // Update price if changed
    if (data.price !== undefined && data.price !== existing.price) {
      appointmentUpdate.price = data.price;
      needsRecalculation = true;
    }

    // Update notes if provided
    if (data.bookingNotes !== undefined) {
      appointmentUpdate.notes = data.bookingNotes;
    }

    // =====================================================
    // 4. UPDATE APPOINTMENT
    // =====================================================

    if (Object.keys(appointmentUpdate).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('appointments')
        .update(appointmentUpdate)
        .eq('id', data.appointmentId);

      if (updateError) {
        console.error('Error updating appointment:', updateError);
        return { success: false, error: 'Failed to update appointment' };
      }
    }

    // =====================================================
    // 5. UPDATE BOOKING GROUP (if price/duration changed)
    // =====================================================

    if (needsRecalculation || data.internalNotes !== undefined) {
      // Get all appointments for this booking to recalculate totals
      const { data: allAppointments, error: appointmentsError } =
        await supabaseAdmin
          .from('appointments')
          .select('price, duration_minutes')
          .eq('booking_group_id', data.bookingId);

      if (appointmentsError || !allAppointments) {
        return {
          success: false,
          error: 'Failed to fetch booking appointments',
        };
      }

      const appointments = allAppointments as AppointmentPriceData[];
      const totalPrice = appointments.reduce(
        (sum, appt) => sum + (appt.price || 0),
        0
      );
      const totalAppointments = appointments.length;

      const bookingUpdate: BookingGroupUpdateFields = {
        total_price: totalPrice,
        total_appointments: totalAppointments,
      };

      if (data.internalNotes !== undefined) {
        bookingUpdate.internal_notes = data.internalNotes;
      }

      const { error: bookingUpdateError } = await supabaseAdmin
        .from('booking_groups')
        .update(bookingUpdate)
        .eq('id', data.bookingId);

      if (bookingUpdateError) {
        console.error('Error updating booking group:', bookingUpdateError);
        return { success: false, error: 'Failed to update booking totals' };
      }
    }

    // =====================================================
    // 6. SUCCESS - REVALIDATE & RETURN
    // =====================================================

    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');

    return {
      success: true,
      message: 'Appointment updated successfully',
    };
  } catch (error) {
    console.error('Error in updateCalendarAppointment:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// =====================================================
// DELETE APPOINTMENT
// =====================================================

/**
 * Delete calendar appointment
 */
export async function deleteCalendarAppointment(
  appointmentId: string,
  bookingId: string
) {
  try {
    await requireAdmin();

    // =====================================================
    // 1. VALIDATE INPUTS
    // =====================================================

    if (!appointmentId || !bookingId) {
      return { success: false, error: 'Missing required IDs' };
    }

    // =====================================================
    // 2. CHECK IF THIS IS THE ONLY APPOINTMENT
    // =====================================================

    const { data: appointments, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('booking_group_id', bookingId);

    if (fetchError) {
      console.error('Error fetching appointments:', fetchError);
      return { success: false, error: 'Failed to check booking' };
    }

    const isOnlyAppointment = appointments && appointments.length === 1;

    // =====================================================
    // 3. DELETE APPOINTMENT
    // =====================================================

    const { error: deleteError } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('id', appointmentId);

    if (deleteError) {
      console.error('Error deleting appointment:', deleteError);
      return { success: false, error: 'Failed to delete appointment' };
    }

    // =====================================================
    // 4. IF ONLY APPOINTMENT, DELETE BOOKING GROUP TOO
    // =====================================================

    if (isOnlyAppointment) {
      const { error: deleteBookingError } = await supabaseAdmin
        .from('booking_groups')
        .delete()
        .eq('id', bookingId);

      if (deleteBookingError) {
        console.error('Error deleting booking group:', deleteBookingError);
        return { success: false, error: 'Failed to delete booking' };
      }
    } else {
      // =====================================================
      // 5. RECALCULATE BOOKING TOTALS
      // =====================================================

      const { data: remainingAppointments, error: remainingError } =
        await supabaseAdmin
          .from('appointments')
          .select('price, duration_minutes')
          .eq('booking_group_id', bookingId);

      if (remainingError || !remainingAppointments) {
        return {
          success: false,
          error: 'Failed to recalculate booking totals',
        };
      }

      const appointments = remainingAppointments as AppointmentPriceData[];
      const totalPrice = appointments.reduce(
        (sum, appt) => sum + (appt.price || 0),
        0
      );
      const totalAppointments = appointments.length;

      const { error: updateBookingError } = await supabaseAdmin
        .from('booking_groups')
        .update({
          total_price: totalPrice,
          total_appointments: totalAppointments,
        })
        .eq('id', bookingId);

      if (updateBookingError) {
        console.error('Error updating booking totals:', updateBookingError);
        return { success: false, error: 'Failed to update booking totals' };
      }
    }

    // =====================================================
    // 6. SUCCESS - REVALIDATE & RETURN
    // =====================================================

    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');

    return {
      success: true,
      message: isOnlyAppointment
        ? 'Appointment and booking deleted successfully'
        : 'Appointment deleted successfully',
    };
  } catch (error) {
    console.error('Error in deleteCalendarAppointment:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
