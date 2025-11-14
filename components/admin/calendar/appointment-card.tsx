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
  // NEW: Interaction mode props
  interactionMode?: 'resize-top' | 'resize-bottom' | 'drag' | null;
  onResizeTopStart?: (appointmentId: string, startY: number) => void;
  onResizeBottomStart?: (appointmentId: string, startY: number) => void;
  onDragStart?: (appointmentId: string, startY: number) => void;
  onInteractionMove?: (clientY: number) => void;
  onInteractionEnd?: () => void;

  // NEW: Grouped hover props
  isGroupHovered?: boolean;
  onGroupHoverStart?: () => void;
  onGroupHoverEnd?: () => void;
}

// Default color if no category color is available
const DEFAULT_COLOR = '#4ECDC4';

export function AppointmentCard({
  appointment,
  booking,
  compact = false,
  onClick,
  interactionMode = null,
  onResizeTopStart,
  onResizeBottomStart,
  onDragStart,
  onInteractionMove,
  onInteractionEnd,
  isGroupHovered = false,
  onGroupHoverStart,
  onGroupHoverEnd,
}: AppointmentCardProps) {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isInteracting = interactionMode !== null;
  const backgroundColor = appointment.category_color || DEFAULT_COLOR;

  // Ensure component is mounted (for portal)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Calculate tooltip position when hovering
  useEffect(() => {
    if (isHovered && cardRef.current && !isInteracting) {
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

      // Calculate arrow position relative to tooltip top
      const arrowTop = cardCenter - top;

      setTooltipPosition({ top, left });
      setArrowPosition(arrowTop);
    }
  }, [isHovered, isInteracting]);

  // Format time to HH:mm (remove seconds)
  const formatTime = (time: string): string => {
    if (time.length === 5 && time.includes(':')) {
      return time;
    }
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
    : 'Team Member';

  // ============================================
  // POINTER EVENT HANDLERS
  // ============================================

  const handleTopPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    onResizeTopStart?.(appointment.id, e.clientY);
  };

  const handleBottomPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    onResizeBottomStart?.(appointment.id, e.clientY);
  };

  const handleBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag if clicking on the body, not the resize handles
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }

    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    onDragStart?.(appointment.id, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInteracting) {
      e.preventDefault();
      onInteractionMove?.(e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    onInteractionEnd?.();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    onInteractionEnd?.();
  };

  // ============================================
  // TOOLTIP CONTENT
  // ============================================

  const tooltipContent = mounted && isHovered && !isInteracting && (
    <div
      className="fixed z-[200] pointer-events-none"
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-80 p-4 pointer-events-auto animate-in fade-in duration-200">
        {/* Client Section */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {booking.client_id ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                  {clientName.substring(0, 2).toUpperCase()}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-semibold">
                  WI
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm text-gray-900 truncate">
                  {clientName}
                </h3>
                {!booking.client_id && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                    Walk-in
                  </span>
                )}
              </div>
              {(booking.guest_email || booking.guest_phone) && (
                <div className="space-y-0.5">
                  {booking.guest_email && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{booking.guest_email}</span>
                    </div>
                  )}
                  {booking.guest_phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span>{booking.guest_phone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
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

        {/* Arrow */}
        <div
          className="absolute left-0 w-0 h-0 -ml-2 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-white"
          style={{ top: `${arrowPosition}px` }}
        />
      </div>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Main Appointment Card */}
      <div
        ref={cardRef}
        className="relative group h-full"
        onMouseEnter={() => {
          if (!isInteracting) {
            setIsHovered(true);
            onGroupHoverStart?.();
          }
        }}
        onMouseLeave={() => {
          if (!isInteracting) {
            setIsHovered(false);
            onGroupHoverEnd?.();
          }
        }}
      >
        {/* TOP RESIZE HANDLE */}
        <div
          className={`
            resize-handle
            absolute top-0 left-0 right-0 h-3
            cursor-ns-resize z-20
            flex items-center justify-center
            transition-colors touch-none
            ${
              isHovered && !isInteracting
                ? 'bg-purple-600/20'
                : 'bg-transparent'
            }
            ${interactionMode === 'resize-top' ? 'bg-purple-600/30' : ''}
          `}
          onPointerDown={handleTopPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {isHovered && !isInteracting && (
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-purple-600" />
              <div className="w-1 h-1 rounded-full bg-purple-600" />
              <div className="w-1 h-1 rounded-full bg-purple-600" />
            </div>
          )}
        </div>

        {/* MAIN APPOINTMENT CARD BODY (DRAGGABLE) */}
        <div
          className={`
    h-full rounded-md p-2 transition-all duration-200 overflow-hidden
    ${
      isInteracting
        ? 'border-2 border-purple-600 shadow-lg cursor-grabbing'
        : 'hover:shadow-md cursor-grab group-hover:w-[97%]'
    }
    ${
      isGroupHovered && !isInteracting
        ? 'ring-2 ring-purple-400 ring-offset-1'
        : ''
    }
  `}
          style={{ backgroundColor }}
          onPointerDown={handleBodyPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClick={() => {
            if (!isInteracting) {
              onClick?.();
            }
          }}
        >
          {compact ? (
            // Compact view for week view
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
            // Full view for day view
            <div className="flex flex-col text-white leading-tight">
              {/* Mobile: Stack everything */}
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

              {/* Tablet/Desktop: Time and name on same row */}
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
              {!isInteracting && appointment.status !== 'confirmed' && (
                <div className="mt-1">
                  <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-white/30 truncate">
                    {appointment.status}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM RESIZE HANDLE */}
        <div
          className={`
            resize-handle
            absolute bottom-0 left-0 right-0 h-3
            cursor-ns-resize z-20
            flex items-center justify-center
            transition-colors touch-none
            ${
              isHovered && !isInteracting
                ? 'bg-purple-600/20'
                : 'bg-transparent'
            }
            ${interactionMode === 'resize-bottom' ? 'bg-purple-600/30' : ''}
          `}
          onPointerDown={handleBottomPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {isHovered && !isInteracting && (
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-purple-600" />
              <div className="w-1 h-1 rounded-full bg-purple-600" />
              <div className="w-1 h-1 rounded-full bg-purple-600" />
            </div>
          )}
        </div>

        {/* Active interaction indicators */}
        {interactionMode === 'resize-top' && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600 rounded-t-md" />
        )}
        {interactionMode === 'resize-bottom' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600 rounded-b-md" />
        )}
        {interactionMode === 'drag' && (
          <div className="absolute inset-0 border-2 border-purple-600 rounded-md pointer-events-none" />
        )}
      </div>

      {/* Render tooltip via portal */}
      {typeof window !== 'undefined' &&
        tooltipContent &&
        createPortal(tooltipContent, document.body)}
    </>
  );
}
