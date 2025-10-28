// components/admin/calendar/day-view.tsx
'use client';

import { useMemo, useState } from 'react';
import { TimeSlotActionsModal } from './time-slot-actions-modal';
import { BlockedTimeModal } from './blocked-time-modal';
import { AppointmentCard } from './appointment-card';
import {
  isTimeInShift,
  getShiftsForMemberAndDate,
  isTimeBlocked,
} from '@/lib/shift-helpers';
import type {
  CalendarBooking,
  CalendarTeamMember,
  AppointmentWithBooking,
  AppointmentsByMember,
  BlockedTime,
} from '@/types/calendar';
import Image from 'next/image';

interface DayViewProps {
  bookings: CalendarBooking[];
  shifts: Array<{
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
  }>;
  assignedTeamMembers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  }>;
  currentDate: string;
  blockedTimes: BlockedTime[];
  venueId: string;
  onRefresh: () => void;
}

export function DayView({
  bookings,
  shifts,
  assignedTeamMembers,
  currentDate,
  blockedTimes,
  venueId,
  onRefresh,
}: DayViewProps) {
  // State for modals
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showBlockedTimeModal, setShowBlockedTimeModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    time: string;
    teamMemberId: string;
    teamMemberName: string;
  } | null>(null);
  const [selectedBlockedTime, setSelectedBlockedTime] =
    useState<BlockedTime | null>(null);

  // Generate time slots (8 AM to 8 PM, 15-min intervals)
  const timeSlots = useMemo((): string[] => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 20) {
        slots.push(`${hour.toString().padStart(2, '0')}:15`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
        slots.push(`${hour.toString().padStart(2, '0')}:45`);
      }
    }
    return slots;
  }, []);

  // Generate hour labels (only show on the hour)
  const hourLabels = useMemo((): string[] => {
    const labels: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      labels.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return labels;
  }, []);

  // Group appointments by team member
  const appointmentsByMember = useMemo((): AppointmentsByMember[] => {
    const grouped = new Map<
      string,
      { member: CalendarTeamMember; appointments: AppointmentWithBooking[] }
    >();

    // First, add team members from bookings
    bookings.forEach((booking) => {
      booking.appointments?.forEach((appointment) => {
        const memberId = appointment.team_member_id;
        const member = appointment.team_member;

        if (!member) return;

        if (!grouped.has(memberId)) {
          grouped.set(memberId, {
            member,
            appointments: [],
          });
        }

        grouped.get(memberId)!.appointments.push({
          ...appointment,
          booking,
        });
      });
    });

    // Then add team members from assignedTeamMembers who don't have bookings
    assignedTeamMembers.forEach((member) => {
      if (!grouped.has(member.id)) {
        grouped.set(member.id, {
          member,
          appointments: [],
        });
      }
    });

    return Array.from(grouped.values());
  }, [bookings, assignedTeamMembers]);

  // Group blocked times by team member
  const blockedTimesByMember = useMemo(() => {
    const grouped = new Map<string, BlockedTime[]>();

    blockedTimes.forEach((blockedTime) => {
      const memberId = blockedTime.team_member_id;
      if (!grouped.has(memberId)) {
        grouped.set(memberId, []);
      }
      grouped.get(memberId)!.push(blockedTime);
    });

    return grouped;
  }, [blockedTimes]);

  // Format time for display (12-hour format)
  const formatTime12Hour = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min} ${period}`;
  };

  // Format time label for left column (simplified)
  const formatTimeLabel = (time: string): string => {
    const [hour] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}${period}`;
  };

  // Calculate position and height for appointments/blocked times
  const getStyle = (
    startTime: string,
    endTime: string
  ): { top: number; height: number } => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const baseMinutes = 8 * 60; // 8 AM
    const top = ((startMinutes - baseMinutes) / 15) * 20; // 20px per 15min slot
    const height = ((endMinutes - startMinutes) / 15) * 20;

    return { top, height };
  };

  // Handle empty slot click
  const handleSlotClick = (
    time: string,
    teamMemberId: string,
    teamMemberName: string
  ) => {
    setSelectedSlot({ time, teamMemberId, teamMemberName });
    setShowActionsModal(true);
  };

  // Handle blocked time click
  const handleBlockedTimeClick = (
    blockedTime: BlockedTime,
    teamMemberName: string
  ) => {
    setSelectedBlockedTime(blockedTime);
    setSelectedSlot({
      time: blockedTime.start_time.substring(0, 5),
      teamMemberId: blockedTime.team_member_id,
      teamMemberName,
    });
    setShowBlockedTimeModal(true);
  };

  // Calculate dynamic column width based on number of team members
  const getColumnWidth = (memberCount: number): string => {
    if (memberCount === 1) return '100%';
    if (memberCount === 2) return '50%';
    if (memberCount === 3) return '33.333%';
    if (memberCount === 4) return '25%';
    if (memberCount === 5) return '20%';
    return '200px'; // Fixed width for 6+ members, allows horizontal scroll
  };

  const columnWidth = getColumnWidth(appointmentsByMember.length);
  const useFixedWidth = appointmentsByMember.length >= 6;

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {appointmentsByMember.length === 0 ? (
          // Empty state
          <div className="p-8 text-center">
            <p className="text-gray-500">
              No team members assigned to this venue
            </p>
          </div>
        ) : (
          <div className={useFixedWidth ? 'overflow-x-auto' : ''}>
            <div
              style={{
                minWidth: useFixedWidth
                  ? `${60 + appointmentsByMember.length * 200}px`
                  : 'auto',
              }}
            >
              {/* Header Row - Team Member Photos and Names */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                {/* Time column header */}
                <div className="flex-shrink-0 w-16 border-r border-gray-200 p-2">
                  <div className="text-xs font-semibold text-gray-700">
                    Time
                  </div>
                </div>

                {/* Team member headers */}
                {appointmentsByMember.map(({ member, appointments }) => {
                  const memberName = `${member.first_name} ${member.last_name}`;

                  return (
                    <div
                      key={member.id}
                      className="border-r border-gray-200 p-3 flex flex-col items-center justify-center gap-2"
                      style={{
                        width: useFixedWidth ? '200px' : columnWidth,
                        minWidth: useFixedWidth ? '200px' : 'auto',
                      }}
                    >
                      {/* Profile Photo */}
                      <div className="relative h-12 w-12 rounded-full overflow-hidden bg-gray-200">
                        {member.photo_url ? (
                          <Image
                            src={member.photo_url}
                            alt={memberName}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-gray-500 font-semibold text-sm">
                            {member.first_name[0]}
                            {member.last_name[0]}
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <div className="text-center">
                        <div className="font-semibold text-gray-900 text-sm">
                          {member.first_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {appointments.length} apt
                          {appointments.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calendar Grid - Time slots with columns for each member */}
              <div className="flex">
                {/* Time Labels Column */}
                <div className="flex-shrink-0 w-16 border-r border-gray-200 bg-gray-50">
                  {timeSlots.map((time) => {
                    const isHourMark = time.endsWith(':00');
                    const showLabel = hourLabels.includes(time);

                    return (
                      <div
                        key={time}
                        className={`h-5 flex items-center justify-end pr-2 text-xs ${
                          showLabel
                            ? 'text-gray-600 font-medium'
                            : 'text-transparent'
                        } ${isHourMark ? 'border-t-2 border-t-gray-300' : ''}`}
                      >
                        {showLabel ? formatTimeLabel(time) : '·'}
                      </div>
                    );
                  })}
                </div>

                {/* Team Member Columns */}
                {appointmentsByMember.map(({ member, appointments }) => {
                  const memberName = `${member.first_name} ${member.last_name}`;
                  const memberBlockedTimes =
                    blockedTimesByMember.get(member.id) || [];

                  return (
                    <div
                      key={member.id}
                      className="border-r border-gray-200 relative"
                      style={{
                        width: useFixedWidth ? '200px' : columnWidth,
                        minWidth: useFixedWidth ? '200px' : 'auto',
                      }}
                    >
                      {/* Time Slots Grid */}
                      <div>
                        {timeSlots.map((time) => {
                          // Get shifts for this team member on current date
                          const memberShifts = getShiftsForMemberAndDate(
                            member.id,
                            currentDate,
                            shifts
                          );

                          // Check if this time slot is within team member's shift
                          const hasShift = isTimeInShift(time, memberShifts);

                          // Check if this time slot is blocked
                          const isBlocked = isTimeBlocked(
                            time,
                            memberBlockedTimes
                          );

                          // Check if time slot has an appointment
                          const hasAppointment = appointments.some((apt) => {
                            const aptStart = apt.start_time.substring(0, 5);
                            const aptEnd = apt.end_time.substring(0, 5);
                            return time >= aptStart && time < aptEnd;
                          });

                          // Determine if slot is clickable (not booked, not blocked)
                          const isClickable = !hasAppointment && !isBlocked;

                          // Determine background color based on state
                          let bgColorClass = '';
                          let cursorClass = '';
                          let titleText = '';

                          if (!hasShift) {
                            // No shift = light gray, clickable
                            bgColorClass = 'bg-gray-100 hover:bg-purple-50';
                            cursorClass = 'cursor-pointer';
                            titleText = `Click to add appointment or block time at ${formatTime12Hour(
                              time
                            )} (no shift scheduled)`;
                          } else if (isBlocked) {
                            // Has shift but blocked = dark gray, not clickable
                            bgColorClass = 'bg-gray-400';
                            cursorClass = 'cursor-not-allowed';
                            titleText = 'Time blocked';
                          } else if (hasAppointment) {
                            // Has shift with appointment = gray, not clickable
                            bgColorClass = 'bg-gray-200';
                            cursorClass = 'cursor-not-allowed';
                            titleText = 'Time slot booked';
                          } else {
                            // Has shift, available = white, clickable
                            bgColorClass = 'bg-white hover:bg-purple-50';
                            cursorClass = 'cursor-pointer';
                            titleText = `Click to add appointment or block time at ${formatTime12Hour(
                              time
                            )}`;
                          }

                          return (
                            <div
                              key={time}
                              className={`h-5 border-t border-gray-100 transition-colors ${bgColorClass} ${cursorClass}`}
                              onClick={() => {
                                if (isClickable) {
                                  handleSlotClick(time, member.id, memberName);
                                }
                              }}
                              title={titleText}
                            />
                          );
                        })}
                      </div>

                      {/* Appointments and Blocked Times Overlay */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ height: `${timeSlots.length * 20}px` }}
                      >
                        {/* Appointments */}
                        {appointments.map((appointment) => {
                          const { top, height } = getStyle(
                            appointment.start_time,
                            appointment.end_time
                          );

                          return (
                            <div
                              key={appointment.id}
                              className="absolute inset-x-0 pointer-events-auto px-1"
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                            >
                              <AppointmentCard
                                appointment={appointment}
                                booking={appointment.booking}
                              />
                            </div>
                          );
                        })}

                        {/* Blocked Times */}
                        {memberBlockedTimes.map((blockedTime) => {
                          const { top, height } = getStyle(
                            blockedTime.start_time,
                            blockedTime.end_time
                          );
                          return (
                            <div
                              key={blockedTime.id}
                              className="absolute inset-x-0 pointer-events-auto cursor-pointer px-1"
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                              onClick={() =>
                                handleBlockedTimeClick(blockedTime, memberName)
                              }
                            >
                              <div className="h-full rounded-md border-2 border-dashed border-gray-400 bg-gray-100/80 px-2 py-1.5 hover:bg-gray-200/80 transition-colors flex flex-col overflow-hidden">
                                <div className="text-xs text-gray-600 font-medium flex items-center gap-1 leading-tight">
                                  <span>🚫</span>
                                  <span>Blocked</span>
                                </div>
                                {blockedTime.reason && (
                                  <div className="text-xs text-gray-500 mt-0.5 truncate leading-tight">
                                    {blockedTime.reason}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showActionsModal && selectedSlot && (
        <TimeSlotActionsModal
          isOpen={showActionsModal}
          onClose={() => {
            setShowActionsModal(false);
            setSelectedSlot(null);
          }}
          timeSlot={selectedSlot.time}
          date={currentDate}
          teamMemberId={selectedSlot.teamMemberId}
          teamMemberName={selectedSlot.teamMemberName}
          venueId={venueId}
          venueName=""
          onSuccess={onRefresh}
        />
      )}

      {showBlockedTimeModal && selectedSlot && selectedBlockedTime && (
        <BlockedTimeModal
          isOpen={showBlockedTimeModal}
          onClose={() => {
            setShowBlockedTimeModal(false);
            setSelectedBlockedTime(null);
            setSelectedSlot(null);
          }}
          teamMemberId={selectedSlot.teamMemberId}
          teamMemberName={selectedSlot.teamMemberName}
          venueId={venueId}
          venueName=""
          date={currentDate}
          defaultStartTime={selectedSlot.time}
          existingBlockedTime={selectedBlockedTime}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}
