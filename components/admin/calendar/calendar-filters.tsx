// components/admin/calendar/calendar-filters.tsx
'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Settings2,
} from 'lucide-react';
import {
  getLocalStartOfWeek,
  addDays,
  addWeeks,
  formatDateRange,
  getLocalToday,
  formatDateDisplay,
} from '@/lib/shift-helpers';
import type {
  CalendarViewType,
  TeamFilterMode,
  AssignedTeamMember,
} from './calendar-client';
import { TeamFilterDropdown } from './team-filter-dropdown';
import { TeamMemberReorderModal } from './team-member-reorder-modal';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CalendarFiltersProps {
  venues: Array<{ id: string; name: string }>;
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
  allAssignedTeamMembers: AssignedTeamMember[]; // ✅ NEW: All team members for reorder modal
  scheduledTeamMemberIds: string[];
  selectedTeamMemberIds: string[];
  onTeamMemberIdsChange: (ids: string[]) => void;
  onTeamOrderChange: () => void;
}

export function CalendarFilters({
  venues,
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
  allAssignedTeamMembers, // ✅ NEW
  selectedTeamMemberIds,
  onTeamMemberIdsChange,
  onTeamOrderChange,
}: CalendarFiltersProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false); // ✅ NEW

  // Get current venue name for the modal
  const currentVenueName =
    venues.find((v) => v.id === selectedVenue)?.name || 'Venue';

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

  // In handleToday function (or wherever the Today button click is handled)
  const handleToday = () => {
    const today = getLocalToday(); // Use local time!
    if (viewType === 'day') {
      onDateChange(today);
    } else {
      onWeekChange(getLocalStartOfWeek(today));
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
      onWeekChange(getLocalStartOfWeek(selectedDate));
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
      <div className="flex items-center justify-between gap-4">
        {/* Left Section - Today + Date Navigation + Venue + Team */}
        <div className="flex items-center gap-3">
          {/* Today Button */}
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
                initialFocus
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

          {/* Venue Filter + Reorder Button */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <select
                value={selectedVenue}
                onChange={(e) => onVenueChange(e.target.value)}
                className="h-9 pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors appearance-none cursor-pointer min-w-[180px]"
              >
                {venues.length === 0 && (
                  <option value="">No venues available</option>
                )}
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ NEW: Reorder Team Members Button */}
            <button
              onClick={() => setShowReorderModal(true)}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              title="Reorder team members"
            >
              <Settings2 className="h-4 w-4 text-gray-600" />
            </button>
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

        {/* Right Section - View Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewTypeChange('day')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              viewType === 'day'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Day
          </button>
          <button
            onClick={() => onViewTypeChange('week')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              viewType === 'week'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Week
          </button>
        </div>
      </div>

      {/* ✅ NEW: Team Member Reorder Modal - Uses ALL team members */}
      <TeamMemberReorderModal
        isOpen={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        venueId={selectedVenue}
        venueName={currentVenueName}
        teamMembers={allAssignedTeamMembers}
        onSuccess={onTeamOrderChange}
      />
    </div>
  );
}
