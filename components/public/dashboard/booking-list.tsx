// components/public/dashboard/booking-list.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import type { DashboardBooking } from '@/app/actions/bookings';
import type { DashboardStats } from './dashboard-client';
import { cn } from '@/lib/utils';

interface BookingListProps {
  upcoming: DashboardBooking[];
  past: DashboardBooking[];
  stats: DashboardStats;
  selectedBookingId: string | null;
  onSelectBooking: (booking: DashboardBooking) => void;
}

// Format date: "Wed, 16 July 2025"
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Format time: "5:30 pm"
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Format price
function formatPrice(price: number | null, hasFromPrice?: boolean): string {
  if (price === null || price === undefined) return '';
  const formatted = `$${price.toFixed(0)}`;
  return hasFromPrice ? `from ${formatted}` : formatted;
}

interface BookingCardProps {
  booking: DashboardBooking;
  isSelected: boolean;
  onClick: () => void;
}

function BookingCard({ booking, isSelected, onClick }: BookingCardProps) {
  const firstAppointment = booking.appointments[0];
  const startTime = firstAppointment?.start_time || '00:00';
  const itemCount = booking.total_appointments || booking.appointments.length;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex gap-3 p-3 rounded-lg text-left transition-colors',
        isSelected
          ? 'bg-purple-50 border-2 border-purple-500'
          : 'hover:bg-gray-50 border-2 border-transparent'
      )}
    >
      {/* Venue Image */}
      <div className="relative w-28 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {booking.venue?.photo_url ? (
          <Image
            src={booking.venue.photo_url}
            alt={booking.venue.name || 'Venue'}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
            <span className="text-2xl font-bold text-purple-300">
              {booking.venue?.name?.charAt(0) || 'V'}
            </span>
          </div>
        )}
      </div>

      {/* Booking Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">
          {booking.venue?.name || 'Unknown Venue'}
        </h3>
        <p className="text-sm text-gray-600 mt-0.5">
          {formatDate(booking.booking_date)} at {formatTime(startTime)}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">
          {booking.total_price !== null && booking.total_price > 0 && (
            <span>{formatPrice(booking.total_price)} · </span>
          )}
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>

        {/* Book Again Link */}
        {booking.venue?.slug && (
          <Link
            href={`/${booking.venue.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-block mt-2 text-sm font-medium text-green-600 hover:text-green-700"
          >
            Book again
          </Link>
        )}
      </div>
    </button>
  );
}

export function BookingList({
  upcoming,
  past,
  stats,
  selectedBookingId,
  onSelectBooking,
}: BookingListProps) {
  return (
    <div className="p-4">
      {/* Upcoming Section */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming</h2>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-sm rounded-full">
              {stats.upcomingCount}
            </span>
          </div>
          <div className="space-y-2">
            {upcoming.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isSelected={selectedBookingId === booking.id}
                onClick={() => onSelectBooking(booking)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Past</h2>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-sm rounded-full">
            {stats.pastCount}
          </span>
        </div>

        {past.length > 0 ? (
          <div className="space-y-2">
            {past.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isSelected={selectedBookingId === booking.id}
                onClick={() => onSelectBooking(booking)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No past bookings</p>
          </div>
        )}
      </div>

      {/* Empty State */}
      {upcoming.length === 0 && past.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No bookings yet
          </h3>
          <p className="text-gray-600 mb-4">
            Book your first appointment to get started
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Book Now
          </Link>
        </div>
      )}
    </div>
  );
}
