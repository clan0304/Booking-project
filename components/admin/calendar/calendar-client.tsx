// components/admin/calendar/calendar-client.tsx
'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/admin';
import { CalendarFilters } from './calendar-filters';
import { DayView } from './day-view';
import { WeekView } from './week-view';
import { getStartOfWeek, getToday, addDays } from '@/lib/shift-helpers';
import { getCalendarBookings } from '@/app/actions/bookings';
import { getBlockedTimes } from '@/app/actions/blocked-times';
import type { CalendarBooking, BlockedTime } from '@/types/calendar';

export type CalendarViewType = 'day' | 'week';

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
  const [viewType, setViewType] = useState<CalendarViewType>('week');
  const [selectedVenue, setSelectedVenue] = useState<string>(''); // Empty string initially
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('all');
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
  // NEW: State for blocked times
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);

  // Fetch bookings and blocked times when filters change
  useEffect(() => {
    const fetchData = async () => {
      // Don't fetch if no venue is selected yet
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

        // Fetch bookings
        const bookingsResult = await getCalendarBookings({
          venueId: selectedVenue,
          teamMemberId:
            selectedTeamMember === 'all' ? undefined : selectedTeamMember,
          startDate,
          endDate,
          viewType, // FIXED: Added viewType parameter
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

        // NEW: Fetch blocked times
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
  }, [
    viewType,
    selectedVenue,
    selectedTeamMember,
    currentDate,
    currentWeekStart,
  ]);

  // Refresh calendar data (for after creating/editing/deleting blocked times)
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
        teamMemberId:
          selectedTeamMember === 'all' ? undefined : selectedTeamMember,
        startDate,
        endDate,
        viewType, // FIXED: Added viewType parameter
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
          selectedTeamMember={selectedTeamMember}
          onTeamMemberChange={setSelectedTeamMember}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          currentWeekStart={currentWeekStart}
          onWeekChange={setCurrentWeekStart}
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
        ) : viewType === 'day' ? (
          <DayView
            bookings={bookings}
            shifts={shifts}
            assignedTeamMembers={assignedTeamMembers}
            currentDate={currentDate}
            blockedTimes={blockedTimes}
            venueId={selectedVenue}
            onRefresh={refreshCalendar}
          />
        ) : (
          <WeekView
            weekStart={currentWeekStart}
            bookings={bookings}
            shifts={shifts}
            assignedTeamMembers={assignedTeamMembers}
            blockedTimes={blockedTimes}
            venueId={selectedVenue}
            onRefresh={refreshCalendar}
          />
        )}
      </div>
    </div>
  );
}
