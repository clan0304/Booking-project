// app/actions/search.ts
'use server';

import { requireStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

// =====================================================
// TYPES
// =====================================================

export interface SearchClient {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  photo_url: string | null;
  is_registered: boolean;
}

export interface SearchAppointment {
  id: string;
  booking_group_id: string;
  service_name: string;
  start_time: string;
  end_time: string;
  status: string;
  team_member: {
    id: string;
    first_name: string;
    last_name: string | null;
  } | null;
  booking: {
    id: string;
    booking_date: string;
    guest_first_name: string;
    guest_last_name: string | null;
    venue: {
      id: string;
      name: string;
    } | null;
  };
}

export interface SearchResults {
  clients: SearchClient[];
  appointments: SearchAppointment[];
}

// Helper types for Supabase query results
interface TeamMemberRow {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface VenueRow {
  id: string;
  name: string;
}

interface BookingRow {
  id: string;
  booking_date: string;
  guest_first_name: string;
  guest_last_name: string | null;
  venue: VenueRow | VenueRow[] | null;
}

interface AppointmentRow {
  id: string;
  booking_group_id: string;
  service_name: string;
  start_time: string;
  end_time: string;
  status: string;
  team_member: TeamMemberRow | TeamMemberRow[] | null;
  booking: BookingRow | BookingRow[] | null;
}

// Helper to extract single object from Supabase relation (handles array or single)
function extractSingle<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  return data;
}

// Transform raw appointment to SearchAppointment
function transformAppointment(apt: AppointmentRow): SearchAppointment | null {
  const booking = extractSingle(apt.booking);
  if (!booking) return null;

  const teamMember = extractSingle(apt.team_member);
  const venue = extractSingle(booking.venue);

  return {
    id: apt.id,
    booking_group_id: apt.booking_group_id,
    service_name: apt.service_name,
    start_time: apt.start_time,
    end_time: apt.end_time,
    status: apt.status,
    team_member: teamMember
      ? {
          id: teamMember.id,
          first_name: teamMember.first_name,
          last_name: teamMember.last_name,
        }
      : null,
    booking: {
      id: booking.id,
      booking_date: booking.booking_date,
      guest_first_name: booking.guest_first_name,
      guest_last_name: booking.guest_last_name,
      venue: venue
        ? {
            id: venue.id,
            name: venue.name,
          }
        : null,
    },
  };
}

// =====================================================
// SEARCH ACTION
// =====================================================

export async function globalSearch(query: string): Promise<{
  success: boolean;
  data?: SearchResults;
  error?: string;
}> {
  try {
    await requireStaff();

    if (!query || query.trim().length < 2) {
      return {
        success: true,
        data: { clients: [], appointments: [] },
      };
    }

    const searchTerm = query.trim().toLowerCase();

    // Search clients
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('users')
      .select(
        'id, first_name, last_name, email, phone_number, photo_url, is_registered'
      )
      .contains('roles', ['client'])
      .or(
        `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`
      )
      .order('first_name', { ascending: true })
      .limit(10);

    if (clientsError) {
      console.error('Error searching clients:', clientsError);
    }

    // Search appointments - query from booking_groups to filter by guest name
    const { data: bookingGroups, error: appointmentsError } =
      await supabaseAdmin
        .from('booking_groups')
        .select(
          `
        id,
        booking_date,
        guest_first_name,
        guest_last_name,
        venue:venues (
          id,
          name
        ),
        appointments (
          id,
          booking_group_id,
          service_name,
          start_time,
          end_time,
          status,
          team_member:users!appointments_team_member_id_fkey (
            id,
            first_name,
            last_name
          )
        )
      `
        )
        .gte('booking_date', new Date().toISOString().split('T')[0])
        .or(
          `guest_first_name.ilike.%${searchTerm}%,guest_last_name.ilike.%${searchTerm}%`
        )
        .in('status', ['confirmed', 'pending'])
        .order('booking_date', { ascending: true })
        .limit(20); // Get more to allow for service name filtering

    if (appointmentsError) {
      console.error('Error searching appointments:', appointmentsError);
    }

    // Flatten appointments from booking groups
    const appointments: AppointmentRow[] = [];
    if (bookingGroups) {
      for (const bg of bookingGroups) {
        const bgAppointments = bg.appointments as Array<{
          id: string;
          booking_group_id: string;
          service_name: string;
          start_time: string;
          end_time: string;
          status: string;
          team_member: TeamMemberRow | TeamMemberRow[] | null;
        }>;

        if (bgAppointments) {
          for (const apt of bgAppointments) {
            // Include appointments with valid status
            if (apt.status === 'confirmed' || apt.status === 'pending') {
              appointments.push({
                id: apt.id,
                booking_group_id: apt.booking_group_id,
                service_name: apt.service_name,
                start_time: apt.start_time,
                end_time: apt.end_time,
                status: apt.status,
                team_member: apt.team_member,
                booking: {
                  id: bg.id,
                  booking_date: bg.booking_date,
                  guest_first_name: bg.guest_first_name,
                  guest_last_name: bg.guest_last_name,
                  venue: bg.venue as VenueRow | VenueRow[] | null,
                },
              });
            }
          }
        }
      }
    }

    // Sort by start_time
    appointments.sort((a, b) => a.start_time.localeCompare(b.start_time));

    // Transform appointments data
    const transformedAppointments: SearchAppointment[] = appointments
      .map(transformAppointment)
      .filter((apt): apt is SearchAppointment => apt !== null)
      .slice(0, 10);

    return {
      success: true,
      data: {
        clients: clients || [],
        appointments: transformedAppointments,
      },
    };
  } catch (error) {
    console.error('Search error:', error);
    return { success: false, error: 'Failed to search' };
  }
}

// =====================================================
// GET RECENT CLIENTS
// =====================================================

export async function getRecentClients(): Promise<{
  success: boolean;
  data?: SearchClient[];
  error?: string;
}> {
  try {
    await requireStaff();

    const { data: clients, error } = await supabaseAdmin
      .from('users')
      .select(
        'id, first_name, last_name, email, phone_number, photo_url, is_registered'
      )
      .contains('roles', ['client'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching recent clients:', error);
      return { success: false, error: 'Failed to fetch recent clients' };
    }

    return { success: true, data: clients || [] };
  } catch (error) {
    console.error('Recent clients error:', error);
    return { success: false, error: 'Failed to fetch recent clients' };
  }
}

// =====================================================
// GET UPCOMING APPOINTMENTS
// =====================================================

export async function getUpcomingAppointments(): Promise<{
  success: boolean;
  data?: SearchAppointment[];
  error?: string;
}> {
  try {
    await requireStaff();

    const today = new Date().toISOString().split('T')[0];

    // First get upcoming booking groups with their appointments
    const { data: bookingGroups, error } = await supabaseAdmin
      .from('booking_groups')
      .select(
        `
        id,
        booking_date,
        guest_first_name,
        guest_last_name,
        venue:venues (
          id,
          name
        ),
        appointments (
          id,
          booking_group_id,
          service_name,
          start_time,
          end_time,
          status,
          team_member:users!appointments_team_member_id_fkey (
            id,
            first_name,
            last_name
          )
        )
      `
      )
      .gte('booking_date', today)
      .in('status', ['confirmed', 'pending'])
      .order('booking_date', { ascending: true })
      .limit(10);

    // Flatten appointments from booking groups
    const appointments: AppointmentRow[] = [];
    if (bookingGroups) {
      for (const bg of bookingGroups) {
        const bgAppointments = bg.appointments as Array<{
          id: string;
          booking_group_id: string;
          service_name: string;
          start_time: string;
          end_time: string;
          status: string;
          team_member: TeamMemberRow | TeamMemberRow[] | null;
        }>;

        if (bgAppointments) {
          for (const apt of bgAppointments) {
            if (apt.status === 'confirmed' || apt.status === 'pending') {
              appointments.push({
                id: apt.id,
                booking_group_id: apt.booking_group_id,
                service_name: apt.service_name,
                start_time: apt.start_time,
                end_time: apt.end_time,
                status: apt.status,
                team_member: apt.team_member,
                booking: {
                  id: bg.id,
                  booking_date: bg.booking_date,
                  guest_first_name: bg.guest_first_name,
                  guest_last_name: bg.guest_last_name,
                  venue: bg.venue as VenueRow | VenueRow[] | null,
                },
              });
            }
          }
        }
      }
    }

    // Sort by start_time
    appointments.sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (error) {
      console.error('Error fetching upcoming appointments:', error);
      return { success: false, error: 'Failed to fetch upcoming appointments' };
    }

    // Transform appointments data (already transformed during flattening)
    const transformedAppointments: SearchAppointment[] = appointments
      .map(transformAppointment)
      .filter((apt): apt is SearchAppointment => apt !== null)
      .slice(0, 10); // Limit to 10

    return { success: true, data: transformedAppointments };
  } catch (error) {
    console.error('Upcoming appointments error:', error);
    return { success: false, error: 'Failed to fetch upcoming appointments' };
  }
}
