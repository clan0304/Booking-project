// app/actions/client-profile.ts
'use server';

import { requireStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

// =====================================================
// TYPES
// =====================================================

interface ClientAppointment {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  venue: {
    name: string;
  } | null;
  appointments: Array<{
    id: string;
    service_name: string;
    start_time: string;
    duration_minutes: number;
    price: number;
    team_member: {
      first_name: string;
      last_name: string | null;
    } | null;
    team_member_id: string;
  }>;
  payment_status: string | null;
  total_price: number | null;
  internal_notes: string | null;
  notes: string | null; // Client booking notes
}

interface ClientNote {
  id: string;
  note: string;
  created_at: string;
  created_by_name: string | null;
}

interface AppointmentNote {
  id: string;
  booking_date: string;
  notes: string | null; // Client's booking notes
  internal_notes: string | null; // Staff internal notes
  team_member_name: string | null;
}

// =====================================================
// APPOINTMENT HISTORY
// =====================================================

/**
 * Get client's appointment history (past and upcoming)
 */
export async function getClientAppointmentHistory(
  clientId: string
): Promise<{ success: boolean; data?: ClientAppointment[]; error?: string }> {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('booking_groups')
      .select(
        `
        id,
        booking_date,
        status,
        payment_status,
        total_price,
        internal_notes,
        notes,
        venue:venues!booking_groups_venue_id_fkey (
          name
        ),
        appointments (
          id,
          service_name,
          start_time,
          duration_minutes,
          price,
          team_member_id,
          team_member:users!appointments_team_member_id_fkey (
            first_name,
            last_name
          )
        )
      `
      )
      .eq('client_id', clientId)
      .order('booking_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching client appointments:', error);
      return { success: false, error: 'Failed to fetch appointments' };
    }

    // Transform data - Supabase returns single FK relations as arrays
    const transformed: ClientAppointment[] = (data || []).map((booking) => {
      // Handle venue - extract from array if needed
      const venueData = Array.isArray(booking.venue)
        ? booking.venue[0]
        : booking.venue;

      // Handle appointments with team_member transform
      const appointmentsData = (booking.appointments || []).map(
        (apt: {
          id: string;
          service_name: string;
          start_time: string;
          duration_minutes: number;
          price: number;
          team_member_id: string;
          team_member:
            | { first_name: string; last_name: string | null }
            | { first_name: string; last_name: string | null }[]
            | null;
        }) => {
          const teamMemberData = Array.isArray(apt.team_member)
            ? apt.team_member[0]
            : apt.team_member;

          return {
            id: apt.id,
            service_name: apt.service_name,
            start_time: apt.start_time,
            duration_minutes: apt.duration_minutes,
            price: apt.price,
            team_member: teamMemberData || null,
            team_member_id: apt.team_member_id,
          };
        }
      );

      return {
        id: booking.id,
        booking_date: booking.booking_date,
        start_time: appointmentsData[0]?.start_time || '00:00',
        status: booking.status,
        venue: venueData || null,
        appointments: appointmentsData,
        payment_status: booking.payment_status,
        total_price: booking.total_price,
        internal_notes: booking.internal_notes,
        notes: booking.notes,
      };
    });

    return { success: true, data: transformed };
  } catch (error) {
    console.error('Error in getClientAppointmentHistory:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// SALES HISTORY
// =====================================================

/**
 * Get client's sales history
 */
export async function getClientSalesHistory(
  clientId: string
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
  try {
    await requireStaff();

    // TODO: Implement when sales reporting is ready
    // For now, query completed bookings as a placeholder
    const { data } = await supabaseAdmin
      .from('booking_groups')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .limit(0);

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in getClientSalesHistory:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// REVIEWS
// =====================================================

/**
 * Get client's reviews
 */
export async function getClientReviews(
  clientId: string
): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
  try {
    await requireStaff();

    // TODO: Implement when reviews table is ready
    const { data } = await supabaseAdmin
      .from('booking_groups')
      .select('id')
      .eq('client_id', clientId)
      .limit(0);

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in getClientReviews:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// CLIENT NOTES (from client_notes table - staff only)
// =====================================================

/**
 * Get client notes from client_notes table
 * These are private staff notes about the client (not visible to client)
 */
export async function getClientNotes(
  clientId: string
): Promise<{ success: boolean; data?: ClientNote[]; error?: string }> {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('client_notes')
      .select(
        `
        id,
        note,
        created_at,
        creator:users!client_notes_created_by_fkey (
          first_name,
          last_name
        )
      `
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching client notes:', error);
      return { success: false, error: 'Failed to fetch client notes' };
    }

    // Transform data - handle Supabase FK array return
    const transformed: ClientNote[] = (data || []).map((note) => {
      const creatorData = Array.isArray(note.creator)
        ? note.creator[0]
        : note.creator;

      return {
        id: note.id,
        note: note.note,
        created_at: note.created_at,
        created_by_name: creatorData
          ? `${creatorData.first_name}${
              creatorData.last_name ? ' ' + creatorData.last_name : ''
            }`
          : null,
      };
    });

    return { success: true, data: transformed };
  } catch (error) {
    console.error('Error in getClientNotes:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Add a new client note
 * Staff-only note about the client
 */
export async function addClientNote(
  clientId: string,
  note: string
): Promise<{ success: boolean; noteId?: string; error?: string }> {
  try {
    const user = await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('client_notes')
      .insert({
        client_id: clientId,
        note: note.trim(),
        created_by: user.supabaseUserId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error adding client note:', error);
      return { success: false, error: 'Failed to add note' };
    }

    return { success: true, noteId: data?.id };
  } catch (error) {
    console.error('Error in addClientNote:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update a client note
 */
export async function updateClientNote(
  noteId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireStaff();

    const { error } = await supabaseAdmin
      .from('client_notes')
      .update({ note: note.trim() })
      .eq('id', noteId);

    if (error) {
      console.error('Error updating client note:', error);
      return { success: false, error: 'Failed to update note' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateClientNote:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete a client note
 */
export async function deleteClientNote(
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireStaff();

    const { error } = await supabaseAdmin
      .from('client_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('Error deleting client note:', error);
      return { success: false, error: 'Failed to delete note' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteClientNote:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// APPOINTMENT NOTES (internal staff notes from booking_groups)
// =====================================================

/**
 * Get internal staff notes for a client's appointments
 * These are notes added by staff (not client booking notes)
 */
export async function getClientAppointmentNotes(
  clientId: string
): Promise<{ success: boolean; data?: AppointmentNote[]; error?: string }> {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('booking_groups')
      .select(
        `
        id,
        booking_date,
        internal_notes,
        appointments (
          team_member:users!appointments_team_member_id_fkey (
            first_name,
            last_name
          )
        )
      `
      )
      .eq('client_id', clientId)
      .not('internal_notes', 'is', null)
      .neq('internal_notes', '')
      .order('booking_date', { ascending: false });

    if (error) {
      console.error('Error fetching appointment notes:', error);
      return { success: false, error: 'Failed to fetch appointment notes' };
    }

    // Transform data
    const transformed: AppointmentNote[] = (data || []).map((booking) => {
      // Get first team member name from appointments
      const firstAppointment = booking.appointments?.[0];
      const teamMember = firstAppointment?.team_member;
      const teamMemberData = Array.isArray(teamMember)
        ? teamMember[0]
        : teamMember;

      return {
        id: booking.id,
        booking_date: booking.booking_date,
        notes: null, // Not used in this query
        internal_notes: booking.internal_notes || null,
        team_member_name: teamMemberData
          ? `${teamMemberData.first_name}${
              teamMemberData.last_name ? ' ' + teamMemberData.last_name : ''
            }`
          : null,
      };
    });

    return { success: true, data: transformed };
  } catch (error) {
    console.error('Error in getClientAppointmentNotes:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// CLIENT ALERT/MEMO (from users.alert_note)
// =====================================================

/**
 * Check if client is "new" (no completed or no_show appointments)
 */
export async function checkClientIsNew(
  clientId: string
): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
  try {
    await requireStaff();

    const { count, error } = await supabaseAdmin
      .from('booking_groups')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['completed', 'no_show']);

    if (error) {
      console.error('Error checking if client is new:', error);
      return { success: false, error: 'Failed to check client status' };
    }

    return { success: true, isNew: count === 0 };
  } catch (error) {
    console.error('Error in checkClientIsNew:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get client memo/alert note
 */
export async function getClientMemo(
  clientId: string
): Promise<{ success: boolean; data?: string | null; error?: string }> {
  try {
    await requireStaff();

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('alert_note')
      .eq('id', clientId)
      .single();

    if (error) {
      console.error('Error fetching client memo:', error);
      return { success: false, error: 'Failed to fetch memo' };
    }

    return { success: true, data: data?.alert_note || null };
  } catch (error) {
    console.error('Error in getClientMemo:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update client memo/alert note
 */
export async function updateClientMemo(
  clientId: string,
  memo: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireStaff();

    const { error } = await supabaseAdmin
      .from('users')
      .update({ alert_note: memo })
      .eq('id', clientId);

    if (error) {
      console.error('Error updating client memo:', error);
      return { success: false, error: 'Failed to update memo' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateClientMemo:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
