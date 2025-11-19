// components/admin/calendar/calendar-filters.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
} from 'lucide-react';
import {
  getStartOfWeek,
  addDays,
  addWeeks,
  formatDateRange,
  getToday,
  formatDateDisplay,
} from '@/lib/shift-helpers';
import type {
  CalendarViewType,
  TeamFilterMode,
  AssignedTeamMember,
} from './calendar-client';
import { TeamFilterDropdown } from './team-filter-dropdown';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CalendarFiltersProps {
  viewType: CalendarViewType;
  onViewTypeChange: (type: CalendarViewType) => void;
  selectedVenue: string;
  onVenueChange: (venueId: string) => void;
  currentDate: string;
  onDateChange: (date: string) => void;
  currentWeekStart: string;
  onWeekChange: (weekStart: string) => void;
  teamFilterMode: TeamFilterMode;
  onTeamFilterModeChange: (mode: TeamFilterMode) => void;
  assignedTeamMembers: AssignedTeamMember[];
  scheduledTeamMemberIds: string[];
  selectedTeamMemberIds: string[];
  onTeamMemberIdsChange: (ids: string[]) => void;
}

export function CalendarFilters({
  viewType,
  onViewTypeChange,
  selectedVenue,
  onVenueChange,
  currentDate,
  onDateChange,
  currentWeekStart,
  onWeekChange,
  teamFilterMode,
  onTeamFilterModeChange,
  assignedTeamMembers,

  selectedTeamMemberIds,
  onTeamMemberIdsChange,
}: CalendarFiltersProps) {
  const [venues, setVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Fetch venues
  useEffect(() => {
    const fetchData = async () => {
      try {
        const venuesRes = await fetch('/api/admin/venues');
        if (venuesRes.ok) {
          const venuesData = await venuesRes.json();
          setVenues(venuesData);

          // Set first venue as default if none selected
          if (venuesData.length > 0 && !selectedVenue) {
            onVenueChange(venuesData[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching venues:', error);
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

  // Handle date selection from calendar picker
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    // Convert to YYYY-MM-DD format (UTC-safe)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const selectedDate = `${year}-${month}-${day}`;

    if (viewType === 'day') {
      onDateChange(selectedDate);
    } else {
      // For week view, navigate to the week containing the selected date
      onWeekChange(getStartOfWeek(selectedDate));
    }

    setCalendarOpen(false);
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

  // Convert currentDate string to Date object for Calendar component
  const getCurrentDateObject = (): Date => {
    if (viewType === 'day') {
      return new Date(currentDate + 'T00:00:00');
    } else {
      return new Date(currentWeekStart + 'T00:00:00');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* ✅ CHANGED: Single row layout with space-between */}
      <div className="flex items-center justify-between gap-4">
        {/* ✅ CHANGED: Left Section - Today + Date Navigation + Venue + Team */}
        <div className="flex items-center gap-3">
          {/* Today Button - Always visible on left */}
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>

          {/* Date Navigation */}
          <button
            onClick={handlePrevious}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            title={`Previous ${viewType}`}
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>

          {/* Date Display with Calendar Picker */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white min-w-[200px] justify-center transition-colors',
                  'hover:bg-gray-50 hover:border-gray-300 cursor-pointer'
                )}
              >
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-900">
                  {getDisplayText()}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={getCurrentDateObject()}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                initialFocus
                className="rounded-md border"
              />
            </PopoverContent>
          </Popover>

          <button
            onClick={handleNext}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            title={`Next ${viewType}`}
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>

          {/* Venue Filter - Added icon */}
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white">
            <MapPin className="h-4 w-4 text-gray-500" />
            <select
              value={selectedVenue}
              onChange={(e) => onVenueChange(e.target.value)}
              className="text-sm bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer"
            >
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter Dropdown */}
          <TeamFilterDropdown
            teamFilterMode={teamFilterMode}
            onTeamFilterModeChange={onTeamFilterModeChange}
            assignedTeamMembers={assignedTeamMembers}
            selectedTeamMemberIds={selectedTeamMemberIds}
            onTeamMemberIdsChange={onTeamMemberIdsChange}
          />
        </div>

        {/* ✅ CHANGED: Right Section - View Type Selector */}
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
      </div>
    </div>
  );
}
