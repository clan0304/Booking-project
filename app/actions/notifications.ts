// app/actions/notifications.ts
'use server';

import { requireStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// =====================================================
// TYPES
// =====================================================

export type NotificationType =
  | 'booking_created'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'review_received'
  | 'tip_received';

export type NotificationCategory = 'appointments' | 'reviews' | 'tips';

export interface NotificationMetadata {
  price?: number;
  service_name?: string;
  booking_date?: string;
  booking_time?: string;
  team_member_name?: string;
  venue_name?: string;
  booking_source?: string;
  old_date?: string;
  old_time?: string;
  new_date?: string;
  new_time?: string;
  cancellation_reason?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  booking_group_id: string | null;
  client_id: string | null;
  venue_id: string | null;
  team_member_id: string | null;
  metadata: NotificationMetadata;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  } | null;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  appointments: number;
  reviews: number;
  tips: number;
}

// =====================================================
// GET NOTIFICATIONS
// =====================================================

export async function getNotifications(options?: {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: Notification[];
  error?: string;
}> {
  try {
    await requireStaff();

    let query = supabaseAdmin
      .from('notifications')
      .select(
        `
        *,
        client:users!notifications_client_id_fkey (
          id,
          first_name,
          last_name,
          photo_url
        )
      `
      )
      .order('created_at', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return { success: false, error: 'Failed to fetch notifications' };
    }

    // Transform client data (handle array from Supabase)
    const notifications: Notification[] = (data || []).map((n) => ({
      ...n,
      client: Array.isArray(n.client) ? n.client[0] : n.client,
    }));

    return { success: true, data: notifications };
  } catch (error) {
    console.error('Notifications error:', error);
    return { success: false, error: 'Failed to fetch notifications' };
  }
}

// =====================================================
// GET NOTIFICATION COUNTS
// =====================================================

export async function getNotificationCounts(): Promise<{
  success: boolean;
  data?: NotificationCounts;
  error?: string;
}> {
  try {
    await requireStaff();

    // Get total count
    const { count: total, error: totalError } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Get unread count
    const { count: unread, error: unreadError } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    if (unreadError) throw unreadError;

    // Get category counts (unread only)
    const { count: appointments, error: appointmentsError } =
      await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'appointments')
        .eq('is_read', false);

    if (appointmentsError) throw appointmentsError;

    const { count: reviews, error: reviewsError } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'reviews')
      .eq('is_read', false);

    if (reviewsError) throw reviewsError;

    const { count: tips, error: tipsError } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'tips')
      .eq('is_read', false);

    if (tipsError) throw tipsError;

    return {
      success: true,
      data: {
        total: total || 0,
        unread: unread || 0,
        appointments: appointments || 0,
        reviews: reviews || 0,
        tips: tips || 0,
      },
    };
  } catch (error) {
    console.error('Notification counts error:', error);
    return { success: false, error: 'Failed to fetch notification counts' };
  }
}

// =====================================================
// MARK AS READ
// =====================================================

export async function markNotificationAsRead(notificationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireStaff();

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: 'Failed to mark notification as read' };
    }

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Mark as read error:', error);
    return { success: false, error: 'Failed to mark notification as read' };
  }
}

// =====================================================
// MARK ALL AS READ
// =====================================================

export async function markAllNotificationsAsRead(
  category?: NotificationCategory
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireStaff();

    let query = supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('is_read', false);

    if (category) {
      query = query.eq('category', category);
    }

    const { error } = await query;

    if (error) {
      console.error('Error marking all as read:', error);
      return { success: false, error: 'Failed to mark all as read' };
    }

    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Mark all as read error:', error);
    return { success: false, error: 'Failed to mark all as read' };
  }
}

// =====================================================
// CREATE NOTIFICATION (Internal use)
// =====================================================

export async function createNotification(data: {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  bookingGroupId?: string;
  clientId?: string;
  venueId?: string;
  teamMemberId?: string;
  metadata?: NotificationMetadata;
}): Promise<{
  success: boolean;
  notificationId?: string;
  error?: string;
}> {
  try {
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        type: data.type,
        category: data.category,
        title: data.title,
        message: data.message,
        booking_group_id: data.bookingGroupId || null,
        client_id: data.clientId || null,
        venue_id: data.venueId || null,
        team_member_id: data.teamMemberId || null,
        metadata: data.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return { success: false, error: 'Failed to create notification' };
    }

    return { success: true, notificationId: notification.id };
  } catch (error) {
    console.error('Create notification error:', error);
    return { success: false, error: 'Failed to create notification' };
  }
}

// =====================================================
// HELPER: Create Booking Notification
// =====================================================

