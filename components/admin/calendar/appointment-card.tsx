// components/admin/calendar/appointment-card.tsx
'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { AppointmentDetailsModal } from './appointment-details-modal';
import type { CalendarAppointment, CalendarBooking } from '@/types/calendar';

interface AppointmentCardProps {
  appointment: CalendarAppointment;
  booking: CalendarBooking;
  compact?: boolean;
}

const SERVICE_COLORS: Record<string, string> = {
  'Hair cut': 'bg-orange-200 border-orange-300 text-orange-900',
  'Hair Coloring': 'bg-orange-300 border-orange-400 text-orange-950',
  'Haircut and colour': 'bg-blue-200 border-blue-300 text-blue-900',
  'Blow Dry': 'bg-cyan-200 border-cyan-300 text-cyan-900',
  'Beard Grooming': 'bg-pink-200 border-pink-300 text-pink-900',
  'Balinese Massage': 'bg-cyan-300 border-cyan-400 text-cyan-950',
  'Swedish Massage': 'bg-pink-300 border-pink-400 text-pink-950',
  'Spa Treatment': 'bg-amber-200 border-amber-300 text-amber-900',
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-50 border-green-300 text-green-900',
  cancelled: 'bg-red-50 border-red-300 text-red-900',
  completed: 'bg-gray-50 border-gray-300 text-gray-900',
  no_show: 'bg-yellow-50 border-yellow-300 text-yellow-900',
};

export function AppointmentCard({
  appointment,
  booking,
  compact = false,
}: AppointmentCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Get color based on service name or status
  const colorClass =
    SERVICE_COLORS[appointment.service_name] ||
    STATUS_COLORS[appointment.status] ||
    'bg-purple-100 border-purple-300 text-purple-900';

  const clientName = `${booking.guest_first_name} ${
    booking.guest_last_name || ''
  }`.trim();

  return (
    <>
      <div
        onClick={() => setShowDetails(true)}
        className={`h-full rounded-lg border-2 p-2 cursor-pointer hover:shadow-md transition-shadow ${colorClass}`}
      >
        {compact ? (
          // Compact view for week view
          <div className="flex flex-col h-full">
            <p className="font-semibold text-xs truncate">{clientName}</p>
            <p className="text-xs truncate">{appointment.service_name}</p>
          </div>
        ) : (
          // Full view for day view
          <div className="flex flex-col h-full">
            <p className="font-semibold text-sm truncate">{clientName}</p>
            <p className="text-sm truncate">{appointment.service_name}</p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <Clock className="w-3 h-3" />
              <span>
                {appointment.start_time} - {appointment.end_time}
              </span>
            </div>
            {appointment.status !== 'confirmed' && (
              <div className="mt-1">
                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-white bg-opacity-50">
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
