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
import { EditAppointmentModal } from './appointment/edit-appointment-modal';
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

// =====================================================
// OVERLAP HANDLING HELPERS
// =====================================================

/**
 * Convert HH:MM time to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if two appointments overlap in time
 */
function appointmentsOverlap(
  appt1: AppointmentWithBooking,
  appt2: AppointmentWithBooking
): boolean {
  const start1 = timeToMinutes(appt1.start_time);
  const end1 = timeToMinutes(appt1.end_time);
  const start2 = timeToMinutes(appt2.start_time);
  const end2 = timeToMinutes(appt2.end_time);

  // Overlaps if one starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Layout information for positioning overlapping appointments
 */
interface AppointmentLayout {
  width: string;
  left: string;
  zIndex: number;
}

/**
 * Calculate layout for overlapping appointments
 * Returns a Map of appointment ID to layout properties
 */
function calculateAppointmentLayouts(
  appointments: AppointmentWithBooking[]
): Map<string, AppointmentLayout> {
  const layouts = new Map<string, AppointmentLayout>();

  // Sort appointments by start time for consistent column assignment
  const sorted = [...appointments].sort((a, b) => {
    const startA = timeToMinutes(a.start_time);
    const startB = timeToMinutes(b.start_time);
    return startA - startB;
  });

  // For each appointment, find overlapping ones and assign layout
  for (const appointment of sorted) {
    // Find all appointments that overlap with this one
    const overlapping = appointments.filter((other) =>
      appointmentsOverlap(appointment, other)
    );

    const maxConcurrent = overlapping.length;

    // Find this appointment's position among overlapping ones
    const position = overlapping
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
      .findIndex((a) => a.id === appointment.id);

    // Calculate width and left position
    const widthPercent = 100 / maxConcurrent;
    const leftPercent = (position / maxConcurrent) * 100;

    layouts.set(appointment.id, {
      width: `${widthPercent - 0.5}%`, // Subtract 0.5% for visual gap
      left: `${leftPercent}%`,
      zIndex: position,
    });
  }

  return layouts;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

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
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentWithBooking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Generate time slots (8 AM to 8 PM, 15-min intervals)
  const timeSlots = useMemo((): string[] => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 23 || (hour === 23 && true)) {
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
    for (let hour = 0; hour < 24; hour++) {
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

  // ✅ NEW: Calculate appointment layouts for ALL members (must be at component level)
  const allAppointmentLayouts = useMemo(() => {
    const layouts = new Map<string, Map<string, AppointmentLayout>>();

    appointmentsByMember.forEach(({ member, appointments }) => {
      layouts.set(member.id, calculateAppointmentLayouts(appointments));
    });

    return layouts;
  }, [appointmentsByMember]);

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

    const baseMinutes = 0; // 12 AM (midnight)
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

  const handleAppointmentClick = (appointment: AppointmentWithBooking) => {
    setSelectedAppointment(appointment);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedAppointment(null);
    onRefresh();
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
                  ? `${appointmentsByMember.length * 200}px`
                  : '100%',
              }}
            >
              {/* Team Member Headers */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                {/* Empty space for time labels column */}
                <div className="flex-shrink-0 w-16" />

                {/* Team Member Headers */}
                {appointmentsByMember.map(({ member }) => (
                  <div
                    key={member.id}
                    className="border-r border-gray-200 p-4"
                    style={{
                      width: useFixedWidth ? '200px' : columnWidth,
                      minWidth: useFixedWidth ? '200px' : 'auto',
                    }}
                  >
                    {/* ✅ FIXED: Uniform layout with consistent sizing */}
                    <div className="flex flex-col items-center gap-3">
                      {/* Photo Container - Fixed Size */}
                      <div className="flex-shrink-0">
                        {member.photo_url ? (
                          <Image
                            src={member.photo_url}
                            alt={`${member.first_name} ${member.last_name}`}
                            width={56}
                            height={56}
                            className="rounded-full object-cover"
                            style={{ width: '56px', height: '56px' }}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                            <span className="text-base font-semibold text-white">
                              {member.first_name[0]}
                              {member.last_name[0]}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Text Container - Centered */}
                      <div className="text-center w-full">
                        <p className="text-sm font-semibold text-gray-900 truncate px-2">
                          {member.first_name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
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

                  // ✅ NEW: Get pre-calculated layouts for this member
                  const appointmentLayouts =
                    allAppointmentLayouts.get(member.id) || new Map();

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
                            // Has shift with appointment = white, not clickable (stylist is working)
                            bgColorClass = 'bg-white';
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

                          const layout = appointmentLayouts.get(
                            appointment.id
                          ) || {
                            width: '100%',
                            left: '0%',
                            zIndex: 0,
                          };

                          return (
                            <div
                              key={appointment.id}
                              className="absolute pointer-events-none px-1 group"
                              style={{
                                top: `${top}px`,
                                height: `${height * 0.99}px`,
                                width: layout.width,
                                left: layout.left,
                                zIndex: layout.zIndex,
                              }}
                            >
                              <div className="h-full w-full group-hover:w-[98%] pointer-events-auto transition-all duration-200 hover:z-[100]">
                                <AppointmentCard
                                  appointment={appointment}
                                  booking={appointment.booking}
                                  onClick={() =>
                                    handleAppointmentClick(appointment)
                                  }
                                />
                              </div>
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
                                height: `${height * 0.99}px`,
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
      {selectedAppointment && (
        <EditAppointmentModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          appointment={selectedAppointment}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}
