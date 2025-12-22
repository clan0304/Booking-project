// app/actions/booking-holds.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';

// Hold duration in minutes
const HOLD_DURATION_MINUTES = 15;

// =====================================================
// TYPES
// =====================================================

interface HoldService {
  service_id: string;
  service_name: string;
  duration: number;
  price: number;
}

interface CreateHoldParams {
  venueId: string;
  teamMemberId: string;
  holdDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  services: HoldService[];
  sessionToken?: string; // If continuing an existing session
}

interface BookingHold {
  id: string;
  venue_id: string;
  team_member_id: string;
  user_id: string | null;
  session_token: string;
  hold_date: string;
  start_time: string;
  end_time: string;
  services: HoldService[];
  created_at: string;
  expires_at: string;
  team_member?: {
    first_name: string;
    last_name: string | null;
  };
}

// =====================================================
// HELPER: Check if teamMemberId is valid UUID
// =====================================================

function isValidUUID(str: string): boolean {
  // Check for "any" or empty string
  if (!str || str === 'any') {
    return false;
  }

  // UUID regex pattern
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// =====================================================
// HELPER: Get current user's internal ID
// =====================================================

async function getCurrentUserInternalId(): Promise<string | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Use clerk_user_id (not clerk_id!)
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  return user?.id || null;
}

// =====================================================
// HELPER: Cleanup expired holds (safe call)
// =====================================================

async function safeCleanupExpiredHolds(): Promise<void> {
  try {
    // Try to call the database function
    const { error } = await supabaseAdmin.rpc('cleanup_expired_booking_holds');
    if (error) {
      // Function might not exist yet, that's OK
      console.warn('cleanup_expired_booking_holds RPC failed:', error.message);
    }
  } catch {
    // Silently ignore - function might not exist yet
  }
}

// =====================================================
// CREATE BOOKING HOLD
// =====================================================

