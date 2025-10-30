// components/admin/calendar/appointment-card.tsx
'use client';

import { Clock, User, DollarSign, Calendar, Mail, Phone } from 'lucide-react';
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

  const teamMemberName = appointment.team_member
    ? `${appointment.team_member.first_name} ${appointment.team_member.last_name}`
    : 'Unknown';

  return (
    <div className="relative group h-full">
      {/* Main Appointment Card */}
      <div
        className="h-full rounded-md p-2 cursor-pointer transition-all duration-200 overflow-hidden group-hover:w-[97%]"
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

      {/* Hover Tooltip - Appears on the right side */}
      {/* ✅ CHANGED: z-50 → z-[100] for highest priority */}
      <div className="absolute left-full top-0 ml-2 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none">
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4">
          {/* Header */}
          <div className="mb-3 pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">
              Booking Details
            </h3>
            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {appointment.status.charAt(0).toUpperCase() +
                appointment.status.slice(1)}
            </div>
          </div>

          {/* Client Information */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Client</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="truncate">{clientName}</span>
              </div>
              {booking.guest_email && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{booking.guest_email}</span>
                </div>
              )}
              {booking.guest_phone && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>{booking.guest_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Appointment Details */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Appointment
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span>{booking.booking_date}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span>
                  {timeRange} ({appointment.duration_minutes} min)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="truncate">with {teamMemberName}</span>
              </div>
            </div>
          </div>

          {/* Service & Price */}
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-xs text-gray-900 mb-0.5">
                  {appointment.service_name}
                </p>
                <p className="text-[10px] text-gray-500">
                  {appointment.duration_minutes} minutes
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                <DollarSign className="w-3.5 h-3.5" />
                {appointment.price.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Notes */}
          {(booking.notes || appointment.notes || booking.internal_notes) && (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
              {booking.notes && (
                <div className="bg-blue-50 rounded p-2">
                  <p className="text-[10px] font-medium text-blue-900 mb-0.5">
                    Client Notes:
                  </p>
                  <p className="text-xs text-blue-800">{booking.notes}</p>
                </div>
              )}
              {appointment.notes && (
                <div className="bg-purple-50 rounded p-2">
                  <p className="text-[10px] font-medium text-purple-900 mb-0.5">
                    Service Notes:
                  </p>
                  <p className="text-xs text-purple-800">{appointment.notes}</p>
                </div>
              )}
              {booking.internal_notes && (
                <div className="bg-yellow-50 rounded p-2">
                  <p className="text-[10px] font-medium text-yellow-900 mb-0.5">
                    Internal Notes:
                  </p>
                  <p className="text-xs text-yellow-800">
                    {booking.internal_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tooltip Arrow */}
          <div className="absolute left-0 top-4 w-0 h-0 -ml-2 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white"></div>
        </div>
      </div>
    </div>
  );
}
