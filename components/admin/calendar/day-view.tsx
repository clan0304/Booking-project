// components/admin/calendar/day-view.tsx
'use client';

import { useMemo, useState } from 'react';
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

  // Check if a time slot is available (not occupied by appointment or blocked time)
  const isSlotAvailable = (
    time: string,
    appointments: AppointmentWithBooking[],
    memberBlockedTimes: BlockedTime[]
  ): boolean => {
    // Normalize time to HH:MM format for comparison
    const normalizeTime = (timeStr: string): string => {
      return timeStr.substring(0, 5); // Get HH:MM from HH:MM or HH:MM:SS
    };

    const currentTime = normalizeTime(time);

    // Check appointments - time slot is unavailable if it falls within an appointment
    const hasAppointment = appointments.some((apt) => {
      const aptStart = normalizeTime(apt.start_time);
      const aptEnd = normalizeTime(apt.end_time);
      return currentTime >= aptStart && currentTime < aptEnd;
    });

    if (hasAppointment) return false;

    // Check blocked times - time slot is unavailable if it falls within blocked time
    const hasBlockedTime = memberBlockedTimes.some((blocked) => {
      const blockStart = normalizeTime(blocked.start_time);
      const blockEnd = normalizeTime(blocked.end_time);
      return currentTime >= blockStart && currentTime < blockEnd;
    });

    return !hasBlockedTime;
  };

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
    return `${displayHour} ${period}`;
  };

  // Calculate position and height for absolute positioning
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

  // Calculate flexible column width
  const teamMemberCount = appointmentsByMember.length;
  const gridTemplateColumns = `80px repeat(${teamMemberCount}, 1fr)`;

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {appointmentsByMember.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <p className="text-lg font-medium">No team members scheduled</p>
            <p className="text-sm mt-1">
              Assign team members to shifts to view the calendar
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header with Team Member Photos */}
              <div
                className="grid border-b border-gray-200 bg-gray-50 sticky top-0 z-30"
                style={{ gridTemplateColumns }}
              >
                {/* Time column header */}
                <div className="p-3 border-r border-gray-200" />

                {/* Team member columns */}
                {appointmentsByMember.map(({ member }) => {
                  const memberName = `${member.first_name} ${
                    member.last_name || ''
                  }`.trim();

                  return (
                    <div
                      key={member.id}
                      className="flex flex-col items-center justify-center p-4 border-r border-gray-200"
                    >
                      {/* Circular Profile Photo */}
                      <div className="relative w-16 h-16 mb-2">
                        <div className="w-full h-full rounded-full overflow-hidden border-2 border-white shadow-md bg-gradient-to-br from-purple-400 to-purple-600">
                          {member.photo_url ? (
                            <Image
                              src={member.photo_url}
                              alt={memberName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white font-semibold text-lg">
                              {member.first_name.charAt(0)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Name */}
                      <div className="text-sm font-semibold text-gray-900">
                        {memberName}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calendar Grid */}
              <div className="relative">
                {/* Time slots grid */}
                <div className="grid" style={{ gridTemplateColumns }}>
                  {/* Time column */}
                  <div className="border-r border-gray-200">
                    {timeSlots.map((time) => {
                      const showLabel = hourLabels.includes(time);
                      return (
                        <div
                          key={time}
                          className="h-[20px] flex items-center justify-end pr-2 text-xs text-gray-600 border-b border-gray-100"
                        >
                          {showLabel && formatTimeLabel(time)}
                        </div>
                      );
                    })}
                  </div>

                  {/* Team member columns */}
                  {appointmentsByMember.map(({ member, appointments }) => {
                    const memberName = `${member.first_name} ${
                      member.last_name || ''
                    }`.trim();
                    const memberBlockedTimes =
                      blockedTimesByMember.get(member.id) || [];

                    return (
                      <div
                        key={member.id}
                        className="relative border-r border-gray-200"
                      >
                        {/* Time slot cells */}
                        {timeSlots.map((time) => {
                          const available = isSlotAvailable(
                            time,
                            appointments,
                            memberBlockedTimes
                          );

                          return (
                            <div
                              key={time}
                              className={`h-[20px] border-b border-gray-100 transition-colors ${
                                available
                                  ? 'bg-white hover:bg-purple-50 cursor-pointer'
                                  : 'bg-gray-200 cursor-not-allowed'
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
                                  : 'Time slot unavailable'
                              }
                            />
                          );
                        })}

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

                            // Get client name
                            const clientName = `${
                              appointment.booking.guest_first_name
                            } ${
                              appointment.booking.guest_last_name || ''
                            }`.trim();

                            // Get service category color
                            const categoryColor =
                              appointment.category_color || '#8B5CF6';

                            // Format time range
                            const startTime = formatTime12Hour(
                              appointment.start_time
                            );
                            const endTime = formatTime12Hour(
                              appointment.end_time
                            );

                            return (
                              <div
                                key={appointment.id}
                                className="absolute inset-x-0 pointer-events-auto group"
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                }}
                              >
                                <div
                                  className="h-full rounded-md px-2 py-1.5 shadow-sm border border-white/20 cursor-pointer transition-all hover:shadow-md overflow-hidden"
                                  style={{
                                    backgroundColor: categoryColor,
                                    color: '#1F2937', // gray-900
                                  }}
                                >
                                  {/* Time range and Client name on same row */}
                                  <div className="text-xs font-medium leading-tight truncate">
                                    {startTime} - {endTime}{' '}
                                    <span className="font-bold">
                                      {clientName}
                                    </span>
                                  </div>

                                  {/* Service name on next row */}
                                  <div className="text-xs leading-tight mt-0.5 truncate">
                                    {appointment.service_name}
                                  </div>

                                  {/* Hover tooltip with white background and full details */}
                                  <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 w-80 pointer-events-none">
                                    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4">
                                      {/* Status Badge */}
                                      <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-bold text-gray-900">
                                          Booking Details
                                        </h3>
                                        <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                                          {appointment.status}
                                        </span>
                                      </div>

                                      {/* Client Info */}
                                      <div className="mb-3">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                          Client
                                        </h4>
                                        <div className="space-y-1.5">
                                          <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span>👤</span>
                                            <span>{clientName}</span>
                                          </div>
                                          {appointment.booking.guest_email && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                              <span>✉️</span>
                                              <span>
                                                {
                                                  appointment.booking
                                                    .guest_email
                                                }
                                              </span>
                                            </div>
                                          )}
                                          {appointment.booking.guest_phone && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                              <span>📞</span>
                                              <span>
                                                {
                                                  appointment.booking
                                                    .guest_phone
                                                }
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Appointment Info */}
                                      <div className="mb-3">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                          Appointment
                                        </h4>
                                        <div className="space-y-1.5">
                                          <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span>📅</span>
                                            <span>
                                              {appointment.booking.booking_date}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span>🕐</span>
                                            <span>
                                              {startTime} - {endTime} (
                                              {appointment.duration_minutes}{' '}
                                              min)
                                            </span>
                                          </div>
                                          {appointment.team_member && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                              <span>💇</span>
                                              <span>
                                                with{' '}
                                                {
                                                  appointment.team_member
                                                    .first_name
                                                }{' '}
                                                {
                                                  appointment.team_member
                                                    .last_name
                                                }
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Service & Price */}
                                      <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="font-semibold text-sm text-gray-900">
                                              {appointment.service_name}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                              {appointment.duration_minutes}{' '}
                                              minutes
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">
                                              ${appointment.price.toFixed(2)}
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Notes */}
                                      {(appointment.notes ||
                                        appointment.booking.notes) && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                          <h4 className="text-sm font-semibold text-gray-700 mb-1">
                                            Notes
                                          </h4>
                                          <p className="text-sm text-gray-600">
                                            {appointment.notes ||
                                              appointment.booking.notes}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
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
                                className="absolute inset-x-0 pointer-events-auto cursor-pointer"
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
