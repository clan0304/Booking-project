// lib/client-type-helpers.ts
//
// SERVER-ONLY file - contains database operations
// Re-exports client-safe types/config for backward compatibility
//

import { supabaseAdmin } from '@/lib/supabase/server';

// Re-export client-safe types and functions for backward compatibility
// Server actions can continue importing from this file
export {
  type ClientType,
  CLIENT_TYPE_CONFIG,
  getCommissionRate,
  calculateCommission,
  isValidClientType,
} from '@/lib/client-type-config';

import type { ClientType } from '@/lib/client-type-config';

/**
 * Auto-detect client type based on booking history
 *
 * Logic:
 * 1. If client has been served by THIS stylist before → Type B (Regular)
 * 2. If client has visited salon before (any stylist) → Type C (Salon Client)
 * 3. Otherwise → Type A (New Client)
 *
 * Note: Type B+ (Requested New) is manual only, set via edit modal
 */
export async function detectClientType(
  clientId: string | null,
  teamMemberId: string
): Promise<ClientType> {
  // Walk-ins (no client) are always Type A (New)
  if (!clientId) {
    return 'A';
  }

  try {
    // Step 1: Check if client has been served by THIS stylist before
    // We look for completed bookings where this team member served this client
    const { data: historyWithStylist } = await supabaseAdmin
      .from('appointments')
      .select(
        `
        id,
        booking_group_id,
        booking_groups!inner (
          id,
          client_id,
          status
        )
      `
      )
      .eq('team_member_id', teamMemberId)
      .eq('booking_groups.client_id', clientId)
      .eq('booking_groups.status', 'completed')
      .limit(1);

    if (historyWithStylist && historyWithStylist.length > 0) {
      return 'B'; // Regular client - has history with this stylist
    }

    // Step 2: Check if client has visited salon before (any stylist)
    const { data: salonHistory } = await supabaseAdmin
      .from('booking_groups')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .limit(1);

    if (salonHistory && salonHistory.length > 0) {
      return 'C'; // Salon client - visited before, but not this stylist
    }

    // Step 3: First time at salon
    return 'A'; // New client
  } catch (error) {
    console.error('Error detecting client type:', error);
    return 'A'; // Default to new client on error
  }
}

/**
 * Auto-detect client type for PUBLIC BOOKING page
 *
 * This differs from admin booking because:
 * - B+ is auto-detected when client explicitly selects a specific stylist they haven't seen
 * - "Any Professional" vs "Select Specific Designer" box determines B+ vs C logic
 *
 * Logic:
 * ┌─────────────────────────┬────────────────────────────────────────┬──────┐
 * │ Selection Box           │ Client History                         │ Type │
 * ├─────────────────────────┼────────────────────────────────────────┼──────┤
 * │ Any Professional        │ First visit to salon                   │ A    │
 * │ Any Professional        │ Visited salon, NO history with stylist │ C    │
 * │ Any Professional        │ Has history with assigned stylist      │ B    │
 * │ Select Specific Designer│ Has history with THIS stylist          │ B    │
 * │ Select Specific Designer│ No history with THIS stylist           │ B+   │
 * └─────────────────────────┴────────────────────────────────────────┴──────┘
 *
 * @param clientId - Client's user ID (null for new/guest clients)
 * @param teamMemberId - Selected/assigned team member ID
 * @param isSpecificStylistRequested - true if "Select Specific Designer" was chosen
 * @param clientEmail - Email to check for existing client (for guest bookings)
 */
export async function detectClientTypeForPublicBooking(
  clientId: string | null,
  teamMemberId: string,
  isSpecificStylistRequested: boolean,
  clientEmail?: string | null
): Promise<ClientType> {
  try {
    // If no clientId but we have email, try to find existing client
    let resolvedClientId = clientId;

    if (!resolvedClientId && clientEmail) {
      const { data: existingClient } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', clientEmail.toLowerCase())
        .contains('roles', ['client'])
        .single();

      if (existingClient) {
        resolvedClientId = existingClient.id;
      }
    }

    // New client (no existing record)
    if (!resolvedClientId) {
      if (isSpecificStylistRequested) {
        return 'B+'; // New client who specifically requested this stylist
      } else {
        return 'A'; // New client, any professional
      }
    }

    // =====================================================
    // Existing client - ALWAYS check history with assigned stylist first
    // This applies to BOTH "Any Professional" and "Specific Designer"
    // =====================================================

    const { data: historyWithStylist } = await supabaseAdmin
      .from('appointments')
      .select(
        `
        id,
        booking_groups!inner (
          id,
          client_id,
          status
        )
      `
      )
      .eq('team_member_id', teamMemberId)
      .eq('booking_groups.client_id', resolvedClientId)
      .eq('booking_groups.status', 'completed')
      .limit(1);

    if (historyWithStylist && historyWithStylist.length > 0) {
      // Client has history with this stylist (whether chosen or randomly assigned)
      return 'B'; // Regular
    }

    // No history with this stylist - now logic diverges based on selection type
    if (isSpecificStylistRequested) {
      // "Select Specific Designer" was chosen, but no history with this stylist
      return 'B+'; // Requested New
    } else {
      // "Any Professional" was chosen, no history with assigned stylist
      // Check if client has visited salon before (any stylist)
      const { data: salonHistory } = await supabaseAdmin
        .from('booking_groups')
        .select('id')
        .eq('client_id', resolvedClientId)
        .eq('status', 'completed')
        .limit(1);

      if (salonHistory && salonHistory.length > 0) {
        return 'C'; // Salon client - visited before, but not this stylist
      } else {
        return 'A'; // New client
      }
    }
  } catch (error) {
    console.error('Error detecting client type for public booking:', error);
    // Default based on selection type
    return isSpecificStylistRequested ? 'B+' : 'A';
  }
}
