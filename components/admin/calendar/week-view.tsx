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
  venueId?: string;
  teamMemberId?: string;
  bookings: CalendarBooking[];
}

export function WeekView({
  weekStart,

  bookings,
}: WeekViewProps) {
  // Get week days (Mon-Sun)
  const weekDays = useMemo((): WeekDay[] => {
    const { days } = getWeekRange(weekStart);
    return days;
  }, [weekStart]);

  // Generate time slots (8 AM to 8 PM, 1-hour intervals for week view)
  const timeSlots = useMemo((): string[] => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
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

          // Skip if team member info is missing
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
    const top = ((startMinutes - baseMinutes) / 60) * 60; // 60px per hour
    const height = ((endMinutes - startMinutes) / 60) * 60;

    return { top, height };
  };

  return (
    <div className="space-y-4">
      {appointmentsByMemberAndDate.length === 0 ? (
        // Empty state - show basic week grid without team members
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
                {/* Time slots */}
                {timeSlots.map((time) => (
                  <div
                    key={time}
                    className="grid border-b border-gray-200"
                    style={{
                      gridTemplateColumns: '60px repeat(7, 1fr)',
                      height: '60px',
                    }}
                  >
                    <div className="p-2 border-r border-gray-200 text-xs text-gray-600">
                      {time}
                    </div>
                    {weekDays.map((day) => (
                      <div
                        key={`${day.date}-${time}`}
                        className="border-r border-gray-200 relative bg-gray-50"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
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
                    width={10}
                    height={10}
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
                  {timeSlots.map((time) => (
                    <div
                      key={time}
                      className="grid border-b border-gray-200"
                      style={{
                        gridTemplateColumns: '60px repeat(7, 1fr)',
                        height: '60px',
                      }}
                    >
                      <div className="p-2 border-r border-gray-200 text-xs text-gray-600">
                        {time}
                      </div>
                      {weekDays.map((day) => (
                        <div
                          key={`${day.date}-${time}`}
                          className="border-r border-gray-200 relative"
                        />
                      ))}
                    </div>
                  ))}

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
                                  className="absolute left-1 right-1 pointer-events-auto"
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
