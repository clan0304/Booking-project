// components/admin/calendar/calendar-client.tsx
// =====================================================
// UPDATED WITH BOOKING HOLDS INTEGRATION + FULL-WIDTH LAYOUT
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

// Receive initialVenues as prop
export function CalendarClient({ initialVenues }: CalendarClientProps) {
  const [viewType, setViewType] = useState<CalendarViewType>('day');

  // Initialize with first venue from props
  const [selectedVenue, setSelectedVenue] = useState<string>(
    initialVenues[0]?.id || ''
  );

  const [currentDate, setCurrentDate] = useState<string>(getLocalToday());
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(
    getLocalStartOfWeek()
  );
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [shifts, setShifts] = useState<ShiftWithTeamMember[]>([]);
  const [assignedTeamMembers, setAssignedTeamMembers] = useState<
    AssignedTeamMember[]
  >([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);

  // =====================================================
  // Booking Holds State
  // =====================================================
  const [bookingHolds, setBookingHolds] = useState<BookingHold[]>([]);

  // Store previous bookings for optimistic UI
  const previousBookingsRef = useRef<CalendarBooking[]>([]);

  // Team filtering state
  const [teamFilterMode, setTeamFilterMode] =
    useState<TeamFilterMode>('scheduled');
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>(
    []
  );

  // Compute scheduled team member IDs
  const scheduledTeamMemberIds = useMemo(() => {
    const scheduledIds = new Set<string>();

    // From shifts
    shifts.forEach((shift) => scheduledIds.add(shift.team_member_id));

    // From appointments
    bookings.forEach((booking) => {
      booking.appointments.forEach((appt) => {
        scheduledIds.add(appt.team_member_id);
      });
    });

    // From blocked times
    blockedTimes.forEach((blocked) => {
      scheduledIds.add(blocked.team_member_id);
    });

    // From booking holds
    bookingHolds.forEach((hold) => {
      scheduledIds.add(hold.team_member_id);
    });

    return Array.from(scheduledIds);
  }, [shifts, bookings, blockedTimes, bookingHolds]);

  // Auto-select team members when mode changes or data loads
  useEffect(() => {
    if (assignedTeamMembers.length === 0) return;

    if (teamFilterMode === 'scheduled') {
      setSelectedTeamMemberIds(scheduledTeamMemberIds);
    } else if (teamFilterMode === 'all') {
      setSelectedTeamMemberIds(assignedTeamMembers.map((m) => m.id));
    }
  }, [teamFilterMode, assignedTeamMembers, scheduledTeamMemberIds]);

  // =====================================================
  // Helper to fetch holds for date range
  // =====================================================
  async function fetchHoldsForDateRange(
    venueId: string,
    startDate: string,
    endDate: string
  ): Promise<BookingHold[]> {
    try {
      // For day view, just fetch one day
      if (startDate === endDate) {
        const result = await getActiveHoldsForCalendar(venueId, startDate);
        return result.holds || [];
      }

      // For week view, fetch each day
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
  // Fetch data function (extracted for reuse)
  // =====================================================
  const fetchData = useCallback(async () => {
    if (!selectedVenue) return;

    // Store previous for optimistic UI
    previousBookingsRef.current = bookings;

    setLoading(true);
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

      // Fetch bookings, blocked times, AND holds in parallel
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

      if (bookingsResult.success && bookingsResult.data) {
        setBookings(bookingsResult.data);
        setShifts(bookingsResult.shifts || []);
        setAssignedTeamMembers(bookingsResult.assignedTeamMembers || []);
      } else {
        setBookings([]);
        setShifts([]);
        setAssignedTeamMembers([]);
      }

      if (blockedTimesResult.success && blockedTimesResult.data) {
        setBlockedTimes(blockedTimesResult.data);
      } else {
        setBlockedTimes([]);
      }

      // Set booking holds
      setBookingHolds(holdsResult);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      setBookings([]);
      setShifts([]);
      setAssignedTeamMembers([]);
      setBlockedTimes([]);
      setBookingHolds([]);
    } finally {
      setLoading(false);
    }
  }, [selectedVenue, currentDate, currentWeekStart, viewType, bookings]);

  // =====================================================
  // Fetch bookings, blocked times, AND holds
  // =====================================================
  useEffect(() => {
    fetchData();

    // Refresh periodically to update hold expirations
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenue, currentDate, currentWeekStart, viewType]);

  // =====================================================
  // Refresh handler for child components
  // =====================================================
  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Use previous bookings during loading for smoother UX
  const displayBookings =
    loading && previousBookingsRef.current.length > 0
      ? previousBookingsRef.current
      : bookings;

  // Filter data by selected team members
  const filteredBookings = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return displayBookings.filter((booking) =>
      booking.appointments.some((appt) =>
        selectedTeamMemberIds.includes(appt.team_member_id)
      )
    );
  }, [displayBookings, selectedTeamMemberIds]);

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

  // Filter booking holds by selected team members
  const filteredBookingHolds = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return bookingHolds.filter((hold) =>
      selectedTeamMemberIds.includes(hold.team_member_id)
    );
  }, [bookingHolds, selectedTeamMemberIds]);

  return (
    <div className="bg-white min-h-[calc(100vh-64px)]">
      {/* Header with Title and Filters */}
      <div className="border-b border-gray-200 sticky top-0 bg-white z-20">
        {/* Title Row */}
        <div className="px-6 pt-4 pb-3">
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage appointments and schedules
          </p>
        </div>

        {/* Filters Row */}
        <div className="px-6 pb-3">
          <CalendarFilters
            venues={initialVenues}
            viewType={viewType}
            onViewTypeChange={setViewType}
            selectedVenue={selectedVenue}
            onVenueChange={setSelectedVenue}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            currentWeekStart={currentWeekStart}
            onWeekChange={setCurrentWeekStart}
            teamFilterMode={teamFilterMode}
            onTeamFilterModeChange={setTeamFilterMode}
            allAssignedTeamMembers={assignedTeamMembers}
            assignedTeamMembers={filteredAssignedTeamMembers}
            scheduledTeamMemberIds={scheduledTeamMemberIds}
            selectedTeamMemberIds={selectedTeamMemberIds}
            onTeamOrderChange={fetchData}
            onTeamMemberIdsChange={setSelectedTeamMemberIds}
          />
        </div>
      </div>

      {/* Subtle loading indicator (doesn't block view) */}
      {loading && (
        <div className="fixed top-20 right-4 z-50">
          <div className="flex items-center gap-2 bg-white rounded-lg shadow-lg px-4 py-2 border border-gray-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-gray-600">Updating...</span>
          </div>
        </div>
      )}

      {/* Full-width Calendar Grid */}
      <div>
        {!selectedVenue ? (
          <div className="flex items-center justify-center h-96 bg-gray-50">
            <p className="text-gray-500">
              Please select a venue to view the calendar
            </p>
          </div>
        ) : selectedTeamMemberIds.length === 0 ? (
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
