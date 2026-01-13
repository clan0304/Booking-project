// app/actions/calendar-appointments.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { requireStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { calculateAppointmentTimes } from '@/lib/booking-helpers';
import { BookingGroupWithAppointments } from '@/types/calendar';
import { detectClientType } from '@/lib/client-type-helpers';

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

  // Services (optional if products exist)
  services?: Array<{
    serviceId: string;
    variantId?: string;
    addonIds?: string[];
    duration: number;
    serviceName: string;
    price: number;
    teamMemberId?: string; // Optional: override team member per service
    startTime?: string; // Optional: override start time per service
    categoryColor?: string;
  }>;

  // Products (optional if services exist)
  products?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
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

/**
 * Create a new calendar appointment from admin calendar
 * Supports:
 * - Existing clients (by ID)
 * - Walk-in appointments
 * - New client creation
 * - Multiple services per booking
 * - Product-only sales (no services)
 * - Auto-detection of client type (A, B, B+, C) for commission tracking
 */
export async function createCalendarAppointment(
  data: CreateCalendarAppointmentData
): Promise<{
  success: boolean;
  message?: string;
  bookingId?: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    // =====================================================
    // 1. VALIDATE INPUTS
    // =====================================================

    if (!data.venueId || !data.bookingDate || !data.teamMemberId) {
      return { success: false, error: 'Missing required booking information' };
    }

    const hasServices = data.services && data.services.length > 0;
    const hasProducts = data.products && data.products.length > 0;

    // Must have at least one service OR one product
    if (!hasServices && !hasProducts) {
      return {
        success: false,
        error: 'At least one service or product is required',
      };
    }

    // =====================================================
    // 2. HANDLE CLIENT (existing, new, or walk-in)
    // =====================================================

    let finalClientId: string | null = null;
    let guestFirstName: string | null = null;
    let guestLastName: string | null = null;
    let guestEmail: string | null = null;
    let guestPhone: string | null = null;

    if (data.clientId) {
      // Existing client
      finalClientId = data.clientId;
    } else if (data.newClient) {
      // Create new client
      const { data: newClient, error: clientError } = await supabaseAdmin
        .from('users')
        .insert({
          first_name: data.newClient.firstName,
          last_name: data.newClient.lastName || null,
          email: data.newClient.email || null,
          phone_number: data.newClient.phone || null,
          birthday: data.newClient.birthday || null,
          roles: ['client'],
          is_registered: false,
        })
        .select('id')
        .single();

      if (clientError || !newClient) {
        console.error('Error creating new client:', clientError);
        return { success: false, error: 'Failed to create new client' };
      }

      finalClientId = newClient.id;
    } else if (data.walkIn) {
      // Walk-in - no client ID, use guest fields
      guestFirstName = 'Walk-in';
      guestLastName = null;
      guestEmail = null;
      guestPhone = null;
    } else {
      // Default to walk-in if nothing specified
      guestFirstName = 'Walk-in';
    }

    // If we have a client ID, fetch their info for guest fields (backup)
    if (finalClientId) {
      const { data: clientData } = await supabaseAdmin
        .from('users')
        .select('first_name, last_name, email, phone_number')
        .eq('id', finalClientId)
        .single();

      if (clientData) {
        guestFirstName = clientData.first_name;
        guestLastName = clientData.last_name;
        guestEmail = clientData.email;
        guestPhone = clientData.phone_number;
      }
    }

    // =====================================================
    // 3. CALCULATE TOTALS
    // =====================================================

    // Calculate services total and times
    let appointmentTimes: Array<{ startTime: string; endTime: string }> = [];
    let servicesTotal = 0;

    if (hasServices && data.services) {
      appointmentTimes = calculateAppointmentTimes(
        data.startTime,
        data.services
      );
      servicesTotal = data.services.reduce((sum, s) => sum + s.price, 0);
    }

    // Calculate products total
    const productsTotal =
      hasProducts && data.products
        ? data.products.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0)
        : 0;

    const totalPrice = servicesTotal + productsTotal;
    const totalAppointments = hasServices ? data.services!.length : 0;

    // =====================================================
    // 4. AUTO-DETECT CLIENT TYPE
    // =====================================================

    const clientType = await detectClientType(finalClientId, data.teamMemberId);

    // =====================================================
    // 5. CREATE BOOKING GROUP
    // =====================================================

    const { data: bookingGroup, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .insert({
        venue_id: data.venueId,
        booking_date: data.bookingDate,
        booking_source: 'admin',
        client_id: finalClientId,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        total_appointments: totalAppointments, // 0 for product-only sales
        total_price: totalPrice, // Includes both services and products
        status: 'confirmed',
        notes: data.bookingNotes || null,
        internal_notes: data.internalNotes || null,
        client_type: clientType,
      })
      .select()
      .single();

    if (bookingError || !bookingGroup) {
      console.error('Error creating booking group:', bookingError);
      return { success: false, error: 'Failed to create booking' };
    }

    // =====================================================
    // 6. CREATE APPOINTMENTS (only if services exist)
    // =====================================================

    if (hasServices && data.services) {
      const appointmentInserts = data.services.map((service, index) => {
        const times = appointmentTimes[index];
        // Use service-specific team member if provided, otherwise use default
        const teamMemberId = service.teamMemberId || data.teamMemberId;
        return {
          booking_group_id: bookingGroup.id,
          team_member_id: teamMemberId,
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
    }

    // Note: Products are NOT stored at booking time.
    // They become transaction_items when payment is processed in PaymentMode.
    // The payment flow calls decrementProductStock() after successful payment.

    // =====================================================
    // 7. SUCCESS - REVALIDATE & RETURN
    // =====================================================

    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');

    return {
      success: true,
      message: hasServices
        ? 'Appointment created successfully'
        : 'Product sale created successfully',
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
      .select(
        'id, first_name, last_name, email, phone_number, photo_url, alert_note'
      )
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
 * ✅ IMPROVED: Handles deleting appointments that result in zero remaining
 * Checks AFTER deletion to see if booking_group should be deleted
 */
export async function deleteCalendarAppointment(
  appointmentId: string,
  bookingId: string
) {
  try {
    await requireAdmin();

    // =====================================================
    // 1. DELETE THE APPOINTMENT FIRST
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
    // 2. CHECK HOW MANY APPOINTMENTS REMAIN
    // =====================================================

    const { data: remainingAppointments, error: remainingError } =
      await supabaseAdmin
        .from('appointments')
        .select('id, price, duration_minutes')
        .eq('booking_group_id', bookingId);

    if (remainingError) {
      console.error('Error fetching remaining appointments:', remainingError);
      return {
        success: false,
        error: 'Failed to check remaining appointments',
      };
    }

    // =====================================================
    // 3. IF NO APPOINTMENTS LEFT, DELETE BOOKING GROUP
    // =====================================================

    if (!remainingAppointments || remainingAppointments.length === 0) {
      const { error: deleteBookingError } = await supabaseAdmin
        .from('booking_groups')
        .delete()
        .eq('id', bookingId);

      if (deleteBookingError) {
        console.error('Error deleting booking group:', deleteBookingError);
        return { success: false, error: 'Failed to delete booking' };
      }

      revalidatePath('/admin/calendar');
      revalidatePath('/admin/bookings');

      return {
        success: true,
        message: 'Last appointment deleted - booking removed',
      };
    }

    // =====================================================
    // 4. RECALCULATE BOOKING TOTALS (appointments still exist)
    // =====================================================

    const typedAppointments = remainingAppointments as Array<{
      id: string;
      price: number;
      duration_minutes: number;
    }>;

    const totalPrice = typedAppointments.reduce(
      (sum, appt) => sum + (appt.price || 0),
      0
    );
    const totalAppointments = typedAppointments.length;

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

    // =====================================================
    // 5. SUCCESS - REVALIDATE & RETURN
    // =====================================================

    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');

    return {
      success: true,
      message: 'Appointment deleted successfully',
    };
  } catch (error) {
    console.error('Error in deleteCalendarAppointment:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Resize appointment (change start time, end time, or both)
 * Used for both top and bottom resize handles
 */
export async function resizeAppointment({
  appointmentId,

  newStartTime,
  newEndTime,
  newDuration,
}: {
  appointmentId: string;
  bookingId: string;
  newStartTime: string; // HH:MM format
  newEndTime: string; // HH:MM format
  newDuration: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    // 1. Get current appointment
    const { data: appointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('*, booking_groups!inner(booking_date, venue_id)')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    // 3. Update appointment
    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({
        start_time: newStartTime,
        end_time: newEndTime,
        duration_minutes: newDuration,

        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error updating appointment:', updateError);
      return { success: false, error: 'Failed to update appointment' };
    }

    revalidatePath('/admin/calendar');
    return { success: true };
  } catch (error) {
    console.error('Error resizing appointment:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Move appointment (drag and drop)
 * Supports both vertical (time change) and horizontal (team member change) drag
 * Duration stays the same, price recalculates if team member changes
 */
export async function moveAppointment({
  appointmentId,
  bookingId,
  newStartTime,
  newEndTime,
  newTeamMemberId,
}: {
  appointmentId: string;
  bookingId: string;
  newStartTime: string; // HH:MM format
  newEndTime: string; // HH:MM format
  newTeamMemberId?: string; // Optional: for horizontal drag to reassign team member
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    // =====================================================
    // 1. GET CURRENT APPOINTMENT
    // =====================================================
    const { data: appointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('*, booking_groups!inner(booking_date, venue_id)')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    // ✅ REMOVED: Conflict checking
    // Overlapping appointments are now allowed!

    // =====================================================
    // 2. CHECK IF TEAM MEMBER IS CHANGING
    // =====================================================
    const isTeamMemberChanging =
      newTeamMemberId && newTeamMemberId !== appointment.team_member_id;

    let newPrice = appointment.price; // Default: keep existing price

    if (isTeamMemberChanging) {
      // =====================================================
      // 3. VALIDATE SERVICE ASSIGNMENT
      // =====================================================
      const { data: serviceAssignment, error: assignmentError } =
        await supabaseAdmin
          .from('service_team_members')
          .select('custom_price')
          .eq('service_id', appointment.service_id)
          .eq('team_member_id', newTeamMemberId)
          .single();

      if (assignmentError || !serviceAssignment) {
        // Get team member name for better error message
        const { data: teamMember } = await supabaseAdmin
          .from('users')
          .select('first_name, last_name')
          .eq('id', newTeamMemberId)
          .single();

        const teamMemberName = teamMember
          ? `${teamMember.first_name} ${teamMember.last_name || ''}`.trim()
          : 'This team member';

        return {
          success: false,
          error: `${teamMemberName} is not assigned to perform "${appointment.service_name}". Please assign this service to them first in the Services page.`,
        };
      }

      // =====================================================
      // 4. CALCULATE NEW PRICE
      // =====================================================
      // Use custom price if set, otherwise get service base price
      if (serviceAssignment.custom_price !== null) {
        newPrice = serviceAssignment.custom_price;
      } else {
        // Fetch service base price
        const { data: service } = await supabaseAdmin
          .from('services')
          .select('price')
          .eq('id', appointment.service_id)
          .single();

        newPrice = service?.price || appointment.price;
      }
    }

    // =====================================================
    // 5. UPDATE APPOINTMENT
    // =====================================================
    const updateData: {
      start_time: string;
      end_time: string;
      updated_at: string;
      team_member_id?: string;
      price?: number;
    } = {
      start_time: newStartTime,
      end_time: newEndTime,
      updated_at: new Date().toISOString(),
    };

    // Add team member and price if changing
    if (isTeamMemberChanging) {
      updateData.team_member_id = newTeamMemberId;
      updateData.price = newPrice;
    }

    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Error moving appointment:', updateError);
      return { success: false, error: 'Failed to move appointment' };
    }

    // =====================================================
    // 6. RECALCULATE BOOKING TOTALS (if price changed)
    // =====================================================
    if (isTeamMemberChanging) {
      await recalculateBookingTotals(bookingId);
    }

    // =====================================================
    // 7. SUCCESS - REVALIDATE & RETURN
    // =====================================================
    revalidatePath('/admin/calendar');
    return { success: true };
  } catch (error) {
    console.error('Error moving appointment:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Helper function: Recalculate booking group totals
 * Called after resizing appointments that may change price
 */
async function recalculateBookingTotals(bookingId: string): Promise<void> {
  try {
    const { data: allAppointments } = await supabaseAdmin
      .from('appointments')
      .select('price')
      .eq('booking_group_id', bookingId)
      .neq('status', 'cancelled');

    if (allAppointments) {
      const totalPrice = allAppointments.reduce(
        (sum, a) => sum + Number(a.price),
        0
      );

      await supabaseAdmin
        .from('booking_groups')
        .update({
          total_price: totalPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);
    }
  } catch (error) {
    console.error('Error recalculating booking totals:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Get full booking group by appointment ID
 * Used for edit modal to load entire booking
 */
export async function getBookingByAppointmentId(
  appointmentId: string
): Promise<{
  success: boolean;
  data?: BookingGroupWithAppointments;
  error?: string;
}> {
  try {
    await requireStaff();

    // First get the appointment to find the booking_group_id
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select('booking_group_id')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      return { success: false, error: 'Appointment not found' };
    }

    // Now fetch the full booking group with all appointments
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .select(
        `
        id,
        venue_id,
        booking_date,
        booking_source,
        client_id,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        total_appointments,
        total_price,
        status,
        notes,
        internal_notes,
        client_type,
        created_at,
        updated_at,
        client:users!booking_groups_client_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number,
          photo_url,
          alert_note
        ),
        appointments (
          id,
          booking_group_id,
          service_id,
          service_name,
          team_member_id,
          start_time,
          end_time,
          duration_minutes,
          price,
          status,
          notes,
          created_at,
          team_member:users!appointments_team_member_id_fkey (
            id,
            first_name,
            last_name,
            photo_url
          )
        )
      `
      )
      .eq('id', appointment.booking_group_id)
      .single();

    if (bookingError || !booking) {
      return { success: false, error: 'Booking not found' };
    }

    return {
      success: true,
      data: booking as unknown as BookingGroupWithAppointments,
    };
  } catch (error) {
    console.error('Error in getBookingByAppointmentId:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Add a new appointment to an existing booking group
 * Used in Edit Booking modal when clicking "Add service"
 */
export async function addAppointmentToBooking(data: {
  bookingId: string;
  serviceId: string;
  serviceName: string;
  teamMemberId: string;
  startTime: string; // HH:MM
  duration: number;
  price: number;
}): Promise<{
  success: boolean;
  appointmentId?: string;
  error?: string;
}> {
  try {
    await requireStaff();

    // =====================================================
    // 1. GET BOOKING GROUP INFO
    // =====================================================

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .select('id, venue_id, booking_date')
      .eq('id', data.bookingId)
      .single();

    if (bookingError || !booking) {
      return { success: false, error: 'Booking not found' };
    }

    // =====================================================
    // 2. CALCULATE END TIME
    // =====================================================

    const [startHours, startMinutes] = data.startTime.split(':').map(Number);
    const totalMinutes = startHours * 60 + startMinutes + data.duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(
      endMinutes
    ).padStart(2, '0')}`;

    // =====================================================
    // 3. CREATE NEW APPOINTMENT
    // =====================================================

    const { data: newAppointment, error: appointmentError } =
      await supabaseAdmin
        .from('appointments')
        .insert({
          booking_group_id: data.bookingId,
          service_id: data.serviceId,
          service_name: data.serviceName,
          team_member_id: data.teamMemberId,
          start_time: data.startTime + ':00', // Add seconds
          end_time: endTime + ':00',
          duration_minutes: data.duration,
          price: data.price,
          status: 'confirmed',
        })
        .select('id')
        .single();

    if (appointmentError || !newAppointment) {
      console.error('Error creating appointment:', appointmentError);
      return { success: false, error: 'Failed to create appointment' };
    }

    // =====================================================
    // 4. RECALCULATE BOOKING TOTALS
    // =====================================================

    const { data: allAppointments, error: appointmentsError } =
      await supabaseAdmin
        .from('appointments')
        .select('price, duration_minutes')
        .eq('booking_group_id', data.bookingId);

    if (appointmentsError || !allAppointments) {
      return {
        success: false,
        error: 'Failed to recalculate booking totals',
      };
    }

    const totalPrice = allAppointments.reduce(
      (sum, appt) => sum + (appt.price || 0),
      0
    );
    const totalAppointments = allAppointments.length;

    // =====================================================
    // 5. UPDATE BOOKING GROUP TOTALS
    // =====================================================

    const { error: updateError } = await supabaseAdmin
      .from('booking_groups')
      .update({
        total_price: totalPrice,
        total_appointments: totalAppointments,
      })
      .eq('id', data.bookingId);

    if (updateError) {
      console.error('Error updating booking totals:', updateError);
      return { success: false, error: 'Failed to update booking totals' };
    }

    // =====================================================
    // 6. SUCCESS - REVALIDATE & RETURN
    // =====================================================

    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');

    return {
      success: true,
      appointmentId: newAppointment.id,
    };
  } catch (error) {
    console.error('Error in addAppointmentToBooking:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// =====================================================
// ADD THIS NEW ACTION TO calendar-appointments.ts
// =====================================================

/**
 * Update client type for a booking group
 * Used in edit modal to change commission type (A, B, B+, C)
 *
 * Type A: New Client (30%)
 * Type B: Regular Client (40%)
 * Type B+: Requested New (40%) - Manual only
 * Type C: Salon Client (30%)
 */
export async function updateBookingClientType(
  bookingId: string,
  clientType: 'A' | 'B' | 'B+' | 'C'
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireStaff();

    // Validate client type
    const validTypes = ['A', 'B', 'B+', 'C'];
    if (!validTypes.includes(clientType)) {
      return { success: false, error: 'Invalid client type' };
    }

    const { error } = await supabaseAdmin
      .from('booking_groups')
      .update({ client_type: clientType })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating client type:', error);
      return { success: false, error: 'Failed to update client type' };
    }

    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');

    return { success: true };
  } catch (error) {
    console.error('Error in updateBookingClientType:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get a booking by its ID
 * Used when opening edit modal directly (e.g., after creating a booking for checkout)
 */
export async function getBookingById(bookingId: string): Promise<{
  success: boolean;
  data?: BookingGroupWithAppointments;
  error?: string;
}> {
  try {
    await requireStaff();

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .select(
        `
        id,
        venue_id,
        booking_date,
        booking_source,
        client_id,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        total_appointments,
        total_price,
        status,
        notes,
        internal_notes,
        client_type,
        created_at,
        updated_at,
        client:users!booking_groups_client_id_fkey (
          id,
          first_name,
          last_name,
          email,
          phone_number,
          photo_url,
          alert_note
        ),
        appointments (
          id,
          booking_group_id,
          service_id,
          service_name,
          team_member_id,
          start_time,
          end_time,
          duration_minutes,
          price,
          status,
          notes,
          created_at,
          team_member:users!appointments_team_member_id_fkey (
            id,
            first_name,
            last_name,
            photo_url
          )
        )
      `
      )
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking:', bookingError);
      return { success: false, error: 'Booking not found' };
    }

    return {
      success: true,
      data: booking as unknown as BookingGroupWithAppointments,
    };
  } catch (error) {
    console.error('Error in getBookingById:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update booking status
 * Allowed transitions:
 * - confirmed -> cancelled, no_show
 * - cancelled -> (none - locked)
 * - completed -> (none - locked)
 * - no_show -> confirmed (allow reversal)
 */
export async function updateBookingStatus(
  bookingId: string,
  newStatus: 'confirmed' | 'completed' | 'cancelled' | 'no_show'
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();

    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('booking_groups')
      .select('status')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Validate status transitions
    const currentStatus = booking.status;

    // Completed bookings cannot be changed
    if (currentStatus === 'completed') {
      return { success: false, error: 'Completed bookings cannot be modified' };
    }

    // Cancelled bookings cannot be changed
    if (currentStatus === 'canceled') {
      return { success: false, error: 'Cancelled bookings cannot be modified' };
    }

    // Update the status
    const { error: updateError } = await supabaseAdmin
      .from('booking_groups')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking status:', updateError);
      return { success: false, error: 'Failed to update booking status' };
    }

    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');

    return { success: true };
  } catch (error) {
    console.error('Error in updateBookingStatus:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update client alert note
 * Saves directly to users.alert_note field
 */
export async function updateClientAlertNote(
  clientId: string,
  alertNote: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireStaff();

    const { error } = await supabaseAdmin
      .from('users')
      .update({ alert_note: alertNote })
      .eq('id', clientId);

    if (error) {
      console.error('Error updating client alert note:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateClientAlertNote:', error);
    return { success: false, error: 'Failed to update client alert note' };
  }
}

/**
 * Update booking internal notes
 * Saves directly to booking_groups.internal_notes field
 */
export async function updateBookingInternalNotes(
  bookingId: string,
  internalNotes: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireStaff();

    const { error } = await supabaseAdmin
      .from('booking_groups')
      .update({ internal_notes: internalNotes })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating booking internal notes:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateBookingInternalNotes:', error);
    return { success: false, error: 'Failed to update internal notes' };
  }
}
