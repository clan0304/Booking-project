// components/admin/calendar/calendar-client.tsx
// =====================================================
// FRESHA-STYLE CALENDAR WITH NON-BLOCKING LOADING & CACHING
// =====================================================
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CalendarFilters } from './calendar-filters';
import { DayView } from './day-view';
import { WeekView } from './week-view';
import {
  getLocalStartOfWeek,
  getLocalToday,
  addDays,
} from '@/lib/shift-helpers';
import { getCalendarBookings } from '@/app/actions/bookings';
import { getBlockedTimes } from '@/app/actions/blocked-times';
import { getActiveHoldsForCalendar } from '@/app/actions/booking-holds';
import { readCalendarCache, writeCalendarCache } from '@/lib/calendar-cache';
import type { CalendarBooking, BlockedTime } from '@/types/calendar';
import { Loader2 } from 'lucide-react';

export type CalendarViewType = 'day' | 'week';
export type TeamFilterMode = 'scheduled' | 'all';

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

// =====================================================
// Booking Hold Interface
// =====================================================
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

// Props interface for server-provided venues
interface CalendarClientProps {
  initialVenues: Array<{ id: string; name: string }>;
}

// =====================================================
// MAIN COMPONENT
// =====================================================
export function CalendarClient({ initialVenues }: CalendarClientProps) {
  // =====================================================
  // VIEW & FILTER STATE
  // =====================================================
  const [viewType, setViewType] = useState<CalendarViewType>('day');
  const [selectedVenue, setSelectedVenue] = useState<string>(
    initialVenues[0]?.id || ''
  );
  const [currentDate, setCurrentDate] = useState<string>(getLocalToday());
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(
    getLocalStartOfWeek()
  );

  // =====================================================
  // DATA STATE
  // =====================================================
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [shifts, setShifts] = useState<ShiftWithTeamMember[]>([]);
  const [assignedTeamMembers, setAssignedTeamMembers] = useState<
    AssignedTeamMember[]
  >([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [bookingHolds, setBookingHolds] = useState<BookingHold[]>([]);

  // =====================================================
  // LOADING STATE (Fresha-style)
  // =====================================================
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasInitialData, setHasInitialData] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Track if this is the very first load (no cache, no data)
  const isFirstLoadRef = useRef(true);

  // =====================================================
  // PERSISTENT TEAM MEMBERS (Fresha-style)
  // Keep team members visible when changing dates
  // =====================================================
  const [persistentTeamMembers, setPersistentTeamMembers] = useState<
    AssignedTeamMember[]
  >([]);

  // Update persistent team members when we get new data
  // Only update if we actually have team members (don't clear on empty)
  useEffect(() => {
    if (assignedTeamMembers.length > 0) {
      setPersistentTeamMembers(assignedTeamMembers);
    }
  }, [assignedTeamMembers]);

  // Use persistent team members for display (fallback to current if available)
  const displayTeamMembers = useMemo(() => {
    // If we have current data, use it
    if (assignedTeamMembers.length > 0) {
      return assignedTeamMembers;
    }
    // Otherwise, keep showing previous team members while loading
    return persistentTeamMembers;
  }, [assignedTeamMembers, persistentTeamMembers]);

  // =====================================================
  // TEAM FILTERING STATE
  // =====================================================
  const [teamFilterMode, setTeamFilterMode] =
    useState<TeamFilterMode>('scheduled');
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>(
    []
  );

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  // Get the date key for caching
  const dateKey = viewType === 'day' ? currentDate : currentWeekStart;

  // Compute scheduled team member IDs
  const scheduledTeamMemberIds = useMemo(() => {
    const scheduledIds = new Set<string>();

    shifts.forEach((shift) => scheduledIds.add(shift.team_member_id));
    bookings.forEach((booking) => {
      booking.appointments.forEach((appt) => {
        scheduledIds.add(appt.team_member_id);
      });
    });
    blockedTimes.forEach((blocked) => {
      scheduledIds.add(blocked.team_member_id);
    });
    bookingHolds.forEach((hold) => {
      scheduledIds.add(hold.team_member_id);
    });

    return Array.from(scheduledIds);
  }, [shifts, bookings, blockedTimes, bookingHolds]);

  // =====================================================
  // AUTO-SELECT TEAM MEMBERS
  // =====================================================
  useEffect(() => {
    // Use displayTeamMembers for selection (includes persistent)
    if (displayTeamMembers.length === 0) return;

    if (teamFilterMode === 'scheduled') {
      // If we have scheduled IDs, use them; otherwise show all
      if (scheduledTeamMemberIds.length > 0) {
        setSelectedTeamMemberIds(scheduledTeamMemberIds);
      } else {
        // No scheduled members for this date - show all team members
        setSelectedTeamMemberIds(displayTeamMembers.map((m) => m.id));
      }
    } else if (teamFilterMode === 'all') {
      setSelectedTeamMemberIds(displayTeamMembers.map((m) => m.id));
    }

    // Mark initialization complete after team members are set
    if (hasInitialData) {
      setIsInitializing(false);
    }
  }, [
    teamFilterMode,
    displayTeamMembers,
    scheduledTeamMemberIds,
    hasInitialData,
  ]);

  // =====================================================
  // HELPER: Fetch holds for date range
  // =====================================================
  async function fetchHoldsForDateRange(
    venueId: string,
    startDate: string,
    endDate: string
  ): Promise<BookingHold[]> {
    try {
      if (startDate === endDate) {
        const result = await getActiveHoldsForCalendar(venueId, startDate);
        return result.holds || [];
      }

      const allHolds: BookingHold[] = [];
      const current = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');

      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const result = await getActiveHoldsForCalendar(venueId, dateStr);
        if (result.holds) {
          allHolds.push(...result.holds);
        }
        current.setDate(current.getDate() + 1);
      }

      return allHolds;
    } catch (error) {
      console.error('Error fetching booking holds:', error);
      return [];
    }
  }

  // =====================================================
  // LOAD FROM CACHE (Instant display)
  // =====================================================
  const loadFromCache = useCallback(() => {
    if (!selectedVenue) return false;

    // Reset initialization state when loading new data
    setIsInitializing(true);

    const cached = readCalendarCache(selectedVenue, viewType, dateKey);

    if (cached) {
      setBookings(cached.bookings);
      setShifts(cached.shifts);
      setAssignedTeamMembers(cached.assignedTeamMembers);
      setBlockedTimes(cached.blockedTimes);
      setBookingHolds(cached.bookingHolds);
      setHasInitialData(true);
      return true;
    }

    return false;
  }, [selectedVenue, viewType, dateKey]);

  // =====================================================
  // FETCH DATA (Background sync)
  // =====================================================
  const fetchData = useCallback(
    async (isBackgroundSync: boolean = false) => {
      if (!selectedVenue) return;

      // Always show spinner for non-background syncs
      // But calendar structure remains visible (Fresha-style)
      if (!isBackgroundSync) {
        setIsSyncing(true);
      }

      // ✅ FRESHA-STYLE: Don't clear data during sync!
      // Keep showing previous appointments while loading new ones
      // This prevents the jarring "disappearing content" effect

      try {
        let startDate: string;
        let endDate: string;

        if (viewType === 'day') {
          startDate = currentDate;
          endDate = currentDate;
        } else {
          startDate = currentWeekStart;
          endDate = addDays(currentWeekStart, 6);
        }

        // Fetch all data in parallel
        const [bookingsResult, blockedTimesResult, holdsResult] =
          await Promise.all([
            getCalendarBookings({
              venueId: selectedVenue,
              teamMemberId: undefined,
              startDate,
              endDate,
              viewType,
            }),
            getBlockedTimes(selectedVenue, startDate, endDate),
            fetchHoldsForDateRange(selectedVenue, startDate, endDate),
          ]);

        // Update state with new data (replaces old data atomically)
        if (bookingsResult.success && bookingsResult.data) {
          setBookings(bookingsResult.data);
          setShifts(bookingsResult.shifts || []);
          setAssignedTeamMembers(bookingsResult.assignedTeamMembers || []);
        }

        if (blockedTimesResult.success && blockedTimesResult.data) {
          setBlockedTimes(blockedTimesResult.data);
        }

        setBookingHolds(holdsResult);
        setHasInitialData(true);
        isFirstLoadRef.current = false;

        // Write to cache for future instant loads
        writeCalendarCache(selectedVenue, viewType, dateKey, {
          bookings: bookingsResult.data || [],
          shifts: bookingsResult.shifts || [],
          assignedTeamMembers: bookingsResult.assignedTeamMembers || [],
          blockedTimes: blockedTimesResult.data || [],
          bookingHolds: holdsResult,
        });
      } catch (error) {
        console.error('Error fetching calendar data:', error);
        // Don't clear existing data on error - keep showing what we have
      } finally {
        setIsSyncing(false);
      }
    },
    [selectedVenue, currentDate, currentWeekStart, viewType, dateKey]
  );

  // =====================================================
  // INITIAL LOAD & CACHE CHECK
  // =====================================================
  useEffect(() => {
    if (!selectedVenue) return;

    // Try to load from cache first for instant display
    const hasCachedData = loadFromCache();

    // Always fetch fresh data
    // If we have cached data, this becomes a background sync
    fetchData(!hasCachedData ? false : true);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenue, currentDate, currentWeekStart, viewType]);

  // =====================================================
  // POLLING (30-second interval like Fresha)
  // =====================================================
  useEffect(() => {
    if (!selectedVenue) return;

    const interval = setInterval(() => {
      // Background sync - don't show spinner for polling
      fetchData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedVenue, fetchData]);

  // =====================================================
  // REFRESH HANDLER (For child components)
  // =====================================================
  const handleRefresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);

  // =====================================================
  // FILTERED DATA
  // Use displayTeamMembers for filtering
  // =====================================================
  const filteredBookings = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return bookings.filter((booking) =>
      booking.appointments.some((appt) =>
        selectedTeamMemberIds.includes(appt.team_member_id)
      )
    );
  }, [bookings, selectedTeamMemberIds]);

  const filteredShifts = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return shifts.filter((shift) =>
      selectedTeamMemberIds.includes(shift.team_member_id)
    );
  }, [shifts, selectedTeamMemberIds]);

  const filteredAssignedTeamMembers = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return displayTeamMembers.filter((member) =>
      selectedTeamMemberIds.includes(member.id)
    );
  }, [displayTeamMembers, selectedTeamMemberIds]);

  const filteredBlockedTimes = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return blockedTimes.filter((blocked) =>
      selectedTeamMemberIds.includes(blocked.team_member_id)
    );
  }, [blockedTimes, selectedTeamMemberIds]);

  const filteredBookingHolds = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return bookingHolds.filter((hold) =>
      selectedTeamMemberIds.includes(hold.team_member_id)
    );
  }, [bookingHolds, selectedTeamMemberIds]);

  // =====================================================
  // RENDER
  // =====================================================
  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Calendar Filters Header - with loading indicator */}
      <CalendarFilters
        viewType={viewType}
        onViewTypeChange={setViewType}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        currentWeekStart={currentWeekStart}
        onWeekChange={setCurrentWeekStart}
        venues={initialVenues}
        selectedVenue={selectedVenue}
        onVenueChange={setSelectedVenue}
        teamFilterMode={teamFilterMode}
        onTeamFilterModeChange={setTeamFilterMode}
        assignedTeamMembers={filteredAssignedTeamMembers}
        allAssignedTeamMembers={displayTeamMembers}
        scheduledTeamMemberIds={scheduledTeamMemberIds}
        selectedTeamMemberIds={selectedTeamMemberIds}
        onTeamMemberIdsChange={setSelectedTeamMemberIds}
        onTeamOrderChange={handleRefresh}
        isSyncing={isSyncing}
      />

      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* =====================================================
            NON-BLOCKING SPINNER OVERLAY (Fresha-style)
            Shows during sync while calendar remains VISIBLE
            Appointments are shown but not clickable
            ===================================================== */}
        {isSyncing && !isInitializing && (
          <div className="absolute inset-0 z-40 pointer-events-auto bg-white/50">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="p-4 bg-white/90 rounded-full shadow-lg backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            </div>
          </div>
        )}

        {/* Calendar Views */}
        {!selectedVenue ? (
          // No venue selected
          <div className="flex items-center justify-center h-96 bg-gray-50">
            <p className="text-gray-500">
              Please select a venue to view the calendar
            </p>
          </div>
        ) : isInitializing && filteredAssignedTeamMembers.length === 0 ? (
          // ONLY show skeleton on FIRST load when we have NO data at all
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Skeleton Header */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <div className="flex-shrink-0 w-14 h-16" />
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-gray-200 py-3 px-2"
                >
                  <div className="flex flex-col items-center gap-2 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="w-20 h-4 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
            {/* Skeleton Body */}
            <div className="relative" style={{ height: '600px' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  <p className="text-sm text-gray-500">Loading calendar...</p>
                </div>
              </div>
            </div>
          </div>
        ) : filteredAssignedTeamMembers.length === 0 && !isSyncing ? (
          // No team members after data fully loaded (not during sync)
          <div className="flex items-center justify-center h-96 bg-gray-50">
            <p className="text-gray-500">
              No team members scheduled for this{' '}
              {viewType === 'day' ? 'day' : 'week'}
            </p>
          </div>
        ) : viewType === 'day' ? (
          // Day View - wrapped to disable interactions during sync
          <div className={isSyncing ? 'pointer-events-none' : ''}>
            <DayView
              bookings={filteredBookings}
              shifts={filteredShifts}
              assignedTeamMembers={filteredAssignedTeamMembers}
              blockedTimes={filteredBlockedTimes}
              bookingHolds={filteredBookingHolds}
              venueId={selectedVenue}
              currentDate={currentDate}
              onRefresh={handleRefresh}
            />
          </div>
        ) : (
          // Week View - wrapped to disable interactions during sync
          <div className={isSyncing ? 'pointer-events-none' : ''}>
            <WeekView
              bookings={filteredBookings}
              shifts={filteredShifts}
              assignedTeamMembers={filteredAssignedTeamMembers}
              blockedTimes={filteredBlockedTimes}
              bookingHolds={filteredBookingHolds}
              weekStart={currentWeekStart}
              venueId={selectedVenue}
              onRefresh={handleRefresh}
            />
          </div>
        )}
      </div>
    </div>
  );
}