export async function createBookingNotification(data: {
  type: 'booking_created' | 'booking_cancelled' | 'booking_rescheduled';
  bookingGroupId: string;
  clientId?: string;
  clientName: string;
  venueId: string;
  venueName: string;
  teamMemberId?: string;
  teamMemberName?: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  price: number;
  bookingSource?: string;
  // For rescheduling
  oldDate?: string;
  oldTime?: string;
  // For cancellation
  cancellationReason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let title: string;
    let message: string;

    const formattedDate = new Date(
      data.bookingDate + 'T00:00:00'
    ).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    const formattedTime = formatTime12Hour(data.bookingTime);

    switch (data.type) {
      case 'booking_created':
        title = `${data.clientName} booked online from $${data.price}`;
        message = `${formattedTime} ${formattedDate} ${
          data.serviceName
        } booked online with ${data.teamMemberName || 'Any Professional'} at ${
          data.venueName
        }`;
        break;

      case 'booking_cancelled':
        title = `${data.clientName} cancelled booking`;
        message = `${formattedTime} ${formattedDate} ${data.serviceName} with ${
          data.teamMemberName || 'Any Professional'
        } at ${data.venueName} was cancelled`;
        if (data.cancellationReason) {
          message += `. Reason: ${data.cancellationReason}`;
        }
        break;

      case 'booking_rescheduled':
        const oldFormattedDate = data.oldDate
          ? new Date(data.oldDate + 'T00:00:00').toLocaleDateString('en-AU', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })
          : '';
        const oldFormattedTime = data.oldTime
          ? formatTime12Hour(data.oldTime)
          : '';

        title = `${data.clientName} rescheduled booking`;
        message = `${
          data.serviceName
        } moved from ${oldFormattedTime} ${oldFormattedDate} to ${formattedTime} ${formattedDate} with ${
          data.teamMemberName || 'Any Professional'
        } at ${data.venueName}`;
        break;

      default:
        return { success: false, error: 'Invalid notification type' };
    }

    const result = await createNotification({
      type: data.type,
      category: 'appointments',
      title,
      message,
      bookingGroupId: data.bookingGroupId,
      clientId: data.clientId,
      venueId: data.venueId,
      teamMemberId: data.teamMemberId,
      metadata: {
        price: data.price,
        service_name: data.serviceName,
        booking_date: data.bookingDate,
        booking_time: data.bookingTime,
        team_member_name: data.teamMemberName,
        venue_name: data.venueName,
        booking_source: data.bookingSource || 'online',
        old_date: data.oldDate,
        old_time: data.oldTime,
        cancellation_reason: data.cancellationReason,
      },
    });

    return result;
  } catch (error) {
    console.error('Create booking notification error:', error);
    return { success: false, error: 'Failed to create booking notification' };
  }
}

// Helper function
function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes}${ampm}`;
}

// =====================================================
// GET BOOKING GROUP BY ID (for notification click)
// Re-export type from calendar for convenience
// =====================================================

export type { BookingGroupWithAppointments } from '@/types/calendar';

import type { BookingGroupWithAppointments } from '@/types/calendar';

export async function getBookingGroupById(bookingGroupId: string): Promise<{
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
          photo_url
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
      .eq('id', bookingGroupId)
      .single();

    if (bookingError || !booking) {
      console.error('Error fetching booking:', bookingError);
      return { success: false, error: 'Booking not found' };
    }

    // Transform nested data (handle Supabase arrays)
    type ClientData = {
      id: string;
      first_name: string;
      last_name: string | null;
      email: string;
      phone_number: string | null;
      photo_url: string | null;
    };

    type TeamMemberData = {
      id: string;
      first_name: string;
      last_name: string;
      photo_url: string | null;
    };

    type AppointmentData = {
      id: string;
      booking_group_id: string;
      service_id: string;
      service_name: string;
      team_member_id: string;
      start_time: string;
      end_time: string;
      duration_minutes: number;
      price: number;
      status: string;
      notes: string | null;
      created_at: string;
      team_member: TeamMemberData | TeamMemberData[] | null;
    };

    const client = Array.isArray(booking.client)
      ? (booking.client[0] as ClientData | undefined)
      : (booking.client as ClientData | null);

    const appointments = (booking.appointments || []).map(
      (apt: AppointmentData) => ({
        ...apt,
        team_member: Array.isArray(apt.team_member)
          ? apt.team_member[0]
          : apt.team_member,
      })
    );

    const transformedBooking = {
      ...booking,
      client: client || null,
      appointments,
    } as unknown as BookingGroupWithAppointments;

    return { success: true, data: transformedBooking };
  } catch (error) {
    console.error('Error in getBookingGroupById:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
