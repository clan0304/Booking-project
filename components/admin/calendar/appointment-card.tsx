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
  // Interaction mode props
  interactionMode?: 'resize-top' | 'resize-bottom' | 'drag' | null;
  onResizeTopStart?: (appointmentId: string, startY: number) => void;
  onResizeBottomStart?: (appointmentId: string, startY: number) => void;
  // ✅ UPDATED: Now passes cardRect for smooth floating drag
  onDragStart?: (
    appointmentId: string,
    startY: number,
    startX: number,
    cardRect: { top: number; left: number; width: number; height: number }
  ) => void;
  onInteractionMove?: (clientY: number, clientX: number) => void;
  onInteractionEnd?: () => void;

  // Grouped hover props
  isGroupHovered?: boolean;
  onGroupHoverStart?: () => void;
  onGroupHoverEnd?: () => void;

  // ✅ NEW: Hide card when floating clone is shown
  isFloating?: boolean;
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
  isFloating = false,
}: AppointmentCardProps) {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isInteracting = interactionMode !== null;
  const isCompleted = booking.status === 'completed';
  const COMPLETED_COLOR = '#9CA3AF'; // gray-400
  const backgroundColor = isCompleted
    ? COMPLETED_COLOR
    : appointment.category_color || DEFAULT_COLOR;

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

    // ✅ Get card bounding rect for smooth floating drag
    const rect = cardRef.current?.getBoundingClientRect();
    const cardRect = rect
      ? {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }
      : { top: e.clientY, left: e.clientX, width: 180, height: 60 };

    onDragStart?.(appointment.id, e.clientY, e.clientX, cardRect);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInteracting) {
      e.preventDefault();
      // ✅ UPDATED: Pass both Y and X coordinates
      onInteractionMove?.(e.clientY, e.clientX);
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
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor }}
                >
                  {clientName.substring(0, 2).toUpperCase()}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 truncate">
                  {clientName}
                </p>
                {!booking.client_id && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">
                    Walk-in
                  </span>
                )}
              </div>
              {booking.guest_email && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{booking.guest_email}</span>
                </div>
              )}
              {booking.guest_phone && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                  <Phone className="w-3 h-3" />
                  <span>{booking.guest_phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Service Info */}
        <div className="space-y-2.5">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">
                {appointment.service_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {timeRange} ({appointment.duration_minutes}min)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">{teamMemberName}</span>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              ${Number(appointment.price).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Booking Notes */}
        {booking.notes && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 italic">
              &ldquo;{booking.notes}&rdquo;
            </p>
          </div>
        )}

        {/* Booking Status Badge */}
        {booking.status && booking.status !== 'confirmed' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <span
              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                booking.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : booking.status === 'cancelled'
                  ? 'bg-red-100 text-red-800'
                  : booking.status === 'no_show'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {booking.status.charAt(0).toUpperCase() +
                booking.status.slice(1).replace('_', ' ')}
            </span>
          </div>
        )}

        {/* Arrow pointing to card */}
        <div
          className="absolute w-3 h-3 bg-white border-l border-t border-gray-200 transform -rotate-45"
          style={{
            left: '-7px',
            top: `${arrowPosition}px`,
            marginTop: '-6px',
          }}
        />
      </div>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      <div
        ref={cardRef}
        className={`
          h-full rounded-lg relative overflow-hidden cursor-pointer transition-all duration-100
          ${
            isInteracting && !isFloating
              ? 'shadow-lg ring-2 ring-purple-500 opacity-90'
              : 'hover:shadow-md hover:ring-1 hover:ring-purple-400'
          }
          ${
            isGroupHovered && !isHovered
              ? 'shadow-md ring-1 ring-purple-300'
              : ''
          }
          ${isCompleted ? 'border border-gray-300' : ''}
          ${isFloating ? 'opacity-30 pointer-events-none' : ''}
        `}
        style={{
          backgroundColor,
          touchAction: 'none',
        }}
        onMouseEnter={() => {
          if (!isFloating) {
            setIsHovered(true);
            onGroupHoverStart?.();
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          onGroupHoverEnd?.();
        }}
        onPointerDown={handleBodyPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={(e) => {
          // Only trigger onClick if not interacting
          if (!isInteracting && !isFloating) {
            e.stopPropagation();
            onClick?.();
          }
        }}
      >
        {/* Top resize handle */}
        <div
          className="resize-handle absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10 hover:bg-black/10"
          onPointerDown={handleTopPointerDown}
        />

        {/* Content */}
        <div className="h-full flex flex-col p-1.5 overflow-hidden">
          {/* Time */}
          <p className="text-xs text-white/90 truncate leading-tight">
            {startTime}
          </p>

          {/* Client name (bold) or Walk-in */}
          <p className="text-xs font-bold text-white truncate leading-tight mt-0.5">
            {clientName || 'Walk-in'}
          </p>

          {/* Service name */}
          {!compact && (
            <p className="text-xs text-white/80 truncate leading-tight mt-0.5">
              {appointment.service_name}
            </p>
          )}
        </div>

        {/* Bottom resize handle */}
        <div
          className="resize-handle absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10 hover:bg-black/10"
          onPointerDown={handleBottomPointerDown}
        />

        {/* Completed overlay */}
        {isCompleted && (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-500/20 pointer-events-none" />
        )}
      </div>

      {/* Tooltip via portal */}
      {mounted && tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  );
}
