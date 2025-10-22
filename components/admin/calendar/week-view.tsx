// components/admin/calendar/week-view.tsx
'use client';

import { useMemo } from 'react';
import { getWeekRange } from '@/lib/shift-helpers';
import { AppointmentCard } from './appointment-card';
import type {
  CalendarBooking,
  CalendarTeamMember,
  AppointmentWithBooking,
  AppointmentsByMemberAndDate,
  WeekDay,
} from '@/types/calendar';
import Image from 'next/image';

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
}

export function WeekView({ weekStart, bookings }: WeekViewProps) {
  // Get week days (Mon-Sun)
  const weekDays = useMemo((): WeekDay[] => {
    const { days } = getWeekRange(weekStart);
    return days;
  }, [weekStart]);

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
        booking.appointments?.forEach((appointment) => {
          const memberId = appointment.team_member_id;
          const member = appointment.team_member;
          const bookingDate = booking.booking_date;

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

      return Array.from(grouped.values());
    }, [bookings]);

  // Check if a time slot is available for a specific day
  const isSlotAvailable = (
    date: string,
    time: string,
    appointments: AppointmentWithBooking[]
  ): boolean => {
    const [hour, min] = time.split(':').map(Number);
    const slotMinutes = hour * 60 + min;

    return !appointments.some((appt) => {
      const [startHour, startMin] = appt.start_time.split(':').map(Number);
      const [endHour, endMin] = appt.end_time.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  };

  // Format time for display (12-hour format)
  const formatTime = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min} ${period}`;
  };

  // Calculate appointment position and height
  const getAppointmentStyle = (
    startTime: string,
    endTime: string
  ): { top: number; height: number } => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const baseMinutes = 8 * 60; // 8 AM
    const top = ((startMinutes - baseMinutes) / 15) * 30; // 30px per 15min (increased from 20px)
    const height = ((endMinutes - startMinutes) / 15) * 30;

    return { top, height };
  };

  return (
    <div className="space-y-4">
      {appointmentsByMemberAndDate.length === 0 ? (
        // Empty state
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 p-3">
            <div className="text-center text-gray-500">
              No bookings scheduled for this week
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
                      {/* Time column - no borders */}
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
                          className={`border-r border-gray-200 relative bg-gray-100 group cursor-pointer hover:bg-gray-200 transition-colors ${
                            isHourMark
                              ? 'border-t-2 border-t-gray-300'
                              : 'border-t border-t-gray-100'
                          }`}
                          title={`${day.dayName} ${formatTime(time)}`}
                        >
                          {/* Hover tooltip */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <span className="text-[10px] font-medium text-gray-700 bg-white/90 px-1 rounded">
                              {formatTime(time)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Team member grids
        appointmentsByMemberAndDate.map(({ member, appointmentsByDate }) => (
          <div
            key={member.id}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            {/* Team Member Header */}
            <div className="bg-gray-50 border-b border-gray-200 p-3">
              <div className="flex items-center gap-3">
                {member.photo_url && (
                  <Image
                    src={member.photo_url}
                    alt={member.first_name}
                    className="w-10 h-10 rounded-full object-cover"
                    width={40}
                    height={40}
                  />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {member.first_name} {member.last_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {appointmentsByDate.size} day
                    {appointmentsByDate.size !== 1 ? 's' : ''} with bookings
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
                        {/* Time column - no borders */}
                        <div
                          className={`p-0.5 border-r border-gray-200 text-xs ${
                            showLabel ? 'text-gray-600' : 'text-transparent'
                          }`}
                        >
                          {showLabel ? time : '·'}
                        </div>
                        {weekDays.map((day) => {
                          const dayAppointments =
                            appointmentsByDate.get(day.date) || [];
                          const isAvailable = isSlotAvailable(
                            day.date,
                            time,
                            dayAppointments
                          );

                          return (
                            <div
                              key={`${day.date}-${time}`}
                              className={`border-r border-gray-200 relative group cursor-pointer transition-colors ${
                                isAvailable
                                  ? 'bg-white hover:bg-blue-50'
                                  : 'bg-gray-100 hover:bg-gray-200'
                              } ${
                                isHourMark
                                  ? 'border-t-2 border-t-gray-300'
                                  : 'border-t border-t-gray-100'
                              }`}
                              title={`${day.dayName} ${formatTime(time)}`}
                            >
                              {/* Hover tooltip */}
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                <span className="text-[10px] font-medium text-gray-700 bg-white/90 px-1 rounded">
                                  {formatTime(time)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Appointments Overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div
                      className="relative h-full grid"
                      style={{
                        gridTemplateColumns: '60px repeat(7, 1fr)',
                      }}
                    >
                      <div /> {/* Empty space for time column */}
                      {weekDays.map((day) => {
                        const dayAppointments =
                          appointmentsByDate.get(day.date) || [];
                        return (
                          <div key={day.date} className="relative">
                            {dayAppointments.map((appointment) => {
                              const { top, height } = getAppointmentStyle(
                                appointment.start_time,
                                appointment.end_time
                              );
                              return (
                                <div
                                  key={appointment.id}
                                  className="absolute left-1 right-1 pointer-events-auto z-20"
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                  }}
                                >
                                  <AppointmentCard
                                    appointment={appointment}
                                    booking={appointment.booking}
                                    compact
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
