// components/admin/calendar/booking-hold-block.tsx
'use client';

import { Cloud } from 'lucide-react';

interface HoldService {
  service_id: string;
  service_name: string;
  duration: number;
  price: number;
}

interface BookingHold {
  id: string;
  venue_id: string;
  team_member_id: string;
  hold_date: string;
  start_time: string;
  end_time: string;
  services: HoldService[];
  created_at: string;
  expires_at: string;
}

interface BookingHoldBlockProps {
  hold: BookingHold;
  topPosition: number;
  height: number;
  onClick?: () => void;
}

export function BookingHoldBlock({
  hold,
  topPosition,
  height,
  onClick,
}: BookingHoldBlockProps) {
  // Format time range (short format without am/pm for compact display)
  const formatTimeShort = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes}`;
  };

  // Format time with am/pm
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes}${ampm}`;
  };

  const timeRange = `${formatTimeShort(hold.start_time)} - ${formatTime(
    hold.end_time
  )}`;

  // Get service names
  const serviceNames = hold.services.map((s) => s.service_name).join(', ');

  return (
    <div
      className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-default transition-all hover:shadow-md pointer-events-auto"
      style={{
        top: `${topPosition}px`,
        height: `${Math.max(height, 40)}px`,
        backgroundColor: '#E0F2FE', // Light blue for holds
        borderLeft: '3px solid #0EA5E9', // Sky blue border
      }}
      onClick={onClick}
    >
      <div className="p-2 h-full flex flex-col">
        {/* Time and icons */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-sky-700 font-medium">{timeRange}</span>
          <div className="flex items-center gap-1">
            <Cloud className="h-4 w-4 text-sky-500" />
          </div>
        </div>

        {/* Online booking indicator */}
        <div className="flex-1 min-h-0">
          <p className="text-xs font-semibold text-sky-800 truncate">
            Online booking in progress
          </p>
          <p className="text-xs text-sky-700 truncate">{serviceNames}</p>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// TOOLTIP VERSION (for hover display)
// =====================================================

interface BookingHoldTooltipProps {
  hold: BookingHold;
  teamMemberName?: string;
}

export function BookingHoldTooltip({
  hold,
  teamMemberName,
}: BookingHoldTooltipProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Calculate time remaining
  const expiresAt = new Date(hold.expires_at);
  const now = new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));
  const remainingSeconds = Math.max(
    0,
    Math.floor((remainingMs % 60000) / 1000)
  );

  const totalPrice = hold.services.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = hold.services.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[280px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center">
          <Cloud className="h-4 w-4 text-sky-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">
            Online Booking in Progress
          </p>
          <p className="text-xs text-gray-500">
            {formatTime(hold.start_time)} - {formatTime(hold.end_time)}
          </p>
        </div>
      </div>

      {/* Services */}
      <div className="space-y-2 mb-3">
        {hold.services.map((service, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-gray-700">{service.service_name}</span>
            <span className="text-gray-500">${service.price}</span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
        <span className="text-gray-600">{totalDuration} mins total</span>
        <span className="font-medium text-gray-900">${totalPrice}</span>
      </div>

      {/* Expiry countdown */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-sky-600">
          <span className="animate-pulse">●</span>
          <span>
            Expires in {remainingMinutes}:
            {remainingSeconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {teamMemberName && (
        <p className="text-xs text-gray-500 mt-2">With: {teamMemberName}</p>
      )}
    </div>
  );
}
