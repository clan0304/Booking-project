// app/actions/bookings.ts
'use server';

import { requireAuth, requireStaff, requireAdmin } from '@/lib/auth';
import { createSupabaseJWTClient } from '@/lib/supabase/jwt-client';
import { revalidatePath } from 'next/cache';
import type { CalendarBooking } from '@/types/calendar';
import { supabaseAdmin } from '@/lib/supabase/server';

// =====================================================
// TYPES
// =====================================================

export interface CreateBookingData {
  venue_id: string;
  client_id?: string | null;
  guest_first_name: string;
  guest_last_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  booking_date: string; // YYYY-MM-DD
  notes?: string | null;
  internal_notes?: string | null; // Staff only
  booking_source?: 'online' | 'admin' | 'walk_in' | 'phone';
  appointments: CreateAppointmentData[];
}

export interface CreateAppointmentData {
  service_id: string;
  variant_id?: string | null;
  team_member_id: string;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  duration_minutes: number;
  service_name: string;
  price: number;
  notes?: string | null;
}

export interface UpdateBookingData {
  guest_first_name?: string;
  guest_last_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  notes?: string | null;
  internal_notes?: string | null; // Staff only
  status?:
    | 'confirmed'
    | 'partially_cancelled'
    | 'fully_cancelled'
    | 'completed'
    | 'no_show';
}

interface Venue {
  id: string;
  name: string;
  address: string;
  phone_number: string | null;
  slug: string;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  phone_number?: string | null;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  photo_url: string | null;
  alert_note: string | null;
  is_registered?: boolean;
}

interface Appointment {
  id: string;
  service_id: string;
  service_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  price: number;
  status: string;
  team_member_id: string;
  variant_id?: string | null;
  notes?: string | null;
  created_at?: string;
  team_member?: TeamMember | null;
}

interface VenueSimple {
  name: string;
  slug: string;
}

interface AppointmentSimple {
  id: string;
  service_name: string;
  start_time: string;
  status: string;
  team_member_id?: string;
}

interface BookingGroupSimple {
  id: string;
  venue_id: string;
  booking_date: string;
  total_appointments: number;
  total_price: number;
  status: string;
  created_at: string;
  venues: VenueSimple[] | null; // Supabase returns as array
  appointments: AppointmentSimple[];
}

interface VenueBookingAppointment {
  id: string;
  service_name: string;
  start_time: string;
  status: string;
  team_member_id: string;
  team_member?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface VenueBooking {
  id: string;
  guest_first_name: string;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  booking_date: string;
  total_appointments: number;
  total_price: number;
  status: string;
  booking_source: string;
  notes: string | null;
  internal_notes: string | null;
  created_at: string;
  client_id: string | null;
  appointments: VenueBookingAppointment[];
  client?: Pick<
    Client,
    'id' | 'first_name' | 'last_name' | 'is_registered'
  > | null;
}

interface TeamMemberAppointmentRow {
  appointment_id: string;
  start_time: string;
  end_time: string;
  service_name: string;
  client_name: string;
  status: string;
}

interface BookingGroupInsert {
  id: string;
  venue_id: string;
  client_id: string | null;
  guest_first_name: string;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  booking_date: string;
  total_appointments: number;
  total_price: number;
  notes: string | null;
  internal_notes?: string | null;
  booking_source: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: string;
}

interface BookingGroupForClient {
  id: string;
  venue_id: string;
  guest_first_name: string;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  booking_date: string;
  total_appointments: number;
  total_price: number;
  status: string;
  notes: string | null;
  booking_source: string;
  created_at: string;
  venues: Venue[] | null;
  appointments: Appointment[];
}

interface BookingGroupForStaff {
  id: string;
  venue_id: string;
  guest_first_name: string;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  booking_date: string;
  total_appointments: number;
  total_price: number;
  status: string;
  notes: string | null;
  internal_notes: string | null;
  booking_source: string;
  created_at: string;
  client_id: string | null;
  created_by: string | null;
  venues: Venue[] | null;
  appointments: Appointment[];
  client?: Client | null;
  created_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface RawAppointmentFromDB {
  id: string;
  service_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  price: number;
  status: string;
  notes: string | null;
  team_member_id: string;
}

interface RawBookingFromDB {
  id: string;
  venue_id: string;
  guest_first_name: string;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  booking_date: string;
  total_appointments: number;
  total_price: number;
  status: string;
  notes: string | null;
  internal_notes: string | null;
  booking_source: string;
  created_at: string;
  client_id: string | null;
  venues:
    | {
        id: string;
        name: string;
        address: string;
      }[]
    | null;
  appointments: RawAppointmentFromDB[] | null;
}

interface TeamMemberFromDB {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if a booking can be modified by client
 * Returns true if booking is 48+ hours away
 */
export async function canModifyBooking(bookingId: string): Promise<{
  canModify: boolean;
  hoursUntilBooking?: number;
  message?: string;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseJWTClient();

    const { data: booking, error } = await supabase
      .from('booking_groups')
      .select('booking_date')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return { canModify: false, error: 'Booking not found' };
    }

