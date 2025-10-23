// components/admin/calendar/day-view.tsx
'use client';

import { useMemo } from 'react';
import { AppointmentCard } from './appointment-card';
import type {
  CalendarBooking,
  CalendarTeamMember,
  AppointmentWithBooking,
  AppointmentsByMember,
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
}

export function DayView({
  bookings,
  shifts,
  assignedTeamMembers,
  currentDate,
}: DayViewProps) {
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
          grouped.set(memberId, { member, appointments: [] });
        }

        grouped.get(memberId)!.appointments.push({
          ...appointment,
          booking,
        });
      });
    });

    // Then, add team members from shifts (for today) who don't have bookings yet
    const todayShifts = shifts.filter((s) => s.shift_date === currentDate);
    todayShifts.forEach((shift) => {
      if (!grouped.has(shift.team_member_id)) {
        grouped.set(shift.team_member_id, {
          member: {
            id: shift.team_member.id,
            first_name: shift.team_member.first_name,
            last_name: shift.team_member.last_name,
            photo_url: shift.team_member.photo_url,
          },
          appointments: [],
        });
      }
    });

    // Finally, add ALL assigned team members (even without shifts for today)
    assignedTeamMembers.forEach((member) => {
      if (!grouped.has(member.id)) {
        grouped.set(member.id, {
          member: {
            id: member.id,
            first_name: member.first_name,
            last_name: member.last_name,
            photo_url: member.photo_url,
          },
          appointments: [],
        });
      }
    });

    return Array.from(grouped.values());
  }, [bookings, shifts, assignedTeamMembers, currentDate]);

  // Check if a time slot is available (not occupied by an appointment)
  const isSlotAvailable = (
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
  // ✅ FIXED: Changed from 30px to 20px to match time slot height
  const getAppointmentStyle = (
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          {appointmentsByMember.length === 0 ? (
            <div className="border-b border-gray-200 bg-gray-50 p-3">
              <div className="text-center text-gray-500">
                No bookings scheduled for this date
              </div>
            </div>
          ) : (
            <div
              className="grid border-b border-gray-200 bg-gray-50"
              style={{
                gridTemplateColumns: `80px repeat(${appointmentsByMember.length}, minmax(150px, 1fr))`,
              }}
            >
              <div className="p-3 border-r border-gray-200 font-semibold text-sm text-gray-700">
                Time
              </div>
              {appointmentsByMember.map(({ member }) => (
                <div
                  key={member.id}
                  className="p-3 border-r border-gray-200 text-center"
                >
                  <div className="flex flex-col items-center gap-1">
                    {member.photo_url && (
                      <Image
                        src={member.photo_url}
                        alt={member.first_name}
                        className="w-8 h-8 rounded-full object-cover"
                        width={32}
                        height={32}
                      />
                    )}
                    <div className="font-medium text-sm text-gray-900">
                      {member.first_name} {member.last_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                    gridTemplateColumns:
                      appointmentsByMember.length === 0
                        ? '80px 1fr'
                        : `80px repeat(${appointmentsByMember.length}, minmax(150px, 1fr))`,
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
                  {appointmentsByMember.length === 0 ? (
                    <div
                      className={`border-r border-gray-200 relative bg-gray-100 ${
                        isHourMark
                          ? 'border-t-2 border-t-gray-300'
                          : 'border-t border-t-gray-100'
                      }`}
                    />
                  ) : (
                    appointmentsByMember.map(({ member, appointments }) => {
                      const isAvailable = isSlotAvailable(time, appointments);
                      return (
                        <div
                          key={member.id}
                          className={`border-r border-gray-200 relative group cursor-pointer transition-colors ${
                            isAvailable
                              ? 'bg-white hover:bg-blue-50'
                              : 'bg-gray-100 hover:bg-gray-200'
                          } ${
                            isHourMark
                              ? 'border-t-2 border-t-gray-300'
                              : 'border-t border-t-gray-100'
                          }`}
                          title={formatTime(time)}
                        >
                          {/* Hover tooltip */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <span className="text-[10px] font-medium text-gray-700 bg-white/90 px-1 rounded">
                              {formatTime(time)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}

            {/* Appointments Overlay */}
            {appointmentsByMember.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="relative h-full grid"
                  style={{
                    gridTemplateColumns: `80px repeat(${appointmentsByMember.length}, minmax(150px, 1fr))`,
                  }}
                >
                  <div /> {/* Empty space for time column */}
                  {appointmentsByMember.map(({ member, appointments }) => (
                    <div key={member.id} className="relative">
                      {appointments.map((appointment) => {
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
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
