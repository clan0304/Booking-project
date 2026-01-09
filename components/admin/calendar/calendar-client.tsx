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

  // Track if this is the very first load (no cache, no data)
  const isFirstLoadRef = useRef(true);

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
    if (assignedTeamMembers.length === 0) return;

    if (teamFilterMode === 'scheduled') {
      setSelectedTeamMemberIds(scheduledTeamMemberIds);
    } else if (teamFilterMode === 'all') {
      setSelectedTeamMemberIds(assignedTeamMembers.map((m) => m.id));
    }
  }, [teamFilterMode, assignedTeamMembers, scheduledTeamMemberIds]);

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

      // Only show spinner if we have no data to display
      if (!isBackgroundSync && !hasInitialData) {
        setIsSyncing(true);
      } else if (!isBackgroundSync) {
        // We have data, show non-blocking spinner
        setIsSyncing(true);
      }

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

        // Update state with new data
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
    [
      selectedVenue,
      currentDate,
      currentWeekStart,
      viewType,
      dateKey,
      hasInitialData,
    ]
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
    return assignedTeamMembers.filter((member) =>
      selectedTeamMemberIds.includes(member.id)
    );
  }, [assignedTeamMembers, selectedTeamMemberIds]);

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
      {/* Calendar Filters Header */}
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
        allAssignedTeamMembers={assignedTeamMembers}
        scheduledTeamMemberIds={scheduledTeamMemberIds}
        selectedTeamMemberIds={selectedTeamMemberIds}
        onTeamMemberIdsChange={setSelectedTeamMemberIds}
        onTeamOrderChange={handleRefresh}
      />

      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* =====================================================
            NON-BLOCKING CENTERED SPINNER (Fresha-style)
            Shows during sync while calendar remains visible
            ===================================================== */}
        {isSyncing && (
          <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
            <div className="p-4 bg-white/90 rounded-full shadow-lg backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          </div>
        )}

        {/* Calendar Views */}
        {!selectedVenue ? (
          <div className="flex items-center justify-center h-96 bg-gray-50">
            <p className="text-gray-500">
              Please select a venue to view the calendar
            </p>
          </div>
        ) : !hasInitialData && isSyncing ? (
          // First load - show empty state with spinner (spinner already showing above)
          <div className="flex items-center justify-center h-96 bg-gray-50">
            <p className="text-gray-400">Loading calendar...</p>
          </div>
        ) : selectedTeamMemberIds.length === 0 && hasInitialData ? (
          <div className="flex items-center justify-center h-96 bg-gray-50">
            <p className="text-gray-500">
              No team members scheduled for this{' '}
              {viewType === 'day' ? 'day' : 'week'}
            </p>
          </div>
        ) : viewType === 'day' ? (
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
        ) : (
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
        )}
      </div>
    </div>
  );
}