    // Calculate hours until booking
    const bookingDate = new Date(booking.booking_date);
    const now = new Date();
    const hoursUntilBooking =
      (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const canModify = hoursUntilBooking >= 48;
    const hoursRemaining = Math.floor(hoursUntilBooking);

    return {
      canModify,
      hoursUntilBooking: hoursRemaining,
      message: canModify
        ? `You can modify this booking (${hoursRemaining}h remaining)`
        : `Cannot modify booking less than 48 hours before appointment (${hoursRemaining}h remaining)`,
    };
  } catch (error) {
    console.error('Error checking booking modification:', error);
    return { canModify: false, error: 'Failed to check booking' };
  }
}

// =====================================================
// CLIENT-FACING ACTIONS
// =====================================================

/**
 * Get booking for client
 * RLS ensures clients can only see their own bookings
 * Application layer excludes internal_notes from response
 */
export async function getBookingForClient(bookingId: string): Promise<{
  success: boolean;
  data?: BookingGroupForClient;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase
      .from('booking_groups')
      .select(
        `
        id,
        venue_id,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        booking_date,
        total_appointments,
        total_price,
        status,
        notes,
        booking_source,
        created_at,
        venues (
          id,
          name,
          address,
          phone_number,
          slug
        ),
        appointments (
          id,
          service_id,
          service_name,
          start_time,
          end_time,
          duration_minutes,
          price,
          status,
          team_member_id
        )
      `
      )
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error fetching booking:', error);
      return { success: false, error: 'Booking not found' };
    }

    const bookingData = data as unknown as BookingGroupForClient;

    // Fetch team member details separately
    if (bookingData?.appointments && Array.isArray(bookingData.appointments)) {
      const teamMemberIds = [
        ...new Set(bookingData.appointments.map((a) => a.team_member_id)),
      ];
      const { data: teamMembers } = await supabase
        .from('users')
        .select('id, first_name, last_name, photo_url')
        .in('id', teamMemberIds);

      // Attach team member data to appointments
      bookingData.appointments = bookingData.appointments.map((appt) => ({
        ...appt,
        team_member:
          teamMembers?.find((tm) => tm.id === appt.team_member_id) || null,
      }));
    }

    return { success: true, data: bookingData };
  } catch (error) {
    console.error('Error in getBookingForClient:', error);
    return { success: false, error: 'Failed to fetch booking' };
  }
}

/**
 * Get all bookings for logged-in client
 * RLS ensures they only see their own bookings
 */
export async function getMyBookings(): Promise<{
  success: boolean;
  data?: BookingGroupSimple[];
  error?: string;
}> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase
      .from('booking_groups')
      .select(
        `
        id,
        venue_id,
        booking_date,
        total_appointments,
        total_price,
        status,
        created_at,
        venues (
          name,
          slug
        ),
        appointments (
          id,
          service_name,
          start_time,
          status
        )
      `
      )
      .order('booking_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      return { success: false, error: 'Failed to fetch bookings' };
    }

    return { success: true, data: data as unknown as BookingGroupSimple[] };
  } catch (error) {
    console.error('Error in getMyBookings:', error);
    return { success: false, error: 'Failed to fetch bookings' };
  }
}

