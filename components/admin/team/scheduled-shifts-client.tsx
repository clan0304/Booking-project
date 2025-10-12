'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Calendar } from 'lucide-react';
import { VenueSelector } from './venue-selector';
import { WeekNavigator } from './week-navigator';
import { AssignVenueModal } from './assign-venue-modal';
import { RepeatingShiftsModal } from './repeating-shifts-modal';
import {
  getTeamMembersByVenue,
  getUnassignedTeamMembers,
} from '@/app/actions/team-venue-assignments';
import { getShiftsByWeek } from '@/app/actions/shifts';
import { getStartOfWeek, getToday, getWeekRange } from '@/lib/shift-helpers';
import type { Venue } from '@/types/database';
import Image from 'next/image';

// =====================================================
// LOCAL TYPES (matching actual query results)
// =====================================================

interface TeamMemberWithShifts {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  email: string;
  shifts: { [date: string]: QueryShift | null };
}

interface UnassignedMember {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  email: string;
}

// Simplified - only what we actually use from query results
interface QueryShift {
  id: string;
  team_member_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
}

interface QueryUser {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  email: string;
}

// =====================================================
// COMPONENT
// =====================================================

interface ScheduledShiftsClientProps {
  initialVenues: Venue[];
}

export function ScheduledShiftsClient({
  initialVenues,
}: ScheduledShiftsClientProps) {
  const [venues] = useState<Venue[]>(initialVenues);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    initialVenues[0]?.id || null
  );
  const [weekStart, setWeekStart] = useState(getStartOfWeek(getToday()));
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithShifts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] =
    useState<TeamMemberWithShifts | null>(null);
  const [unassignedMembers, setUnassignedMembers] = useState<
    UnassignedMember[]
  >([]);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh trigger

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);

  // Memoize weekRange to avoid recreating on every render
  const weekRange = useMemo(() => getWeekRange(weekStart), [weekStart]);

  // Load team members and shifts
  useEffect(() => {
    if (!selectedVenueId) return;

    const loadData = async () => {
      setIsLoading(true);

      // Load team members
      const membersResult = await getTeamMembersByVenue(selectedVenueId);

      if (membersResult.success && membersResult.data) {
        // Load shifts for the week
        const shiftsResult = await getShiftsByWeek(
          selectedVenueId,
          weekRange.start,
          weekRange.end
        );

        // Map shifts to team members
        const shiftsData = (
          shiftsResult.success ? shiftsResult.data || [] : []
        ) as QueryShift[];
        const shiftsByMember: {
          [key: string]: { [date: string]: QueryShift };
        } = {};

        shiftsData.forEach((shift) => {
          if (!shiftsByMember[shift.team_member_id]) {
            shiftsByMember[shift.team_member_id] = {};
          }
          shiftsByMember[shift.team_member_id][shift.shift_date] = shift;
        });

        // Build team members with shifts
        const assignments = membersResult.data as {
          id: string;
          is_active: boolean;
          users: QueryUser[];
        }[];

        const membersWithShifts = assignments.map((assignment) => {
          // Supabase returns users as an array due to the join
          const user = Array.isArray(assignment.users)
            ? assignment.users[0]
            : assignment.users;
          const memberShifts: { [date: string]: QueryShift | null } = {};

          // Create shift map for all days in week
          weekRange.days.forEach((day) => {
            memberShifts[day.date] =
              shiftsByMember[user.id]?.[day.date] || null;
          });

          return {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            photo_url: user.photo_url,
            email: user.email,
            shifts: memberShifts,
          };
        });

        setTeamMembers(membersWithShifts);
      }

      setIsLoading(false);
    };

    loadData();
  }, [selectedVenueId, weekStart, weekRange, refreshKey]); // Add refreshKey to dependencies

  // Load unassigned members when opening assign modal
  const handleOpenAssignModal = async () => {
    if (!selectedVenueId) return;

    const result = await getUnassignedTeamMembers(selectedVenueId);
    if (result.success && result.data) {
      setUnassignedMembers(result.data as UnassignedMember[]);
    }
    setShowAssignModal(true);
  };

  const handleOpenShiftModal = (member: TeamMemberWithShifts) => {
    setSelectedTeamMember(member);
    setShowShiftModal(true);
  };

  const handleRefresh = () => {
    // Trigger reload by incrementing refresh key
    setRefreshKey((prev) => prev + 1);
  };

  if (venues.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No Venues Available
          </h3>
          <p className="text-sm text-gray-600">
            Create a venue first to manage team schedules
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <VenueSelector
            venues={venues}
            selectedVenueId={selectedVenueId}
            onVenueChange={setSelectedVenueId}
          />
          <WeekNavigator
            currentWeekStart={weekStart}
            onWeekChange={setWeekStart}
          />
        </div>

        <button
          onClick={handleOpenAssignModal}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Users className="h-4 w-4" />
          <span>Assign Team</span>
        </button>
      </div>

      {/* Schedule Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Loading schedule...</div>
        </div>
      ) : teamMembers.length === 0 ? (
        <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-200 rounded-lg">
          <div className="text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No Team Members Assigned
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Assign team members to this venue to create shifts
            </p>
            <button
              onClick={handleOpenAssignModal}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Assign Team Members
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Calendar Header */}
          <div className="grid grid-cols-8 bg-gray-50 border-b border-gray-200">
            <div className="p-3 font-medium text-gray-700 border-r border-gray-200">
              Team Member
            </div>
            {weekRange.days.map((day) => (
              <div
                key={day.date}
                className="p-3 text-center border-r border-gray-200 last:border-r-0"
              >
                <div className="font-medium text-gray-900">{day.dayName}</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {new Date(day.date + 'T00:00:00').getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Team Member Rows */}
          <div className="divide-y divide-gray-200">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-8 hover:bg-gray-50"
              >
                {/* Team Member Info */}
                <div className="p-3 flex items-center gap-3 border-r border-gray-200">
                  {member.photo_url ? (
                    <Image
                      src={member.photo_url}
                      alt={member.first_name}
                      className="h-8 w-8 rounded-full object-cover"
                      width={8}
                      height={8}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 text-gray-600 text-sm font-medium">
                      {member.first_name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {member.first_name} {member.last_name || ''}
                    </div>
                    <button
                      onClick={() => handleOpenShiftModal(member)}
                      className="text-xs text-purple-600 hover:text-purple-700"
                    >
                      Set Schedule
                    </button>
                  </div>
                </div>

                {/* Shift Cells */}
                {weekRange.days.map((day) => {
                  const shift = member.shifts[day.date];
                  return (
                    <div
                      key={day.date}
                      className="p-2 border-r border-gray-200 last:border-r-0"
                    >
                      {shift ? (
                        <div className="bg-green-50 border border-green-200 rounded px-2 py-1 text-xs text-green-900">
                          <div className="font-medium">
                            {shift.start_time.slice(0, 5)} -{' '}
                            {shift.end_time.slice(0, 5)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-gray-400">
                          —
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAssignModal && selectedVenue && (
        <AssignVenueModal
          venueId={selectedVenue.id}
          venueName={selectedVenue.name}
          availableTeamMembers={unassignedMembers}
          onClose={() => setShowAssignModal(false)}
          onSuccess={handleRefresh}
        />
      )}

      {showShiftModal && selectedTeamMember && selectedVenue && (
        <RepeatingShiftsModal
          teamMemberId={selectedTeamMember.id}
          teamMemberName={`${selectedTeamMember.first_name} ${
            selectedTeamMember.last_name || ''
          }`}
          venueId={selectedVenue.id}
          venueName={selectedVenue.name}
          onClose={() => setShowShiftModal(false)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
