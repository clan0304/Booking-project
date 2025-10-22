// components/admin/calendar/calendar-filters.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  getStartOfWeek,
  addDays,
  addWeeks,
  formatDateRange,
  getToday,
  formatDateDisplay,
} from '@/lib/shift-helpers';
import type { CalendarViewType } from './calendar-client';

interface CalendarFiltersProps {
  viewType: CalendarViewType;
  onViewTypeChange: (type: CalendarViewType) => void;
  selectedVenue: string;
  onVenueChange: (venueId: string) => void;
  selectedTeamMember: string;
  onTeamMemberChange: (teamMemberId: string) => void;
  currentDate: string;
  onDateChange: (date: string) => void;
  currentWeekStart: string;
  onWeekChange: (weekStart: string) => void;
}

export function CalendarFilters({
  viewType,
  onViewTypeChange,
  selectedVenue,
  onVenueChange,
  selectedTeamMember,
  onTeamMemberChange,
  currentDate,
  onDateChange,
  currentWeekStart,
  onWeekChange,
}: CalendarFiltersProps) {
  const [venues, setVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [teamMembers, setTeamMembers] = useState<
    Array<{ id: string; first_name: string; last_name: string }>
  >([]);

  // Fetch venues and team members
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch venues using existing action
        const venuesRes = await fetch('/api/admin/venues');
        if (venuesRes.ok) {
          const venuesData = await venuesRes.json();
          setVenues(venuesData);

          // Set first venue as default if none selected
          if (venuesData.length > 0 && !selectedVenue) {
            onVenueChange(venuesData[0].id);
          }
        }

        // Fetch team members using existing API
        const teamRes = await fetch('/api/admin/team/all-members');
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          // API returns { success: boolean, members: [...] }
          if (teamData.success && teamData.members) {
            setTeamMembers(teamData.members);
          }
        }
      } catch (error) {
        console.error('Error fetching filter data:', error);
      }
    };

    fetchData();
  }, [selectedVenue, onVenueChange]);

  // Navigation handlers
  const handlePrevious = () => {
    if (viewType === 'day') {
      onDateChange(addDays(currentDate, -1));
    } else {
      onWeekChange(addWeeks(currentWeekStart, -1));
    }
  };

  const handleNext = () => {
    if (viewType === 'day') {
      onDateChange(addDays(currentDate, 1));
    } else {
      onWeekChange(addWeeks(currentWeekStart, 1));
    }
  };

  const handleToday = () => {
    if (viewType === 'day') {
      onDateChange(getToday());
    } else {
      onWeekChange(getStartOfWeek(getToday()));
    }
  };

  // Get display text
  const getDisplayText = () => {
    if (viewType === 'day') {
      return formatDateDisplay(currentDate);
    } else {
      const weekEnd = addDays(currentWeekStart, 6);
      return formatDateRange(currentWeekStart, weekEnd);
    }
  };

  const isToday =
    viewType === 'day'
      ? currentDate === getToday()
      : currentWeekStart === getStartOfWeek(getToday());

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: View Type Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewTypeChange('day')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewType === 'day'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => onViewTypeChange('week')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewType === 'week'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
        </div>

        {/* Center: Date Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevious}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            title={`Previous ${viewType}`}
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white min-w-[200px] justify-center">
            <CalendarIcon className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-gray-900">
              {getDisplayText()}
            </span>
          </div>

          <button
            onClick={handleNext}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            title={`Next ${viewType}`}
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>

          {!isToday && (
            <button
              onClick={handleToday}
              className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg"
            >
              Today
            </button>
          )}
        </div>

        {/* Right: Filters */}
        <div className="flex items-center gap-2">
          {/* Venue Filter - No "All" option */}
          <select
            value={selectedVenue}
            onChange={(e) => onVenueChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>

          {/* Team Member Filter - Keep "All" option */}
          <select
            value={selectedTeamMember}
            onChange={(e) => onTeamMemberChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Staff</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.first_name} {member.last_name || ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
