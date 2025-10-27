// components/admin/calendar/day-view.tsx
'use client';

import { useMemo, useState } from 'react';
import { AppointmentCard } from './appointment-card';
import { TimeSlotActionsModal } from './time-slot-actions-modal';
import { BlockedTimeModal } from './blocked-time-modal';
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

    // Then add team members from shifts who don't have bookings
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

  // Check if a time slot is available (not occupied by appointment or blocked time)
  const isSlotAvailable = (
    time: string,
    appointments: AppointmentWithBooking[],
    memberBlockedTimes: BlockedTime[]
  ): boolean => {
    // Check appointments
    const hasAppointment = appointments.some((apt) => {
      return time >= apt.start_time && time < apt.end_time;
    });

    if (hasAppointment) return false;

    // Check blocked times
    const hasBlockedTime = memberBlockedTimes.some((blocked) => {
      const blockStart = blocked.start_time.substring(0, 5);
      const blockEnd = blocked.end_time.substring(0, 5);
      return time >= blockStart && time < blockEnd;
    });

    return !hasBlockedTime;
  };

  // Format time for display (12-hour format)
  const formatTime12Hour = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
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
    return `${displayHour}:00\n${period}`;
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
    const slotHeight = 60; // 60px per hour (4 x 15px per 15min slot)
    const top = ((startMinutes - baseMinutes) / 60) * slotHeight;
    const height = ((endMinutes - startMinutes) / 60) * slotHeight;

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

  // Handle blocked time click (for editing)
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

  const COLUMN_WIDTH = 240; // Width for each team member column

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {appointmentsByMember.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            No team members assigned to this venue
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="min-w-full"
              style={{
                minWidth: `${
                  80 + appointmentsByMember.length * COLUMN_WIDTH
                }px`,
              }}
            >
              {/* Header - Team Members with Profile Photos */}
              <div className="border-b border-gray-200 bg-gray-50/50 sticky top-0 z-10">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `80px repeat(${appointmentsByMember.length}, ${COLUMN_WIDTH}px)`,
                  }}
                >
                  {/* Empty corner cell */}
                  <div className="border-r border-gray-200" />

                  {/* Team member columns */}
                  {appointmentsByMember.map(({ member }) => {
                    const memberName = `${member.first_name} ${member.last_name}`;
                    return (
                      <div
                        key={member.id}
                        className="py-4 px-3 border-r border-gray-200 flex flex-col items-center gap-2"
                      >
                        {/* Circular profile photo */}
                        {member.photo_url ? (
                          <div className="relative w-16 h-16 rounded-full overflow-hidden ring-4 ring-white shadow-md">
                            <Image
                              src={member.photo_url}
                              alt={memberName}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center ring-4 ring-white shadow-md">
                            <span className="text-white font-bold text-xl">
                              {member.first_name[0]}
                              {member.last_name[0]}
                            </span>
                          </div>
                        )}
                        {/* Team member name */}
                        <p className="font-medium text-gray-900 text-center text-sm">
                          {member.first_name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots Grid */}
              <div>
                {timeSlots.map((time, timeIndex) => {
                  const isHourMark = time.endsWith(':00');
                  const showLabel = hourLabels.includes(time);

                  return (
                    <div
                      key={time}
                      className={`grid ${
                        isHourMark && timeIndex !== 0
                          ? 'border-t-2 border-t-gray-200'
                          : timeIndex === 0
                          ? ''
                          : 'border-t border-t-gray-100'
                      }`}
                      style={{
                        gridTemplateColumns: `80px repeat(${appointmentsByMember.length}, ${COLUMN_WIDTH}px)`,
                      }}
                    >
                      {/* Time Label */}
                      <div
                        className="border-r border-gray-200 pr-3 pt-1 text-right"
                        style={{ height: '60px' }}
                      >
                        {showLabel && (
                          <div className="text-xs text-gray-500 leading-tight whitespace-pre-line">
                            {formatTimeLabel(time)}
                          </div>
                        )}
                      </div>

                      {/* Team Member Columns */}
                      {appointmentsByMember.map(({ member, appointments }) => {
                        const memberBlockedTimes =
                          blockedTimesByMember.get(member.id) || [];
                        const memberName = `${member.first_name} ${member.last_name}`;
                        const available = isSlotAvailable(
                          time,
                          appointments,
                          memberBlockedTimes
                        );

                        return (
                          <div
                            key={`${time}-${member.id}`}
                            className="relative border-r border-gray-200"
                            style={{ height: '60px' }}
                          >
                            {/* Clickable slot background */}
                            <div
                              className={`absolute inset-0 group cursor-pointer transition-colors ${
                                available
                                  ? 'bg-white hover:bg-blue-50/30'
                                  : 'bg-gray-50/30'
                              }`}
                              onClick={() => {
                                if (available) {
                                  handleSlotClick(time, member.id, memberName);
                                }
                              }}
                              title={
                                available
                                  ? `Click to add appointment or block time at ${formatTime12Hour(
                                      time
                                    )}`
                                  : undefined
                              }
                            />

                            {/* Appointments and Blocked Times Overlay - Only render on first slot */}
                            {timeIndex === 0 && (
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ height: `${timeSlots.length * 60}px` }}
                              >
                                {/* Appointments using AppointmentCard */}
                                {appointments.map((appointment) => {
                                  const { top, height } = getStyle(
                                    appointment.start_time,
                                    appointment.end_time
                                  );

                                  return (
                                    <div
                                      key={appointment.id}
                                      className="absolute left-2 right-2 pointer-events-auto"
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

                                {/* Blocked Times Overlay */}
                                {memberBlockedTimes.map((blockedTime) => {
                                  const { top, height } = getStyle(
                                    blockedTime.start_time,
                                    blockedTime.end_time
                                  );
                                  return (
                                    <div
                                      key={blockedTime.id}
                                      className="absolute left-2 right-2 pointer-events-auto cursor-pointer"
                                      style={{
                                        top: `${top}px`,
                                        height: `${height}px`,
                                      }}
                                      onClick={() =>
                                        handleBlockedTimeClick(
                                          blockedTime,
                                          memberName
                                        )
                                      }
                                    >
                                      <div className="h-full rounded-lg border-2 border-dashed border-gray-400 bg-gray-100/80 p-2 hover:bg-gray-200/80 transition-colors flex flex-col">
                                        <div className="text-xs text-gray-600 font-medium flex items-center gap-1">
                                          <span>🚫</span>
                                          <span>Blocked</span>
                                        </div>
                                        {blockedTime.reason && (
                                          <div className="text-xs text-gray-500 mt-1 truncate">
                                            {blockedTime.reason}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
          venueName="" // TODO: Pass venue name if needed
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
          venueName="" // TODO: Pass venue name if needed
          date={currentDate}
          defaultStartTime={selectedSlot.time}
          existingBlockedTime={selectedBlockedTime}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}
