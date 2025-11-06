// components/admin/calendar/calendar-client.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/admin';
import { CalendarFilters } from './calendar-filters';
import { DayView } from './day-view';
import { WeekView } from './week-view';
import { getStartOfWeek, getToday, addDays } from '@/lib/shift-helpers';
import { getCalendarBookings } from '@/app/actions/bookings';
import { getBlockedTimes } from '@/app/actions/blocked-times';
import type { CalendarBooking, BlockedTime } from '@/types/calendar';

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

export function CalendarClient() {
  const [viewType, setViewType] = useState<CalendarViewType>('day');
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>(getToday());
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(
    getStartOfWeek(getToday())
  );
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [shifts, setShifts] = useState<ShiftWithTeamMember[]>([]);
  const [assignedTeamMembers, setAssignedTeamMembers] = useState<
    AssignedTeamMember[]
  >([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);

  // NEW: Team filtering state
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

        // Fetch bookings (no team member filter - get all for venue)
        const bookingsResult = await getCalendarBookings({
          venueId: selectedVenue,
          teamMemberId: undefined,
          startDate,
          endDate,
          viewType,
        });

        if (bookingsResult.success && bookingsResult.data) {
          setBookings(bookingsResult.data);
          setShifts(bookingsResult.shifts || []);
          setAssignedTeamMembers(bookingsResult.assignedTeamMembers || []);
        } else {
          setBookings([]);
          setShifts([]);
          setAssignedTeamMembers([]);
        }

        const blockedTimesResult = await getBlockedTimes(
          selectedVenue,
          startDate,
          endDate
        );

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

      const bookingsResult = await getCalendarBookings({
        venueId: selectedVenue,
        teamMemberId: undefined,
        startDate,
        endDate,
        viewType,
      });

      if (bookingsResult.success && bookingsResult.data) {
        setBookings(bookingsResult.data);
        setShifts(bookingsResult.shifts || []);
        setAssignedTeamMembers(bookingsResult.assignedTeamMembers || []);
      }

      const blockedTimesResult = await getBlockedTimes(
        selectedVenue,
        startDate,
        endDate
      );

      if (blockedTimesResult.success && blockedTimesResult.data) {
        setBlockedTimes(blockedTimesResult.data);
      }
    } catch (error) {
      console.error('Error refreshing calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data by selected team members
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

  const filteredBlockedTimes = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return blockedTimes.filter((blocked) =>
      selectedTeamMemberIds.includes(blocked.team_member_id)
    );
  }, [blockedTimes, selectedTeamMemberIds]);

  // Get filtered assigned team members for views
  const filteredAssignedTeamMembers = useMemo(() => {
    if (selectedTeamMemberIds.length === 0) return [];
    return assignedTeamMembers.filter((member) =>
      selectedTeamMemberIds.includes(member.id)
    );
  }, [assignedTeamMembers, selectedTeamMemberIds]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <PageHeader
        title="Calendar"
        description="View and manage bookings across your team"
      />

      {/* Filters */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <CalendarFilters
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
          assignedTeamMembers={assignedTeamMembers}
          scheduledTeamMemberIds={scheduledTeamMemberIds}
          selectedTeamMemberIds={selectedTeamMemberIds}
          onTeamMemberIdsChange={setSelectedTeamMemberIds}
        />
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-600">Loading calendar...</div>
          </div>
        ) : !selectedVenue ? (
          <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-600">
              Please select a venue to view calendar
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
