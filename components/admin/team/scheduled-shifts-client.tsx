// components/admin/team/scheduled-shifts-client.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Calendar, Plus } from 'lucide-react';
import { VenueSelector } from './venue-selector';
import { WeekNavigator } from './week-navigator';
import { AssignVenueModal } from './assign-venue-modal';
import { RepeatingShiftsModal } from './repeating-shifts-modal';
import { SingleShiftModal } from './single-shift-modal';
import { getTeamMembersByVenue } from '@/app/actions/team-venue-assignments';
import { getShiftsByWeek } from '@/app/actions/shifts';
import { getStartOfWeek, getToday, getWeekRange } from '@/lib/shift-helpers';
import type { Venue } from '@/types/database';
import Image from 'next/image';

// =====================================================
// LOCAL TYPES
// =====================================================

interface TeamMemberWithShifts {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  email: string;
  shifts: { [date: string]: QueryShift | null };
}

interface AllTeamMember {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  email: string;
}

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

interface TeamMemberAssignment {
  id: string;
  is_active: boolean;
  users: QueryUser | QueryUser[];
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
  const [showRepeatingShiftModal, setShowRepeatingShiftModal] = useState(false);
  const [showSingleShiftModal, setShowSingleShiftModal] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] =
    useState<TeamMemberWithShifts | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<QueryShift | null>(null);

  // ✅ NEW: Store ALL team members and currently assigned IDs
  const [allTeamMembers, setAllTeamMembers] = useState<AllTeamMember[]>([]);
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);

  const [refreshKey, setRefreshKey] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [contextMenuCell, setContextMenuCell] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);
  const weekRange = useMemo(() => getWeekRange(weekStart), [weekStart]);

  // Load team members and shifts
  useEffect(() => {
    if (!selectedVenueId) return;

    const loadData = async () => {
      setIsLoading(true);

      const membersResult = await getTeamMembersByVenue(selectedVenueId);

      if (membersResult.success && membersResult.data) {
        const shiftsResult = await getShiftsByWeek(
          selectedVenueId,
          weekRange.start,
          weekRange.end
        );

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

        const assignments = membersResult.data as TeamMemberAssignment[];

        const membersWithShifts = assignments.map((assignment) => {
          const user: QueryUser = Array.isArray(assignment.users)
            ? assignment.users[0]
            : assignment.users;

          const memberShifts: { [date: string]: QueryShift | null } = {};

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
      setIsRefreshing(false);
    };

    loadData();
  }, [selectedVenueId, weekStart, weekRange, refreshKey]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenuCell(null);
    if (contextMenuCell) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuCell]);

  // ✅ NEW: Fetch ALL team members + currently assigned IDs
  const handleOpenAssignModal = async () => {
    if (!selectedVenueId) return;

    try {
      // Fetch ALL team members (with team_member role)
      const response = await fetch('/api/admin/team/all-members');
      if (response.ok) {
        const data = await response.json();
        setAllTeamMembers(data.members || []);
      }

      // Fetch currently assigned members
      const assignedResult = await getTeamMembersByVenue(selectedVenueId);
      if (assignedResult.success && assignedResult.data) {
        const assignments = assignedResult.data as TeamMemberAssignment[];
        const assignedIds = assignments.map((assignment) => {
          const user: QueryUser = Array.isArray(assignment.users)
            ? assignment.users[0]
            : assignment.users;
          return user.id;
        });
        setAssignedMemberIds(assignedIds);
      }

      setShowAssignModal(true);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleOpenRepeatingShiftModal = (member: TeamMemberWithShifts) => {
    setSelectedTeamMember(member);
    setShowRepeatingShiftModal(true);
    setContextMenuCell(null);
  };

  const handleOpenSingleShiftModal = (
    member: TeamMemberWithShifts,
    date: string,
    shift: QueryShift | null
  ) => {
    setSelectedTeamMember(member);
    setSelectedDate(date);
    setSelectedShift(shift);
    setShowSingleShiftModal(true);
    setContextMenuCell(null);
  };

  const handleShiftCellClick = (
    e: React.MouseEvent,
    member: TeamMemberWithShifts,
    date: string,
    shift: QueryShift | null
  ) => {
    e.stopPropagation();

    if (shift) {
      const cellKey = `${member.id}-${date}`;
      setContextMenuCell(contextMenuCell === cellKey ? null : cellKey);
    } else {
      handleOpenSingleShiftModal(member, date, null);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
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
        <div className="border border-gray-200 rounded-lg overflow-hidden relative">
          {/* Loading Overlay */}
          {isRefreshing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-600 font-medium">
                  Updating schedule...
                </p>
              </div>
            </div>
          )}

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
                  {new Date(day.date + 'T00:00:00Z').getUTCDate()}
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
                      width={32}
                      height={32}
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
                      onClick={() => handleOpenRepeatingShiftModal(member)}
                      className="text-xs text-purple-600 hover:text-purple-700"
                    >
                      Set Schedule
                    </button>
                  </div>
                </div>

                {/* Shift Cells */}
                {weekRange.days.map((day) => {
                  const shift = member.shifts[day.date];
                  const cellKey = `${member.id}-${day.date}`;
                  const isHovered = hoveredCell === cellKey;
                  const showContextMenu = contextMenuCell === cellKey;

                  return (
                    <div
                      key={day.date}
                      className="relative p-2 border-r border-gray-200 last:border-r-0 min-h-[60px]"
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {shift ? (
                        <div className="relative">
                          <button
                            onClick={(e) =>
                              handleShiftCellClick(e, member, day.date, shift)
                            }
                            className="w-full h-full bg-green-50 border border-green-200 rounded px-2 py-2 text-xs text-green-900 hover:bg-green-100 transition-colors flex flex-col items-center justify-center min-h-[48px]"
                          >
                            <div className="font-medium text-center">
                              {shift.start_time.slice(0, 5)} -{' '}
                              {shift.end_time.slice(0, 5)}
                            </div>
                            {shift.notes && (
                              <div className="text-green-700 mt-1 truncate text-center w-full">
                                {shift.notes}
                              </div>
                            )}
                          </button>

                          {showContextMenu && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                              <button
                                onClick={() =>
                                  handleOpenSingleShiftModal(
                                    member,
                                    day.date,
                                    shift
                                  )
                                }
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Edit this day
                              </button>
                              <button
                                onClick={() =>
                                  handleOpenRepeatingShiftModal(member)
                                }
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Set repeating shifts
                              </button>
                              <button
                                onClick={() =>
                                  handleOpenSingleShiftModal(
                                    member,
                                    day.date,
                                    shift
                                  )
                                }
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 border-t border-gray-100"
                              >
                                Delete this shift
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          {isHovered ? (
                            <button
                              onClick={(e) =>
                                handleShiftCellClick(e, member, day.date, null)
                              }
                              className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-all"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
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
          allTeamMembers={allTeamMembers}
          assignedMemberIds={assignedMemberIds}
          onClose={() => setShowAssignModal(false)}
          onSuccess={handleRefresh}
        />
      )}

      {showRepeatingShiftModal && selectedTeamMember && selectedVenue && (
        <RepeatingShiftsModal
          isOpen={showRepeatingShiftModal}
          onClose={() => setShowRepeatingShiftModal(false)}
          teamMemberId={selectedTeamMember.id}
          teamMemberName={`${selectedTeamMember.first_name} ${
            selectedTeamMember.last_name || ''
          }`}
          venueId={selectedVenue.id}
          venueName={selectedVenue.name}
          onSuccess={handleRefresh}
        />
      )}

      {showSingleShiftModal && selectedTeamMember && selectedVenue && (
        <SingleShiftModal
          isOpen={showSingleShiftModal}
          onClose={() => setShowSingleShiftModal(false)}
          teamMemberId={selectedTeamMember.id}
          teamMemberName={`${selectedTeamMember.first_name} ${
            selectedTeamMember.last_name || ''
          }`}
          venueId={selectedVenue.id}
          venueName={selectedVenue.name}
          date={selectedDate}
          existingShift={selectedShift}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
