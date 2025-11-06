// components/admin/calendar/appointment-card.tsx
'use client';

import { Clock, User, DollarSign, Calendar, Mail, Phone } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CalendarAppointment, CalendarBooking } from '@/types/calendar';

interface AppointmentCardProps {
  appointment: CalendarAppointment;
  booking: CalendarBooking;
  compact?: boolean;
  onClick?: () => void;
}

// Default color if no category color is available
const DEFAULT_COLOR = '#4ECDC4';

export function AppointmentCard({
  appointment,
  booking,
  compact = false,
  onClick,
}: AppointmentCardProps) {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState(0); // ✅ NEW: Arrow Y position
  const [showTooltip, setShowTooltip] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Use category color from appointment data, fallback to default
  const backgroundColor = appointment.category_color || DEFAULT_COLOR;

  // Ensure component is mounted (for portal)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Calculate tooltip position when hovering
  useEffect(() => {
    if (showTooltip && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();

      // Calculate position to the right of the card
      const left = rect.right + 8; // 8px gap
      let top = rect.top;

      // Calculate the card's center point
      const cardCenter = rect.top + rect.height / 2;

      // Ensure tooltip doesn't go off the bottom of the screen
      const tooltipHeight = 400; // approximate height
      const windowHeight = window.innerHeight;
      if (top + tooltipHeight > windowHeight) {
        top = windowHeight - tooltipHeight - 20;
      }

      // Ensure tooltip doesn't go off the top
      if (top < 20) {
        top = 20;
      }

      // ✅ NEW: Calculate arrow position relative to tooltip top
      // Arrow should point to the card's center
      const arrowTop = cardCenter - top;

      setTooltipPosition({ top, left });
      setArrowPosition(arrowTop); // ✅ NEW: Set arrow position
    }
  }, [showTooltip]);

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

  // Tooltip content
  const tooltipContent = showTooltip && mounted && (
    <div
      className="fixed w-80 z-[9999] pointer-events-none animate-in fade-in duration-200"
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 relative">
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

        {/* ✅ UPDATED: Dynamic Arrow Position */}
        <div
          className="absolute left-0 w-0 h-0 -ml-2 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white"
          style={{ top: `${arrowPosition}px` }}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Main Appointment Card */}
      <div
        ref={cardRef}
        className="relative group h-full"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className="h-full rounded-md p-2 cursor-pointer transition-all duration-200 overflow-hidden group-hover:w-[97%]"
          style={{ backgroundColor }}
          onClick={onClick}
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
                <p className="text-[10px] truncate">
                  {appointment.service_name}
                </p>
              </div>

              {/* Tablet/Desktop: Time and name on same row, service on next row */}
              <div className="hidden md:flex md:flex-col">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <p className="font-semibold text-[11px] truncate">
                    {timeRange}
                  </p>
                  <p className="font-medium text-[11px] truncate">
                    {clientName}
                  </p>
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
      </div>

      {/* Render tooltip via portal to escape all parent containers */}
      {typeof window !== 'undefined' &&
        tooltipContent &&
        createPortal(tooltipContent, document.body)}
    </>
  );
}
