// lib/calendar-cache.ts
// =====================================================
// CALENDAR CACHE UTILITY
// Fresha-style caching for instant calendar display
// =====================================================

import type { CalendarBooking, BlockedTime } from '@/types/calendar';

// =====================================================
// TYPES
// =====================================================

export interface ShiftWithTeamMember {
  team_member_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  team_member: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  };
}

export interface AssignedTeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

export interface BookingHold {
  id: string;
  venue_id: string;
  team_member_id: string;
  user_id: string | null;
  session_token: string;
  hold_date: string;
  start_time: string;
  end_time: string;
  services: Array<{
    service_id: string;
    service_name: string;
    duration: number;
    price: number;
  }>;
  created_at: string;
  expires_at: string;
  team_member?: {
    first_name: string;
    last_name: string | null;
  };
}

export interface CalendarCacheData {
  bookings: CalendarBooking[];
  shifts: ShiftWithTeamMember[];
  assignedTeamMembers: AssignedTeamMember[];
  blockedTimes: BlockedTime[];
  bookingHolds: BookingHold[];
  timestamp: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const CACHE_PREFIX = 'calendar_cache_';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes max staleness
const MAX_CACHE_ENTRIES = 10; // Keep last 10 date ranges cached

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate cache key for a specific venue/view/date combination
 */
export function getCacheKey(
  venueId: string,
  viewType: 'day' | 'week',
  dateKey: string
): string {
  return `${CACHE_PREFIX}${venueId}_${viewType}_${dateKey}`;
}

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

/**
 * Get all calendar cache keys from sessionStorage
 */
function getAllCacheKeys(): string[] {
  if (!isBrowser()) return [];

  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Clean up old cache entries to prevent storage bloat
 */
function cleanupOldCacheEntries(): void {
  if (!isBrowser()) return;

  const keys = getAllCacheKeys();
  if (keys.length <= MAX_CACHE_ENTRIES) return;

  // Get all entries with their timestamps
  const entriesWithTimestamp: Array<{ key: string; timestamp: number }> = [];

  for (const key of keys) {
    try {
      const data = sessionStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data) as CalendarCacheData;
        entriesWithTimestamp.push({ key, timestamp: parsed.timestamp });
      }
    } catch {
      // Invalid entry, mark for removal
      entriesWithTimestamp.push({ key, timestamp: 0 });
    }
  }

  // Sort by timestamp (oldest first)
  entriesWithTimestamp.sort((a, b) => a.timestamp - b.timestamp);

  // Remove oldest entries until we're under the limit
  const toRemove = entriesWithTimestamp.slice(
    0,
    keys.length - MAX_CACHE_ENTRIES
  );
  for (const entry of toRemove) {
    sessionStorage.removeItem(entry.key);
  }
}

// =====================================================
// MAIN CACHE FUNCTIONS
// =====================================================

/**
 * Read cached calendar data
 * Returns null if no cache exists or cache is too old
 */
export function readCalendarCache(
  venueId: string,
  viewType: 'day' | 'week',
  dateKey: string
): CalendarCacheData | null {
  if (!isBrowser()) return null;

  try {
    const key = getCacheKey(venueId, viewType, dateKey);
    const cached = sessionStorage.getItem(key);

    if (!cached) return null;

    const data = JSON.parse(cached) as CalendarCacheData;

    // Check if cache is still valid (not too old)
    const age = Date.now() - data.timestamp;
    if (age > CACHE_MAX_AGE_MS) {
      // Cache is stale, but still return it for immediate display
      // The caller should trigger a background refresh
      return data;
    }

    return data;
  } catch (error) {
    console.error('Error reading calendar cache:', error);
    return null;
  }
}

/**
 * Write calendar data to cache
 */
export function writeCalendarCache(
  venueId: string,
  viewType: 'day' | 'week',
  dateKey: string,
  data: Omit<CalendarCacheData, 'timestamp'>
): void {
  if (!isBrowser()) return;

  try {
    const key = getCacheKey(venueId, viewType, dateKey);
    const cacheData: CalendarCacheData = {
      ...data,
      timestamp: Date.now(),
    };

    sessionStorage.setItem(key, JSON.stringify(cacheData));

    // Cleanup old entries periodically
    cleanupOldCacheEntries();
  } catch (error) {
    // sessionStorage might be full or disabled
    console.error('Error writing calendar cache:', error);

    // Try to clear old entries and retry once
    try {
      const keys = getAllCacheKeys();
      if (keys.length > 0) {
        // Remove oldest half
        const toRemove = keys.slice(0, Math.ceil(keys.length / 2));
        toRemove.forEach((k) => sessionStorage.removeItem(k));

        // Retry write
        const key = getCacheKey(venueId, viewType, dateKey);
        sessionStorage.setItem(
          key,
          JSON.stringify({ ...data, timestamp: Date.now() })
        );
      }
    } catch {
      // Give up if still failing
    }
  }
}

/**
 * Invalidate cache for a specific venue/view/date
 * Call this after mutations (create/update/delete appointments)
 */
export function invalidateCalendarCache(
  venueId: string,
  viewType: 'day' | 'week',
  dateKey: string
): void {
  if (!isBrowser()) return;

  try {
    const key = getCacheKey(venueId, viewType, dateKey);
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error('Error invalidating calendar cache:', error);
  }
}

/**
 * Invalidate all cache for a venue
 * Call this after venue-wide changes
 */
export function invalidateVenueCache(venueId: string): void {
  if (!isBrowser()) return;

  try {
    const keys = getAllCacheKeys();
    for (const key of keys) {
      if (key.includes(`_${venueId}_`)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Error invalidating venue cache:', error);
  }
}

/**
 * Clear all calendar cache
 * Call this on logout or when needed
 */
export function clearAllCalendarCache(): void {
  if (!isBrowser()) return;

  try {
    const keys = getAllCacheKeys();
    for (const key of keys) {
      sessionStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Error clearing calendar cache:', error);
  }
}

/**
 * Check if cached data is stale (older than max age)
 */
export function isCacheStale(
  venueId: string,
  viewType: 'day' | 'week',
  dateKey: string
): boolean {
  if (!isBrowser()) return true;

  try {
    const key = getCacheKey(venueId, viewType, dateKey);
    const cached = sessionStorage.getItem(key);

    if (!cached) return true;

    const data = JSON.parse(cached) as CalendarCacheData;
    const age = Date.now() - data.timestamp;

    return age > CACHE_MAX_AGE_MS;
  } catch {
    return true;
  }
}
