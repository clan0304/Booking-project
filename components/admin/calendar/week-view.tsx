// components/admin/calendar/week-view.tsx
'use client';

import { useMemo, useState } from 'react';
import { AppointmentCard } from './appointment-card';
import { TimeSlotActionsModal } from './time-slot-actions-modal';
import { BlockedTimeModal } from './blocked-time-modal';
import {
  addDays,
  isTimeInShift,
  getShiftsForMemberAndDate,
  isTimeBlocked,
} from '@/lib/shift-helpers';
import type {
  CalendarBooking,
  CalendarTeamMember,
  AppointmentWithBooking,
  AppointmentsByMemberAndDate,
  WeekDay,
  BlockedTime,
} from '@/types/calendar';
import { EditAppointmentModal } from './appointment/edit-appointment-modal';
import Image from 'next/image';
import { getBookingByAppointmentId } from '@/app/actions/calendar-appointments';
import type { BookingGroupWithAppointments } from '@/types/calendar';

interface WeekViewProps {
  weekStart: string;
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
  blockedTimes: BlockedTime[];
  venueId: string;
  onRefresh: () => void;
}

export function WeekView({
  weekStart,
  bookings,
  shifts,
  assignedTeamMembers,
  blockedTimes,
  venueId,
  onRefresh,
}: WeekViewProps) {
  // State for modals
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showBlockedTimeModal, setShowBlockedTimeModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    time: string;
    date: string;
    teamMemberId: string;
    teamMemberName: string;
  } | null>(null);
  const [selectedBlockedTime, setSelectedBlockedTime] =
    useState<BlockedTime | null>(null);

  // ✅ UPDATED: Changed from selectedAppointment to selectedBooking
  const [selectedBooking, setSelectedBooking] =
    useState<BookingGroupWithAppointments | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoadingBooking, setIsLoadingBooking] = useState(false);

  // Generate time slots (12 AM to 11:45 PM, 15-min intervals)
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

  // Generate week days
  const weekDays = useMemo((): WeekDay[] => {
    const days: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      days.push({
        date,
        dayOfWeek: new Date(date + 'T00:00:00').getDay(),
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
          new Date(date + 'T00:00:00').getDay()
        ],
      });
    }
    return days;
  }, [weekStart]);

  // Group appointments by team member and date
  const appointmentsByMemberAndDate =
    useMemo((): AppointmentsByMemberAndDate[] => {
      const grouped = new Map<
        string,
        {
          member: CalendarTeamMember;
          appointmentsByDate: Map<string, AppointmentWithBooking[]>;
        }
      >();

      bookings.forEach((booking) => {
        const bookingDate = booking.booking_date;

        booking.appointments?.forEach((appointment) => {
          const memberId = appointment.team_member_id;
          const member = appointment.team_member;

          if (!member) return;

          if (!grouped.has(memberId)) {
            grouped.set(memberId, {
              member,
              appointmentsByDate: new Map(),
            });
          }

          const memberData = grouped.get(memberId)!;
          if (!memberData.appointmentsByDate.has(bookingDate)) {
            memberData.appointmentsByDate.set(bookingDate, []);
          }

          memberData.appointmentsByDate.get(bookingDate)!.push({
            ...appointment,
            booking,
          });
        });
      });

      // Add team members from assignedTeamMembers who don't have bookings
      assignedTeamMembers.forEach((member) => {
        if (!grouped.has(member.id)) {
          grouped.set(member.id, {
            member,
            appointmentsByDate: new Map(),
          });
        }
      });

      return Array.from(grouped.values());
    }, [bookings, assignedTeamMembers]);

  // Group blocked times by team member and date
  const blockedTimesByMemberAndDate = useMemo(() => {
    const grouped = new Map<string, Map<string, BlockedTime[]>>();
    blockedTimes.forEach((bt) => {
      if (!grouped.has(bt.team_member_id)) {
        grouped.set(bt.team_member_id, new Map());
      }
      const memberMap = grouped.get(bt.team_member_id)!;
      if (!memberMap.has(bt.blocked_date)) {
        memberMap.set(bt.blocked_date, []);
      }
      memberMap.get(bt.blocked_date)!.push(bt);
    });
    return grouped;
  }, [blockedTimes]);

  // Calculate position and height
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
    date: string,
    teamMemberId: string,
    teamMemberName: string
  ) => {
    setSelectedSlot({ time, date, teamMemberId, teamMemberName });
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
      date: blockedTime.blocked_date,
      teamMemberId: blockedTime.team_member_id,
      teamMemberName,
    });
    setShowBlockedTimeModal(true);
  };

  // Get appointments for a specific date
  const getAppointmentsForDate = (
    memberAppointments: Map<string, AppointmentWithBooking[]>,
    date: string
  ): AppointmentWithBooking[] => {
    return memberAppointments.get(date) || [];
  };

  // ✅ UPDATED: Async function that fetches full booking
  const handleAppointmentClick = async (
    appointment: AppointmentWithBooking
  ) => {
    setIsLoadingBooking(true);
    setIsEditModalOpen(true);

    try {
      const result = await getBookingByAppointmentId(appointment.id);

      if (result.success && result.data) {
        setSelectedBooking(result.data);
      } else {
        console.error('Failed to load booking:', result.error);
        setIsEditModalOpen(false);
        alert('Failed to load booking details. Please try again.');
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      setIsEditModalOpen(false);
      alert('An error occurred while loading booking details.');
    } finally {
      setIsLoadingBooking(false);
    }
  };

  // ✅ UPDATED: Clears selectedBooking
  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedBooking(null);
    onRefresh();
  };

  return (
    <>
      <div className="space-y-4">
        {appointmentsByMemberAndDate.length === 0 ? (
          // Empty state - simplified grid
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-3">
              <div className="text-center text-gray-500">
                No bookings scheduled for this week
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                {/* Days Header */}
                <div
                  className="grid border-b border-gray-200 bg-gray-50"
                  style={{
                    gridTemplateColumns: '60px repeat(7, 1fr)',
                  }}
                >
                  <div className="p-2 border-r border-gray-200 text-xs font-semibold text-gray-700">
                    Time
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={day.date}
                      className="p-2 border-r border-gray-200 text-center"
                    >
                      <div className="text-xs font-semibold text-gray-700">
                        {day.dayName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(day.date + 'T00:00:00Z').getUTCDate()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="relative" style={{ minHeight: '600px' }}>
                  {timeSlots.map((time) => {
                    const isHourMark = time.endsWith(':00');
                    const showLabel = hourLabels.includes(time);

                    return (
                      <div
                        key={time}
                        className="grid"
                        style={{
                          gridTemplateColumns: '60px repeat(7, 1fr)',
                          height: '20px',
                        }}
                      >
                        <div
                          className={`p-0.5 border-r border-gray-200 text-xs ${
                            showLabel ? 'text-gray-600' : 'text-transparent'
                          }`}
                        >
                          {showLabel ? time : '·'}
                        </div>
                        {weekDays.map((day) => (
                          <div
                            key={`${day.date}-${time}`}
                            className={`border-r border-gray-200 bg-gray-100 ${
                              isHourMark
                                ? 'border-t-2 border-t-gray-300'
                                : 'border-t border-t-gray-100'
                            }`}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Team member rows with appointments
          appointmentsByMemberAndDate.map(({ member, appointmentsByDate }) => {
            const memberName = `${member.first_name} ${member.last_name}`;
            const memberBlockedTimes =
              blockedTimesByMemberAndDate.get(member.id) || new Map();
            const totalBookings = Array.from(
              appointmentsByDate.values()
            ).reduce((sum, appts) => sum + appts.length, 0);

            return (
              <div
                key={member.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Team Member Header */}
                <div className="bg-gray-50 border-b border-gray-200 p-3">
                  <div className="flex items-center gap-3">
                    {member.photo_url ? (
                      <Image
                        src={member.photo_url}
                        alt={memberName}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-sm">
                          {member.first_name[0]}
                          {member.last_name[0]}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {memberName}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {totalBookings} appointment
                        {totalBookings !== 1 ? 's' : ''} with bookings
                      </p>
                    </div>
                  </div>
                </div>

                {/* Week Grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-[1000px]">
                    {/* Days Header */}
                    <div
                      className="grid border-b border-gray-200 bg-gray-50"
                      style={{
                        gridTemplateColumns: '60px repeat(7, 1fr)',
                      }}
                    >
                      <div className="p-2 border-r border-gray-200 text-xs font-semibold text-gray-700">
                        Time
                      </div>
                      {weekDays.map((day) => (
                        <div
                          key={day.date}
                          className="p-2 border-r border-gray-200 text-center"
                        >
                          <div className="text-xs font-semibold text-gray-700">
                            {day.dayName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(day.date + 'T00:00:00Z').getUTCDate()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="relative">
                      {/* Time slots */}
                      {timeSlots.map((time) => {
                        const isHourMark = time.endsWith(':00');
                        const showLabel = hourLabels.includes(time);

                        return (
                          <div
                            key={time}
                            className="grid"
                            style={{
                              gridTemplateColumns: '60px repeat(7, 1fr)',
                              height: '20px',
                            }}
                          >
                            <div
                              className={`p-0.5 border-r border-gray-200 text-xs ${
                                showLabel ? 'text-gray-600' : 'text-transparent'
                              }`}
                            >
                              {showLabel ? time : '·'}
                            </div>
                            {weekDays.map((day) => {
                              // Get shifts for this team member on this specific date
                              const memberShifts = getShiftsForMemberAndDate(
                                member.id,
                                day.date,
                                shifts
                              );

                              // Check if this time slot is within team member's shift
                              const hasShift = isTimeInShift(
                                time,
                                memberShifts
                              );

                              // Get appointments and blocked times for this day
                              const dayAppointments = getAppointmentsForDate(
                                appointmentsByDate,
                                day.date
                              );
                              const dayBlockedTimes =
                                memberBlockedTimes.get(day.date) || [];

                              // Check if time is blocked
                              const isBlocked = isTimeBlocked(
                                time,
                                dayBlockedTimes
                              );

                              // Check if time has an appointment
                              const hasAppointment = dayAppointments.some(
                                (apt) => {
                                  const aptStart = apt.start_time.substring(
                                    0,
                                    5
                                  );
                                  const aptEnd = apt.end_time.substring(0, 5);
                                  return time >= aptStart && time < aptEnd;
                                }
                              );

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
                                titleText = 'Click to add (no shift scheduled)';
                              } else if (isBlocked) {
                                // Has shift but blocked = dark gray, not clickable
                                bgColorClass = 'bg-gray-400';
                                cursorClass = 'cursor-not-allowed';
                                titleText = 'Time blocked';
                              } else if (hasAppointment) {
                                // Has shift with appointment = gray, not clickable
                                bgColorClass = 'bg-gray-200';
                                cursorClass = 'cursor-not-allowed';
                                titleText = 'Booked';
                              } else {
                                // Has shift, available = white, clickable
                                bgColorClass = 'bg-white hover:bg-purple-50';
                                cursorClass = 'cursor-pointer';
                                titleText = 'Click to add';
                              }

                              return (
                                <div
                                  key={`${day.date}-${time}`}
                                  className={`border-r border-gray-200 relative group transition-colors ${bgColorClass} ${cursorClass} ${
                                    isHourMark
                                      ? 'border-t-2 border-t-gray-300'
                                      : 'border-t border-t-gray-100'
                                  }`}
                                  onClick={() => {
                                    if (isClickable) {
                                      handleSlotClick(
                                        time,
                                        day.date,
                                        member.id,
                                        memberName
                                      );
                                    }
                                  }}
                                  title={titleText}
                                />
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* Appointments & Blocked Times Overlay */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div
                          className="relative h-full grid"
                          style={{
                            gridTemplateColumns: '60px repeat(7, 1fr)',
                          }}
                        >
                          <div /> {/* Empty space for time column */}
                          {weekDays.map((day) => {
                            const dayAppointments = getAppointmentsForDate(
                              appointmentsByDate,
                              day.date
                            );
                            const dayBlockedTimes =
                              memberBlockedTimes.get(day.date) || [];

                            return (
                              <div key={day.date} className="relative">
                                {/* Appointments */}
                                {dayAppointments.map((appointment) => {
                                  const { top, height } = getStyle(
                                    appointment.start_time,
                                    appointment.end_time
                                  );
                                  return (
                                    <div
                                      key={appointment.id}
                                      className="absolute left-1 right-1 pointer-events-auto z-20"
                                      style={{
                                        top: `${top}px`,
                                        height: `${height * 0.99}px`,
                                      }}
                                    >
                                      <AppointmentCard
                                        appointment={appointment}
                                        booking={appointment.booking}
                                        compact
                                        onClick={() =>
                                          handleAppointmentClick(appointment)
                                        }
                                      />
                                    </div>
                                  );
                                })}

                                {/* Blocked Times */}
                                {dayBlockedTimes.map(
                                  (blockedTime: BlockedTime) => {
                                    const { top, height } = getStyle(
                                      blockedTime.start_time,
                                      blockedTime.end_time
                                    );
                                    return (
                                      <div
                                        key={blockedTime.id}
                                        className="absolute left-1 right-1 pointer-events-auto z-10 cursor-pointer"
                                        style={{
                                          top: `${top}px`,
                                          height: `${height * 0.99}px`,
                                        }}
                                        onClick={() =>
                                          handleBlockedTimeClick(
                                            blockedTime,
                                            memberName
                                          )
                                        }
                                      >
                                        <div className="h-full rounded-md border-2 border-dashed border-gray-400 bg-gray-100/80 px-1 py-1 hover:bg-gray-200/80 transition-colors flex flex-col overflow-hidden">
                                          <div className="text-[10px] text-gray-600 font-medium flex items-center gap-1 leading-tight">
                                            <span>🚫</span>
                                            <span className="truncate">
                                              Blocked
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
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
          date={selectedSlot.date}
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
          date={selectedSlot.date}
          defaultStartTime={selectedSlot.time}
          existingBlockedTime={selectedBlockedTime}
          onSuccess={onRefresh}
        />
      )}

      {/* ✅ UPDATED: Modal with loading state and booking prop */}
      {isEditModalOpen && (
        <>
          {isLoadingBooking ? (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
              <div className="bg-white rounded-lg p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading booking...</p>
              </div>
            </div>
          ) : selectedBooking ? (
            <EditAppointmentModal
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
                setSelectedBooking(null);
              }}
              booking={selectedBooking}
              onSuccess={handleEditSuccess}
            />
          ) : null}
        </>
      )}
    </>
  );
}
