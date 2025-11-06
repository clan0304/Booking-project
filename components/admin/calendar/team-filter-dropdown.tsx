// components/admin/calendar/team-filter-dropdown.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Users, X } from 'lucide-react';
import Image from 'next/image';
import type { TeamFilterMode, AssignedTeamMember } from './calendar-client';

interface TeamFilterDropdownProps {
  teamFilterMode: TeamFilterMode;
  onTeamFilterModeChange: (mode: TeamFilterMode) => void;
  assignedTeamMembers: AssignedTeamMember[];
  selectedTeamMemberIds: string[];
  onTeamMemberIdsChange: (ids: string[]) => void;
}

export function TeamFilterDropdown({
  teamFilterMode,
  onTeamFilterModeChange,
  assignedTeamMembers,
  selectedTeamMemberIds,
  onTeamMemberIdsChange,
}: TeamFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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

  // Get display text for button
  const getButtonText = () => {
    const count = selectedTeamMemberIds.length;
    const modeText =
      teamFilterMode === 'scheduled' ? 'Scheduled team' : 'All team';

    if (count === 0) {
      return modeText;
    }

    return `${modeText} (${count})`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
      >
        <Users className="h-4 w-4 text-gray-500" />
        <span className="text-gray-700">{getButtonText()}</span>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header with mode toggle */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">
                  Team Filter
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Toggle Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => onTeamFilterModeChange('scheduled')}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  teamFilterMode === 'scheduled'
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                Scheduled team
              </button>
              <button
                onClick={() => onTeamFilterModeChange('all')}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  teamFilterMode === 'all'
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                All team
              </button>
            </div>
          </div>

          {/* Team Members List */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Team members
              </h3>
              {selectedTeamMemberIds.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Scrollable team member list */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {assignedTeamMembers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No team members assigned
                </p>
              ) : (
                assignedTeamMembers.map((member) => {
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
                })
              )}
            </div>
          </div>

          {/* Footer with selection count */}
          {selectedTeamMemberIds.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <p className="text-xs text-gray-600 text-center">
                {selectedTeamMemberIds.length} of {assignedTeamMembers.length}{' '}
                team member{assignedTeamMembers.length !== 1 ? 's' : ''}{' '}
                selected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
