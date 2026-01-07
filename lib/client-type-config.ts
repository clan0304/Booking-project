// lib/client-type-config.ts
//
// CLIENT-SAFE file - can be imported in both client and server components
// Contains only types, constants, and pure functions (no server imports)
//

/**
 * Client type for commission calculation
 *
 * Type A: New Client - First time at salon (30%)
 * Type B: Regular Client - Has been served by THIS stylist before (40%)
 * Type B+: Requested New - New client who requested this stylist (40%) - Manual only
 * Type C: Salon Client - Visited salon before, first time with THIS stylist (30%)
 */
export type ClientType = 'A' | 'B' | 'B+' | 'C';

export const CLIENT_TYPE_CONFIG = {
  A: {
    name: 'New Client',
    commission: 0.3,
    description: 'First time at salon',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  B: {
    name: 'Regular',
    commission: 0.4,
    description: 'Has history with this stylist',
    color: 'bg-green-100 text-green-700 border-green-300',
  },
  'B+': {
    name: 'Requested',
    commission: 0.4,
    description: 'New client who requested this stylist',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
  },
  C: {
    name: 'Salon',
    commission: 0.3,
    description: 'Visited before, first time with this stylist',
    color: 'bg-orange-100 text-orange-700 border-orange-300',
  },
} as const;

/**
 * Get commission rate for a client type
 */
export function getCommissionRate(clientType: ClientType): number {
  return CLIENT_TYPE_CONFIG[clientType]?.commission || 0.3;
}

/**
 * Calculate commission amount
 */
export function calculateCommission(
  servicePrice: number,
  clientType: ClientType
): number {
  const rate = getCommissionRate(clientType);
  return servicePrice * rate;
}

/**
 * Check if a client type is valid
 */
export function isValidClientType(type: string): type is ClientType {
  return ['A', 'B', 'B+', 'C'].includes(type);
}
