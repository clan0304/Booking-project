// components/admin/calendar/calendar-client.tsx
'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/admin';
import { CalendarFilters } from './calendar-filters';
import { DayView } from './day-view';
import { WeekView } from './week-view';
import { getStartOfWeek, getToday, addDays } from '@/lib/shift-helpers';
import { getCalendarBookings } from '@/app/actions/bookings';
import type { CalendarBooking } from '@/types/calendar';

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

  // Fetch bookings when filters change
  useEffect(() => {
    const fetchBookings = async () => {
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

        const result = await getCalendarBookings({
          venueId: selectedVenue,
          teamMemberId:
            selectedTeamMember === 'all' ? undefined : selectedTeamMember,
          startDate,
          endDate,
          viewType,
        });

        if (result.success && result.data) {
          setBookings(result.data);
          setShifts(result.shifts || []);
          setAssignedTeamMembers(result.assignedTeamMembers || []);
        }
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [
    selectedVenue,
    selectedTeamMember,
    currentDate,
    currentWeekStart,
    viewType,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="View and manage all bookings across venues"
      />

      {/* Filters */}
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

      {/* Calendar Views */}
      {!selectedVenue ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Select a venue to view calendar</div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading bookings...</div>
        </div>
      ) : viewType === 'day' ? (
        <DayView
          bookings={bookings}
          shifts={shifts}
          assignedTeamMembers={assignedTeamMembers}
          currentDate={currentDate}
        />
      ) : (
        <WeekView
          weekStart={currentWeekStart}
          bookings={bookings}
          shifts={shifts}
          assignedTeamMembers={assignedTeamMembers}
        />
      )}
    </div>
  );
}
