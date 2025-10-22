// components/admin/calendar/appointment-card.tsx
'use client';

import { useState } from 'react';
import { AppointmentDetailsModal } from './appointment-details-modal';
import type { CalendarAppointment, CalendarBooking } from '@/types/calendar';

interface AppointmentCardProps {
  appointment: CalendarAppointment;
  booking: CalendarBooking;
  compact?: boolean;
}

// Default color if no category color is available
const DEFAULT_COLOR = '#4ECDC4';

export function AppointmentCard({
  appointment,
  booking,
  compact = false,
}: AppointmentCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Use category color from appointment data, fallback to default
  const backgroundColor = appointment.category_color || DEFAULT_COLOR;

  // Format time to HH:mm (remove seconds)
  const formatTime = (time: string): string => {
    // If time is already in HH:mm format, return as is
    if (time.length === 5 && time.includes(':')) {
      return time;
    }
    // If time has seconds (HH:mm:ss), remove them
    return time.substring(0, 5);
  };

  const startTime = formatTime(appointment.start_time);
  const endTime = formatTime(appointment.end_time);
  const timeRange = `${startTime} - ${endTime}`;

  const clientName = `${booking.guest_first_name} ${
    booking.guest_last_name || ''
  }`.trim();

  return (
    <>
      <div
        onClick={() => setShowDetails(true)}
        className="h-full rounded-md p-2 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
        style={{ backgroundColor }}
      >
        {compact ? (
          // Compact view for week view - Very tight spacing
          <div className="flex flex-col text-white leading-tight">
            <p className="font-semibold text-[10px] mb-0.5 truncate">
              {timeRange}
            </p>
            <p className="font-medium text-[10px] mb-0.5 truncate">
              {clientName}
            </p>
            <p className="text-[10px] truncate">{appointment.service_name}</p>
          </div>
        ) : (
          // Full view for day view - Optimized for space
          <div className="flex flex-col text-white leading-tight">
            {/* Mobile: Stack everything - smaller text */}
            <div className="block md:hidden">
              <p className="font-semibold text-[11px] mb-0.5 truncate">
                {timeRange}
              </p>
              <p className="font-medium text-[11px] mb-0.5 truncate">
                {clientName}
              </p>
              <p className="text-[10px] truncate">{appointment.service_name}</p>
            </div>

            {/* Tablet/Desktop: Time and name on same row, service on next row */}
            <div className="hidden md:flex md:flex-col">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <p className="font-semibold text-[11px] truncate">
                  {timeRange}
                </p>
                <p className="font-medium text-[11px] truncate">{clientName}</p>
              </div>
              <p className="text-[10px] truncate leading-tight">
                {appointment.service_name}
              </p>
            </div>

            {/* Status badge if not confirmed */}
            {appointment.status !== 'confirmed' && (
              <div className="mt-1">
                <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-white/30 truncate">
                  {appointment.status}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetails && (
        <AppointmentDetailsModal
          appointment={appointment}
          booking={booking}
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
}