/**
 * Create booking (online booking - client authenticated)
 * RLS enforces that client_id must be their own ID
 */
export async function createOnlineBooking(
  formData: CreateBookingData
): Promise<{
  success: boolean;
  data?: BookingGroupInsert;
  message?: string;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseJWTClient();

    // Set client_id and booking_source
    formData.client_id = user.supabaseUserId;
    formData.booking_source = 'online';

    // Clients cannot set internal_notes
    delete formData.internal_notes;

    // Validate appointments
    if (!formData.appointments || formData.appointments.length === 0) {
      return { success: false, error: 'At least one appointment is required' };
    }

    // Check availability for all appointments
    for (const appt of formData.appointments) {
      const { data: isAvailable, error: availError } = await supabase.rpc(
        'is_time_slot_available',
        {
          p_team_member_id: appt.team_member_id,
          p_date: formData.booking_date,
          p_start_time: appt.start_time,
          p_end_time: appt.end_time,
        }
      );

      if (availError || !isAvailable) {
        return {
          success: false,
          error: `Time slot ${appt.start_time} - ${appt.end_time} is not available`,
        };
      }
    }

    // Calculate totals
    const total_appointments = formData.appointments.length;
    const total_price = formData.appointments.reduce(
      (sum, appt) => sum + appt.price,
      0
    );

    // Create booking group
    const { data: bookingGroup, error: bookingError } = await supabase
      .from('booking_groups')
      .insert({
        venue_id: formData.venue_id,
        client_id: formData.client_id,
        guest_first_name: formData.guest_first_name,
        guest_last_name: formData.guest_last_name,
        guest_email: formData.guest_email,
        guest_phone: formData.guest_phone,
        booking_date: formData.booking_date,
        total_appointments,
        total_price,
        notes: formData.notes,
        booking_source: formData.booking_source,
      })
      .select()
      .single();

    if (bookingError || !bookingGroup) {
      console.error('Error creating booking:', bookingError);
      return { success: false, error: 'Failed to create booking' };
    }

    // Create appointments
    const appointmentsData = formData.appointments.map((appt) => ({
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
    }));

    const { error: appointmentsError } = await supabase
      .from('appointments')
      .insert(appointmentsData);

    if (appointmentsError) {
      console.error('Error creating appointments:', appointmentsError);
      // Rollback: delete booking group
      await supabase.from('booking_groups').delete().eq('id', bookingGroup.id);
      return { success: false, error: 'Failed to create appointments' };
    }

    revalidatePath('/dashboard');
    revalidatePath('/bookings');

    return {
      success: true,
      data: bookingGroup as unknown as BookingGroupInsert,
      message: 'Booking created successfully!',
    };
  } catch (error) {
    console.error('Error in createOnlineBooking:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update client's own booking
 * RLS ensures they can only update their own bookings
 * Clients can only update if booking is 48+ hours away
 * Clients CANNOT update internal_notes
 */
export async function updateMyBooking(
  bookingId: string,
  formData: Omit<UpdateBookingData, 'internal_notes'>
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    // First, check if booking is 48+ hours away
    const { data: booking, error: fetchError } = await supabase
      .from('booking_groups')
      .select('booking_date')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Calculate hours until booking
    const bookingDate = new Date(booking.booking_date);
    const now = new Date();
    const hoursUntilBooking =
      (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 48) {
      return {
        success: false,
        error:
          'Cannot update booking less than 48 hours before appointment time',
      };
    }

    // Build update data
    const updateData: {
      guest_first_name?: string;
      guest_last_name?: string | null;
      guest_email?: string | null;
      guest_phone?: string | null;
      notes?: string | null;
      status?: string;
    } = {};

    if (formData.guest_first_name !== undefined)
      updateData.guest_first_name = formData.guest_first_name;
    if (formData.guest_last_name !== undefined)
      updateData.guest_last_name = formData.guest_last_name;
    if (formData.guest_email !== undefined)
      updateData.guest_email = formData.guest_email;
    if (formData.guest_phone !== undefined)
      updateData.guest_phone = formData.guest_phone;
    if (formData.notes !== undefined) updateData.notes = formData.notes;
    if (formData.status !== undefined) updateData.status = formData.status;

    const { error } = await supabase
      .from('booking_groups')
      .update(updateData)
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating booking:', error);
      return { success: false, error: 'Failed to update booking' };
    }

    revalidatePath('/dashboard');
    revalidatePath('/bookings');

    return { success: true, message: 'Booking updated successfully' };
  } catch (error) {
    console.error('Error in updateMyBooking:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Cancel booking (client can cancel their own booking)
 * Clients can only cancel if booking is 48+ hours away
 * RLS ensures they can only cancel their own bookings
 */
export async function cancelMyBooking(bookingId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    // Verify booking exists and get details
    const { data: booking, error: fetchError } = await supabase
      .from('booking_groups')
      .select('id, status, booking_date')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.status === 'completed') {
      return { success: false, error: 'Cannot cancel completed booking' };
    }

    // Calculate hours until booking
    const bookingDate = new Date(booking.booking_date);
    const now = new Date();
    const hoursUntilBooking =
      (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 48) {
      return {
        success: false,
        error:
          'Cannot cancel booking less than 48 hours before appointment time. Please contact the salon directly.',
      };
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('booking_groups')
      .update({ status: 'fully_cancelled' })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      return { success: false, error: 'Failed to cancel booking' };
    }

    // Cancel all appointments
    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('booking_group_id', bookingId);

    revalidatePath('/dashboard');
    revalidatePath('/bookings');

    return { success: true, message: 'Booking cancelled successfully' };
  } catch (error) {
    console.error('Error in cancelMyBooking:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// STAFF/ADMIN ACTIONS
// =====================================================

/**
 * Get booking for staff/admin (includes internal_notes)
 * RLS grants access to all bookings for staff
 */
export async function getBookingForStaff(bookingId: string): Promise<{
  success: boolean;
  data?: BookingGroupForStaff;
  error?: string;
}> {
  try {
    await requireStaff();
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase
      .from('booking_groups')
      .select(
        `
        *,
        venues (
          id,
          name,
          address,
          phone_number,
          slug
        ),
        appointments (
          id,
          service_id,
          variant_id,
          service_name,
          start_time,
          end_time,
          duration_minutes,
          price,
          status,
          notes,
          created_at,
          team_member_id
        )
      `
      )
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error fetching booking:', error);
      return { success: false, error: 'Booking not found' };
    }

    const bookingData = data as unknown as BookingGroupForStaff;

    // Fetch related user data
    if (bookingData.client_id) {
      const { data: client } = await supabase
        .from('users')
        .select(
          'id, first_name, last_name, email, phone_number, photo_url, alert_note'
        )
        .eq('id', bookingData.client_id)
        .single();
      bookingData.client = client;
    }

    if (bookingData.created_by) {
      const { data: creator } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('id', bookingData.created_by)
        .single();
      bookingData.created_by_user = creator;
    }

    // Fetch team member details for appointments
    if (bookingData.appointments && Array.isArray(bookingData.appointments)) {
      const teamMemberIds = [
        ...new Set(bookingData.appointments.map((a) => a.team_member_id)),
      ];
      const { data: teamMembers } = await supabase
        .from('users')
        .select('id, first_name, last_name, photo_url, phone_number')
        .in('id', teamMemberIds);

      bookingData.appointments = bookingData.appointments.map((appt) => ({
        ...appt,
        team_member:
          teamMembers?.find((tm) => tm.id === appt.team_member_id) || null,
      }));
    }

    return { success: true, data: bookingData };
  } catch (error) {
    console.error('Error in getBookingForStaff:', error);
    return { success: false, error: 'Failed to fetch booking' };
  }
}

/**
 * Get all bookings for a venue (staff/admin)
 * RLS grants access to all bookings for staff
 */
export async function getVenueBookings(
  venueId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  success: boolean;
  data?: VenueBooking[];
  error?: string;
}> {
  try {
    await requireStaff();
    const supabase = await createSupabaseJWTClient();

    let query = supabase
      .from('booking_groups')
      .select(
        `
        id,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        booking_date,
        total_appointments,
        total_price,
        status,
        booking_source,
        notes,
        internal_notes,
        created_at,
        client_id,
        appointments (
          id,
          service_name,
          start_time,
          status,
          team_member_id
        )
      `
      )
      .eq('venue_id', venueId)
      .order('booking_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('booking_date', startDate);
    }

    if (endDate) {
      query = query.lte('booking_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching venue bookings:', error);
      return { success: false, error: 'Failed to fetch bookings' };
    }

    if (!data) {
      return { success: true, data: [] };
    }

    const typedData = data as unknown as VenueBooking[];

    // Fetch client info for bookings with client_id
    const clientIds = typedData
      .filter((b) => b.client_id)
      .map((b) => b.client_id as string);

    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from('users')
        .select('id, first_name, last_name, is_registered')
        .in('id', clientIds);

      typedData.forEach((booking) => {
        if (booking.client_id && clients) {
          booking.client =
            clients.find((c) => c.id === booking.client_id) || null;
        }
      });
    }

    // Fetch team member info
    const allAppointments = typedData.flatMap((b) => b.appointments || []);
    const teamMemberIds = [
      ...new Set(allAppointments.map((a) => a.team_member_id)),
    ];

    if (teamMemberIds.length > 0) {
      const { data: teamMembers } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', teamMemberIds);

      typedData.forEach((booking) => {
        if (booking.appointments && teamMembers) {
          booking.appointments = booking.appointments.map((appt) => ({
            ...appt,
            team_member:
              teamMembers.find((tm) => tm.id === appt.team_member_id) || null,
          }));
        }
      });
    }

    return { success: true, data: typedData };
  } catch (error) {
    console.error('Error in getVenueBookings:', error);
    return { success: false, error: 'Failed to fetch bookings' };
  }
}

/**
 * Get team member's appointments for a date
 */
export async function getTeamMemberAppointments(
  teamMemberId: string,
  date: string
): Promise<{
  success: boolean;
  data?: TeamMemberAppointmentRow[];
  error?: string;
}> {
  try {
    await requireStaff();
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase.rpc('get_team_member_appointments', {
      p_team_member_id: teamMemberId,
      p_date: date,
    });

    if (error) {
      console.error('Error fetching appointments:', error);
      return { success: false, error: 'Failed to fetch appointments' };
    }

    return {
      success: true,
      data: data as unknown as TeamMemberAppointmentRow[],
    };
  } catch (error) {
    console.error('Error in getTeamMemberAppointments:', error);
    return { success: false, error: 'Failed to fetch appointments' };
  }
}

/**
 * Create booking (admin/staff)
 * RLS allows staff to create bookings with any client_id
 * Staff can set internal_notes
 */
export async function createAdminBooking(formData: CreateBookingData): Promise<{
  success: boolean;
  data?: BookingGroupInsert;
  message?: string;
  error?: string;
}> {
  try {
    const user = await requireStaff();
    const supabase = await createSupabaseJWTClient();

    // Set created_by and booking_source
    formData.booking_source = formData.booking_source || 'admin';

    // Validate appointments
    if (!formData.appointments || formData.appointments.length === 0) {
      return { success: false, error: 'At least one appointment is required' };
    }

    // Check availability for all appointments
    for (const appt of formData.appointments) {
      const { data: isAvailable, error: availError } = await supabase.rpc(
        'is_time_slot_available',
        {
          p_team_member_id: appt.team_member_id,
          p_date: formData.booking_date,
          p_start_time: appt.start_time,
          p_end_time: appt.end_time,
        }
      );

      if (availError || !isAvailable) {
        return {
          success: false,
          error: `Time slot ${appt.start_time} - ${appt.end_time} is not available`,
        };
      }
    }

    // Calculate totals
    const total_appointments = formData.appointments.length;
    const total_price = formData.appointments.reduce(
      (sum, appt) => sum + appt.price,
      0
    );

    // Create booking group
    const { data: bookingGroup, error: bookingError } = await supabase
      .from('booking_groups')
      .insert({
        venue_id: formData.venue_id,
        client_id: formData.client_id || null,
        guest_first_name: formData.guest_first_name,
        guest_last_name: formData.guest_last_name || null,
        guest_email: formData.guest_email || null,
        guest_phone: formData.guest_phone || null,
        booking_date: formData.booking_date,
        total_appointments,
        total_price,
        notes: formData.notes || null,
        internal_notes: formData.internal_notes || null, // Staff can set this
        booking_source: formData.booking_source,
        created_by: user.supabaseUserId,
      })
      .select()
      .single();

    if (bookingError || !bookingGroup) {
      console.error('Error creating booking:', bookingError);
      return { success: false, error: 'Failed to create booking' };
    }

    // Create appointments
    const appointmentsData = formData.appointments.map((appt) => ({
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
    }));

    const { error: appointmentsError } = await supabase
      .from('appointments')
      .insert(appointmentsData);

    if (appointmentsError) {
      console.error('Error creating appointments:', appointmentsError);
      // Rollback: delete booking group
      await supabase.from('booking_groups').delete().eq('id', bookingGroup.id);
      return { success: false, error: 'Failed to create appointments' };
    }

    revalidatePath('/admin/bookings');

    return {
      success: true,
      data: bookingGroup as unknown as BookingGroupInsert,
      message: 'Booking created successfully!',
    };
  } catch (error) {
    console.error('Error in createAdminBooking:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update booking (staff/admin only)
 * Staff can update all fields including internal_notes
 */
export async function updateBooking(
  bookingId: string,
  formData: UpdateBookingData
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireStaff();
    const supabase = await createSupabaseJWTClient();

    // Build update data with proper types
    const updateData: {
      guest_first_name?: string;
      guest_last_name?: string | null;
      guest_email?: string | null;
      guest_phone?: string | null;
      notes?: string | null;
      internal_notes?: string | null;
      status?: string;
    } = {};

    if (formData.guest_first_name !== undefined)
      updateData.guest_first_name = formData.guest_first_name;
    if (formData.guest_last_name !== undefined)
      updateData.guest_last_name = formData.guest_last_name;
    if (formData.guest_email !== undefined)
      updateData.guest_email = formData.guest_email;
    if (formData.guest_phone !== undefined)
      updateData.guest_phone = formData.guest_phone;
    if (formData.notes !== undefined) updateData.notes = formData.notes;
    if (formData.internal_notes !== undefined)
      updateData.internal_notes = formData.internal_notes;
    if (formData.status !== undefined) updateData.status = formData.status;

    const { error } = await supabase
      .from('booking_groups')
      .update(updateData)
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating booking:', error);
      return { success: false, error: 'Failed to update booking' };
    }

    revalidatePath('/admin/bookings');

    return { success: true, message: 'Booking updated successfully' };
  } catch (error) {
    console.error('Error in updateBooking:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update internal notes (staff/admin only)
 */
export async function updateInternalNotes(
  bookingId: string,
  internalNotes: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireStaff();
    const supabase = await createSupabaseJWTClient();

    const { error } = await supabase
      .from('booking_groups')
      .update({ internal_notes: internalNotes })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating internal notes:', error);
      return { success: false, error: 'Failed to update notes' };
    }

    revalidatePath('/admin/bookings');

    return { success: true, message: 'Notes updated successfully' };
  } catch (error) {
    console.error('Error in updateInternalNotes:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete booking (admin only)
 * RLS enforces admin-only access
 */
export async function deleteBooking(bookingId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const { error } = await supabase
      .from('booking_groups')
      .delete()
      .eq('id', bookingId);

    if (error) {
      console.error('Error deleting booking:', error);
      return { success: false, error: 'Failed to delete booking' };
    }

    revalidatePath('/admin/bookings');

    return { success: true, message: 'Booking deleted successfully' };
  } catch (error) {
    console.error('Error in deleteBooking:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Check time slot availability
 * Public function - uses JWT client but doesn't require specific auth
 */
export async function checkAvailability(
  teamMemberId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{
  success: boolean;
  available?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase.rpc('is_time_slot_available', {
      p_team_member_id: teamMemberId,
      p_date: date,
      p_start_time: startTime,
      p_end_time: endTime,
    });

    if (error) {
      console.error('Error checking availability:', error);
      return { success: false, error: 'Failed to check availability' };
    }

    return { success: true, available: data };
  } catch (error) {
    console.error('Error in checkAvailability:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get bookings for calendar view (staff/admin only)
 * Fetches bookings with appointments and team member info
 * Uses Service Role for reliable data access
 */
export async function getCalendarBookings(filters: {
  venueId?: string;
  teamMemberId?: string;
  startDate: string;
  endDate: string;
  viewType: 'day' | 'week';
}): Promise<{
  success: boolean;
  data?: CalendarBooking[];
  error?: string;
}> {
  try {
    await requireStaff();
    const supabase = await createSupabaseJWTClient();

    // Build query for booking_groups with nested appointments
    let query = supabase
      .from('booking_groups')
      .select(
        `
        id,
        venue_id,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        booking_date,
        total_appointments,
        total_price,
        status,
        notes,
        internal_notes,
        booking_source,
        created_at,
        client_id,
        venues (
          id,
          name,
          address
        ),
        appointments (
          id,
          service_name,
          start_time,
          end_time,
          duration_minutes,
          price,
          status,
          notes,
          team_member_id
        )
      `
      )
      .gte('booking_date', filters.startDate)
      .lte('booking_date', filters.endDate)
      .neq('status', 'fully_cancelled')
      .order('booking_date', { ascending: true })
      .order('created_at', { ascending: false });

    // Apply venue filter if specified
    if (filters.venueId) {
      query = query.eq('venue_id', filters.venueId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching calendar bookings:', error);
      return { success: false, error: 'Failed to fetch bookings' };
    }

    if (!bookings || bookings.length === 0) {
      return { success: true, data: [] };
    }

    // Type assertion for raw database results
    const rawBookings = bookings as RawBookingFromDB[];

    // Filter by team member if specified (client-side filtering since nested)
    let filteredBookings = rawBookings;
    if (filters.teamMemberId) {
      filteredBookings = rawBookings.filter((booking) =>
        booking.appointments?.some(
          (appt) => appt.team_member_id === filters.teamMemberId
        )
      );
    }

    // Extract unique team member IDs from all appointments
    const allAppointments = filteredBookings.flatMap(
      (b) => b.appointments || []
    );
    const teamMemberIds = [
      ...new Set(allAppointments.map((a) => a.team_member_id)),
    ];

    // Fetch team member details using Service Role (bypasses RLS)
    let teamMembers: TeamMemberFromDB[] = [];
    if (teamMemberIds.length > 0) {
      const { data, error: tmError } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, photo_url')
        .in('id', teamMemberIds);

      if (tmError) {
        console.error('Error fetching team members:', tmError);
      } else {
        teamMembers = data || [];
      }
    }

    // Transform to CalendarBooking type with team member info attached
    const calendarBookings: CalendarBooking[] = filteredBookings.map(
      (booking) => ({
        id: booking.id,
        venue_id: booking.venue_id,
        guest_first_name: booking.guest_first_name,
        guest_last_name: booking.guest_last_name,
        guest_email: booking.guest_email,
        guest_phone: booking.guest_phone,
        booking_date: booking.booking_date,
        total_appointments: booking.total_appointments,
        total_price: booking.total_price,
        status: booking.status,
        notes: booking.notes,
        internal_notes: booking.internal_notes,
        booking_source: booking.booking_source,
        created_at: booking.created_at,
        client_id: booking.client_id,
        venues: booking.venues,
        appointments: (booking.appointments || []).map((appt) => ({
          id: appt.id,
          service_name: appt.service_name,
          start_time: appt.start_time,
          end_time: appt.end_time,
          duration_minutes: appt.duration_minutes,
          price: appt.price,
          status: appt.status,
          notes: appt.notes,
          team_member_id: appt.team_member_id,
          team_member:
            teamMembers.find((tm) => tm.id === appt.team_member_id) || null,
        })),
      })
    );

    return { success: true, data: calendarBookings };
  } catch (error) {
    console.error('Error in getCalendarBookings:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
