// components/admin/calendar/calendar-client.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/admin';
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

// ✅ Props interface for server-provided venues
interface CalendarClientProps {
  initialVenues: Array<{ id: string; name: string }>;
}

// ✅ Receive initialVenues as prop
export function CalendarClient({ initialVenues }: CalendarClientProps) {
  const [viewType, setViewType] = useState<CalendarViewType>('day');

  // ✅ Initialize with first venue from props
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

  // ✅ FIXED: Use useRef instead of useState to avoid dependency warning
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

    return Array.from(scheduledIds);
  }, [shifts, bookings, blockedTimes]);

  // Auto-select team members when mode changes or data loads
  useEffect(() => {
    if (assignedTeamMembers.length === 0) return;

    if (teamFilterMode === 'scheduled') {
      setSelectedTeamMemberIds(scheduledTeamMemberIds);
    } else if (teamFilterMode === 'all') {
      setSelectedTeamMemberIds(assignedTeamMembers.map((m) => m.id));
    }
  }, [teamFilterMode, assignedTeamMembers, scheduledTeamMemberIds]);

  // Fetch bookings and blocked times when filters change
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedVenue) return;

      // ✅ FIXED: Store in ref (doesn't cause re-render or need dependency)
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

        // ✅ OPTIMIZED: Fetch bookings and blocked times in parallel
        const [bookingsResult, blockedTimesResult] = await Promise.all([
          getCalendarBookings({
            venueId: selectedVenue,
            teamMemberId: undefined,
            startDate,
            endDate,
            viewType,
          }),
          getBlockedTimes(selectedVenue, startDate, endDate),
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
      } catch (error) {
        console.error('Error fetching calendar data:', error);
        setBookings([]);
        setShifts([]);
        setAssignedTeamMembers([]);
        setBlockedTimes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // ✅ FIXED: No need to include 'bookings' in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewType, selectedVenue, currentDate, currentWeekStart]);

  // Refresh calendar data
  const refreshCalendar = async () => {
    if (!selectedVenue) return;

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

      // ✅ OPTIMIZED: Parallel fetching
      const [bookingsResult, blockedTimesResult] = await Promise.all([
        getCalendarBookings({
          venueId: selectedVenue,
          teamMemberId: undefined,
          startDate,
          endDate,
          viewType,
        }),
        getBlockedTimes(selectedVenue, startDate, endDate),
      ]);

      if (bookingsResult.success && bookingsResult.data) {
        setBookings(bookingsResult.data);
        setShifts(bookingsResult.shifts || []);
        setAssignedTeamMembers(bookingsResult.assignedTeamMembers || []);
      }

      if (blockedTimesResult.success && blockedTimesResult.data) {
        setBlockedTimes(blockedTimesResult.data);
      }
    } catch (error) {
      console.error('Error refreshing calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Use ref for optimistic UI
  const displayBookings =
    loading && previousBookingsRef.current.length > 0
      ? previousBookingsRef.current
      : bookings;

  // Filter data by selected team members (use displayBookings for optimistic UI)
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Manage appointments and schedules"
      />

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
        assignedTeamMembers={filteredAssignedTeamMembers}
        scheduledTeamMemberIds={scheduledTeamMemberIds}
        selectedTeamMemberIds={selectedTeamMemberIds}
        onTeamMemberIdsChange={setSelectedTeamMemberIds}
      />

      {/* ✅ Subtle loading indicator (doesn't block view) */}
      {loading && (
        <div className="fixed top-20 right-4 z-50">
          <div className="flex items-center gap-2 bg-white rounded-lg shadow-lg px-4 py-2 border border-gray-200">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-gray-600">Updating...</span>
          </div>
        </div>
      )}

      <div>
        {!selectedVenue ? (
          <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-600">
              Please select a venue to view the calendar
            </p>
          </div>
        ) : selectedTeamMemberIds.length === 0 ? (
          <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-600">
              No team members selected. Please select team members to view their
              schedules.
            </p>
          </div>
        ) : viewType === 'day' ? (
          <DayView
            bookings={filteredBookings}
            shifts={filteredShifts}
            assignedTeamMembers={filteredAssignedTeamMembers}
            currentDate={currentDate}
            blockedTimes={filteredBlockedTimes}
            venueId={selectedVenue}
            onRefresh={refreshCalendar}
          />
        ) : (
          <WeekView
            weekStart={currentWeekStart}
            bookings={filteredBookings}
            shifts={filteredShifts}
            assignedTeamMembers={filteredAssignedTeamMembers}
            blockedTimes={filteredBlockedTimes}
            venueId={selectedVenue}
            onRefresh={refreshCalendar}
          />
        )}
      </div>
    </div>
  );
}
