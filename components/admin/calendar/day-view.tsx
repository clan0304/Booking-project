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
}

export function DayView({ bookings }: DayViewProps) {
  // Generate time slots (8 AM to 8 PM, 30-min intervals)
  const timeSlots = useMemo((): string[] => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 20) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  // Group appointments by team member
  const appointmentsByMember = useMemo((): AppointmentsByMember[] => {
    const grouped = new Map<
      string,
      { member: CalendarTeamMember; appointments: AppointmentWithBooking[] }
    >();

    bookings.forEach((booking) => {
      booking.appointments?.forEach((appointment) => {
        const memberId = appointment.team_member_id;
        const member = appointment.team_member;

        // Skip if team member info is missing
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
    const top = ((startMinutes - baseMinutes) / 30) * 60; // 60px per 30min slot
    const height = ((endMinutes - startMinutes) / 30) * 60;

    return { top, height };
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          {appointmentsByMember.length === 0 ? (
            // Empty state header - just show time column
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
                        width={8}
                        height={8}
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

          {/* Calendar Grid - Always show */}
          <div className="relative">
            {/* Time slots */}
            {timeSlots.map((time) => (
              <div
                key={time}
                className="grid border-b border-gray-200"
                style={{
                  gridTemplateColumns:
                    appointmentsByMember.length === 0
                      ? '80px 1fr'
                      : `80px repeat(${appointmentsByMember.length}, minmax(150px, 1fr))`,
                  height: '60px',
                }}
              >
                <div className="p-2 border-r border-gray-200 text-sm text-gray-600">
                  {time}
                </div>
                {appointmentsByMember.length === 0 ? (
                  <div className="border-r border-gray-200 relative bg-gray-50" />
                ) : (
                  appointmentsByMember.map(({ member }) => (
                    <div
                      key={`${member.id}-${time}`}
                      className="border-r border-gray-200 relative"
                    />
                  ))
                )}
              </div>
            ))}

            {/* Appointments Overlay - Only show if there are appointments */}
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
                            className="absolute left-1 right-1 pointer-events-auto"
                            style={{ top: `${top}px`, height: `${height}px` }}
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
