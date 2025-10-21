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

export function CalendarClient() {
  const [viewType, setViewType] = useState<CalendarViewType>('week');
  const [selectedVenue, setSelectedVenue] = useState<string>('all');
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState<string>(getToday());
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(
    getStartOfWeek(getToday())
  );
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);

  // Fetch bookings when filters change
  useEffect(() => {
    const fetchBookings = async () => {
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
          venueId: selectedVenue === 'all' ? undefined : selectedVenue,
          teamMemberId:
            selectedTeamMember === 'all' ? undefined : selectedTeamMember,
          startDate,
          endDate,
          viewType,
        });

        if (result.success && result.data) {
          setBookings(result.data);
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
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading bookings...</div>
        </div>
      ) : viewType === 'day' ? (
        <DayView bookings={bookings} />
      ) : (
        <WeekView weekStart={currentWeekStart} bookings={bookings} />
      )}
    </div>
  );
}