export async function createBookingHold(params: CreateHoldParams): Promise<{
  success: boolean;
  hold?: BookingHold;
  sessionToken?: string;
  error?: string;
}> {
  try {
    const internalUserId = await getCurrentUserInternalId();

    if (!internalUserId) {
      return { success: false, error: 'Authentication required' };
    }

    const {
      venueId,
      teamMemberId,
      holdDate,
      startTime,
      endTime,
      services,
      sessionToken,
    } = params;

    // Skip hold creation for "Any Professional" selection
    if (!isValidUUID(teamMemberId)) {
      console.log('Skipping hold creation for "Any Professional" selection');
      return {
        success: true,
        sessionToken: sessionToken || uuidv4(),
        // No hold created, but we return success so booking can proceed
      };
    }

    // Generate or use existing session token
    const token = sessionToken || uuidv4();

    // First, cleanup any expired holds
    await safeCleanupExpiredHolds();

    // Delete any existing holds for this session token
    if (sessionToken) {
      await supabaseAdmin
        .from('booking_holds')
        .delete()
        .eq('session_token', sessionToken);
    }

    // Check for conflicts with existing appointments
    const { data: conflictingAppointments } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('team_member_id', teamMemberId)
      .eq('appointment_date', holdDate)
      .neq('status', 'cancelled')
      .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

    if (conflictingAppointments && conflictingAppointments.length > 0) {
      return { success: false, error: 'Time slot is no longer available' };
    }

    // Check for conflicts with other holds (excluding user's own holds)
    const { data: conflictingHolds } = await supabaseAdmin
      .from('booking_holds')
      .select('id, user_id')
      .eq('team_member_id', teamMemberId)
      .eq('hold_date', holdDate)
      .neq('user_id', internalUserId)
      .gt('expires_at', new Date().toISOString())
      .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

    if (conflictingHolds && conflictingHolds.length > 0) {
      return {
        success: false,
        error: 'Time slot is currently being booked by another user',
      };
    }

    // Calculate expiration time (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + HOLD_DURATION_MINUTES);

    // Create the hold
    const { data: hold, error } = await supabaseAdmin
      .from('booking_holds')
      .insert({
        venue_id: venueId,
        team_member_id: teamMemberId,
        user_id: internalUserId,
        session_token: token,
        hold_date: holdDate,
        start_time: startTime,
        end_time: endTime,
        services: services,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking hold:', error);
      return { success: false, error: 'Failed to create booking hold' };
    }

    return {
      success: true,
      hold: hold as BookingHold,
      sessionToken: token,
    };
  } catch (error) {
    console.error('Error in createBookingHold:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// CREATE MULTIPLE HOLDS (for multiple team members)
// =====================================================

export async function createMultipleBookingHolds(params: {
  venueId: string;
  holdDate: string;
  appointments: Array<{
    teamMemberId: string;
    startTime: string;
    endTime: string;
    serviceId: string;
    serviceName: string;
    duration: number;
    price: number;
  }>;
  sessionToken?: string;
}): Promise<{
  success: boolean;
  sessionToken?: string;
  holds?: BookingHold[];
  error?: string;
}> {
  try {
    const internalUserId = await getCurrentUserInternalId();

    if (!internalUserId) {
      return { success: false, error: 'Authentication required' };
    }

    const { venueId, holdDate, appointments, sessionToken } = params;
    const token = sessionToken || uuidv4();

    // Filter out appointments with "any" team member (not valid UUID)
    const validAppointments = appointments.filter((appt) =>
      isValidUUID(appt.teamMemberId)
    );

    // If all appointments are "Any Professional", skip hold creation
    if (validAppointments.length === 0) {
      console.log(
        'All appointments are "Any Professional" - skipping hold creation'
      );
      return {
        success: true,
        sessionToken: token,
        holds: [],
      };
    }

    // Cleanup expired holds first
    await safeCleanupExpiredHolds();

    // Delete any existing holds for this session token
    if (sessionToken) {
      await supabaseAdmin
        .from('booking_holds')
        .delete()
        .eq('session_token', sessionToken);
    }

    // Group appointments by team member (only valid UUIDs)
    const holdsByTeamMember = new Map<string, typeof validAppointments>();

    for (const appt of validAppointments) {
      const existing = holdsByTeamMember.get(appt.teamMemberId) || [];
      existing.push(appt);
      holdsByTeamMember.set(appt.teamMemberId, existing);
    }

    // Check for conflicts and create holds
    const createdHolds: BookingHold[] = [];
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + HOLD_DURATION_MINUTES);

    for (const [teamMemberId, teamAppointments] of holdsByTeamMember) {
      // Calculate overall time range for this team member
      const startTimes = teamAppointments.map((a) => a.startTime).sort();
      const endTimes = teamAppointments.map((a) => a.endTime).sort();
      const overallStart = startTimes[0];
      const overallEnd = endTimes[endTimes.length - 1];

      // Check for conflicting appointments
      const { data: conflictingAppointments } = await supabaseAdmin
        .from('appointments')
        .select('id')
        .eq('team_member_id', teamMemberId)
        .eq('appointment_date', holdDate)
        .neq('status', 'cancelled')
        .or(`and(start_time.lt.${overallEnd},end_time.gt.${overallStart})`);

      if (conflictingAppointments && conflictingAppointments.length > 0) {
        // Rollback: delete any created holds
        if (createdHolds.length > 0) {
          await supabaseAdmin
            .from('booking_holds')
            .delete()
            .in(
              'id',
              createdHolds.map((h) => h.id)
            );
        }
        return {
          success: false,
          error: 'One or more time slots are no longer available',
        };
      }

      // Check for conflicting holds from other users
      const { data: conflictingHolds } = await supabaseAdmin
        .from('booking_holds')
        .select('id')
        .eq('team_member_id', teamMemberId)
        .eq('hold_date', holdDate)
        .neq('user_id', internalUserId)
        .gt('expires_at', new Date().toISOString())
        .or(`and(start_time.lt.${overallEnd},end_time.gt.${overallStart})`);

      if (conflictingHolds && conflictingHolds.length > 0) {
        // Rollback: delete any created holds
        if (createdHolds.length > 0) {
          await supabaseAdmin
            .from('booking_holds')
            .delete()
            .in(
              'id',
              createdHolds.map((h) => h.id)
            );
        }
        return {
          success: false,
          error: 'Time slot is currently being booked by another user',
        };
      }

      // Create services array
      const services: HoldService[] = teamAppointments.map((a) => ({
        service_id: a.serviceId,
        service_name: a.serviceName,
        duration: a.duration,
        price: a.price,
      }));

      const { data: hold, error } = await supabaseAdmin
        .from('booking_holds')
        .insert({
          venue_id: venueId,
          team_member_id: teamMemberId,
          user_id: internalUserId,
          session_token: token,
          hold_date: holdDate,
          start_time: overallStart,
          end_time: overallEnd,
          services: services,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        // Rollback: delete any created holds
        if (createdHolds.length > 0) {
          await supabaseAdmin
            .from('booking_holds')
            .delete()
            .in(
              'id',
              createdHolds.map((h) => h.id)
            );
        }
        console.error('Error creating hold:', error);
        return { success: false, error: 'Failed to create booking hold' };
      }

      createdHolds.push(hold as BookingHold);
    }

    return {
      success: true,
      sessionToken: token,
      holds: createdHolds,
    };
  } catch (error) {
    console.error('Error in createMultipleBookingHolds:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// RELEASE BOOKING HOLD (DELETE)
// =====================================================

export async function releaseBookingHold(sessionToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const internalUserId = await getCurrentUserInternalId();

    if (!internalUserId) {
      return { success: false, error: 'Authentication required' };
    }

    // Delete all holds for this session token (and user)
    const { error } = await supabaseAdmin
      .from('booking_holds')
      .delete()
      .eq('session_token', sessionToken)
      .eq('user_id', internalUserId);

    if (error) {
      console.error('Error releasing booking hold:', error);
      return { success: false, error: 'Failed to release hold' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in releaseBookingHold:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// DELETE HOLD AFTER BOOKING COMPLETED
// =====================================================

export async function deleteHoldAfterBooking(sessionToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Simply delete all holds for this session token
    const { error } = await supabaseAdmin
      .from('booking_holds')
      .delete()
      .eq('session_token', sessionToken);

    if (error) {
      console.error('Error deleting hold after booking:', error);
      return { success: false, error: 'Failed to delete hold' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteHoldAfterBooking:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// GET ACTIVE HOLDS FOR ADMIN CALENDAR
// =====================================================

export async function getActiveHoldsForCalendar(
  venueId: string,
  date: string
): Promise<{
  holds: BookingHold[];
  error?: string;
}> {
  try {
    // First cleanup expired holds
    await safeCleanupExpiredHolds();

    const { data: holds, error } = await supabaseAdmin
      .from('booking_holds')
      .select(
        `
        *,
        team_member:users!booking_holds_team_member_id_fkey(
          first_name,
          last_name
        )
      `
      )
      .eq('venue_id', venueId)
      .eq('hold_date', date)
      .gt('expires_at', new Date().toISOString())
      .order('start_time');

    if (error) {
      console.error('Error fetching active holds:', error);
      return { holds: [], error: 'Failed to fetch holds' };
    }

    return { holds: (holds || []) as BookingHold[] };
  } catch (error) {
    console.error('Error in getActiveHoldsForCalendar:', error);
    return { holds: [], error: 'An unexpected error occurred' };
  }
}

// =====================================================
// GET ACTIVE HOLDS FOR AVAILABILITY CHECK
// =====================================================

export async function getActiveHoldsForAvailability(
  venueId: string,
  teamMemberId: string,
  date: string,
  excludeUserId?: string
): Promise<{
  holds: Array<{ start_time: string; end_time: string }>;
  error?: string;
}> {
  try {
    // Skip if "Any Professional" - no holds to check
    if (!isValidUUID(teamMemberId)) {
      return { holds: [] };
    }

    let query = supabaseAdmin
      .from('booking_holds')
      .select('start_time, end_time')
      .eq('venue_id', venueId)
      .eq('team_member_id', teamMemberId)
      .eq('hold_date', date)
      .gt('expires_at', new Date().toISOString());

    // Exclude current user's holds (they can overwrite their own holds)
    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId);
    }

    const { data: holds, error } = await query;

    if (error) {
      console.error('Error fetching holds for availability:', error);
      return { holds: [], error: 'Failed to fetch holds' };
    }

    return { holds: holds || [] };
  } catch (error) {
    console.error('Error in getActiveHoldsForAvailability:', error);
    return { holds: [], error: 'An unexpected error occurred' };
  }
}

// =====================================================
// CLEANUP EXPIRED HOLDS (for cron job)
// =====================================================

export async function cleanupExpiredHolds(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    // Try to use the database function first
    const { data, error: rpcError } = await supabaseAdmin.rpc(
      'cleanup_expired_booking_holds'
    );

    if (!rpcError) {
      return { success: true, deletedCount: data || 0 };
    }

    // Fallback: delete directly if function doesn't exist
    console.warn(
      'cleanup_expired_booking_holds function not found, using direct delete'
    );

    const { data: deletedHolds, error } = await supabaseAdmin
      .from('booking_holds')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('Error cleaning up expired holds:', error);
      return { success: false, error: 'Failed to cleanup holds' };
    }

    return { success: true, deletedCount: deletedHolds?.length || 0 };
  } catch (error) {
    console.error('Error in cleanupExpiredHolds:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// CHECK IF USER HAS ACTIVE HOLD
// =====================================================

export async function getUserActiveHold(sessionToken: string): Promise<{
  hold: BookingHold | null;
  error?: string;
}> {
  try {
    const internalUserId = await getCurrentUserInternalId();

    if (!internalUserId) {
      return { hold: null, error: 'Authentication required' };
    }

    // Cleanup expired first
    await safeCleanupExpiredHolds();

    const { data: hold, error } = await supabaseAdmin
      .from('booking_holds')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('user_id', internalUserId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('Error fetching user hold:', error);
      return { hold: null, error: 'Failed to fetch hold' };
    }

    return { hold: hold as BookingHold | null };
  } catch (error) {
    console.error('Error in getUserActiveHold:', error);
    return { hold: null, error: 'An unexpected error occurred' };
  }
}
