// components/admin/calendar/calendar-filters.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
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
import Image from 'next/image';

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

  // Handle team member checkbox toggle
  const handleTeamMemberToggle = (memberId: string) => {
    if (selectedTeamMemberIds.includes(memberId)) {
      onTeamMemberIdsChange(
        selectedTeamMemberIds.filter((id) => id !== memberId)
      );
    } else {
      onTeamMemberIdsChange([...selectedTeamMemberIds, memberId]);
    }
  };

  // Handle clear all
  const handleClearAll = () => {
    onTeamMemberIdsChange([]);
  };

  return (
    <div className="space-y-4">
      {/* Top Row: View Type, Date Navigation, Venue Filter */}
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

        {/* Right: Venue Filter */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Bottom Row: Team Filter */}
      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
        {/* Team Filter Mode Toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <button
              onClick={() => onTeamFilterModeChange('scheduled')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                teamFilterMode === 'scheduled'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Scheduled team
            </button>
            <button
              onClick={() => onTeamFilterModeChange('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                teamFilterMode === 'all'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All team
            </button>
          </div>

          {/* Clear All Link */}
          {selectedTeamMemberIds.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Team Members Checkboxes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Team members
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {assignedTeamMembers.map((member) => {
              const isSelected = selectedTeamMemberIds.includes(member.id);

              return (
                <label
                  key={member.id}
                  className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-purple-50 border-purple-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTeamMemberToggle(member.id)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />

                  {/* Photo */}
                  <div className="flex-shrink-0">
                    {member.photo_url ? (
                      <Image
                        src={member.photo_url}
                        alt={member.first_name}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-semibold">
                        {member.first_name[0]}
                        {member.last_name[0]}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.first_name} {member.last_name}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Empty State */}
          {assignedTeamMembers.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No team members assigned to this venue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
