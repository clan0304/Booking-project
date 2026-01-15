// components/public/dashboard/booking-detail.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Calendar,
  ShoppingBag,
  MapPin,
  Phone,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from 'lucide-react';
import type { DashboardBooking } from '@/app/actions/bookings';
import { cancelMyBooking } from '@/app/actions/bookings';
import { ReviewSection } from './review-section';
import { cn } from '@/lib/utils';

// Local type for appointments (extracted from DashboardBooking)
type DashboardAppointment = DashboardBooking['appointments'][number];

interface BookingDetailProps {
  booking: DashboardBooking;
  onReviewSubmitted: (
    bookingId: string,
    teamMemberId: string,
    reviewId: string,
    rating: number,
    reviewText: string | null
  ) => void;
  onBookingCancelled: (bookingId: string) => void;
  onClose?: () => void; // For mobile slide-over
  isMobile?: boolean;
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

// Calculate total duration
function getTotalDuration(appointments: DashboardAppointment[]): number {
  return appointments.reduce((sum, apt) => sum + apt.duration_minutes, 0);
}

// Normalize status for display (fully_cancelled & partially_cancelled -> cancelled)
function normalizeStatus(status: string): string {
  if (status === 'fully_cancelled' || status === 'partially_cancelled') {
    return 'cancelled';
  }
  return status;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = normalizeStatus(status);

  const config: Record<
    string,
    { icon: typeof CheckCircle; color: string; label: string }
  > = {
    completed: {
      icon: CheckCircle,
      color: 'bg-green-100 text-green-700',
      label: 'Completed',
    },
    confirmed: {
      icon: Clock,
      color: 'bg-blue-100 text-blue-700',
      label: 'Confirmed',
    },
    cancelled: {
      icon: XCircle,
      color: 'bg-gray-100 text-gray-600',
      label: 'Cancelled',
    },
    no_show: {
      icon: AlertCircle,
      color: 'bg-red-100 text-red-700',
      label: 'No Show',
    },
  };

  const {
    icon: Icon,
    color,
    label,
  } = config[normalizedStatus] || config.confirmed;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
        color
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </span>
  );
}

// Inner content component (shared between desktop and mobile)
function BookingDetailContent({
  booking,
  onReviewSubmitted,
  onBookingCancelled,
  onClose,
  isMobile,
}: BookingDetailProps) {
  const [showServices, setShowServices] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const firstAppointment = booking.appointments[0];
  const startTime = firstAppointment?.start_time || '00:00';
  const totalDuration = getTotalDuration(booking.appointments);
  const canReview = booking.status === 'completed';

  // Check if booking can be cancelled (confirmed + 48h+ away)
  const today = new Date().toISOString().split('T')[0];
  const canCancel =
    booking.status === 'confirmed' && booking.booking_date >= today;

  // Handle cancel booking
  const handleCancelBooking = async () => {
    setIsCancelling(true);
    setCancelError(null);

    try {
      const result = await cancelMyBooking(booking.id);

      if (result.success) {
        setShowCancelConfirm(false);
        onBookingCancelled(booking.id);
      } else {
        setCancelError(result.error || 'Failed to cancel booking');
      }
    } catch {
      setCancelError('An error occurred. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Get unique team members for review
  const uniqueTeamMembers = new Map<
    string,
    DashboardAppointment['team_member'] & { services: string[] }
  >();
  booking.appointments.forEach((apt) => {
    if (apt.team_member) {
      if (uniqueTeamMembers.has(apt.team_member_id)) {
        const existing = uniqueTeamMembers.get(apt.team_member_id)!;
        existing.services.push(apt.service_name);
      } else {
        uniqueTeamMembers.set(apt.team_member_id, {
          ...apt.team_member,
          services: [apt.service_name],
        });
      }
    }
  });

  return (
    <div className="flex-1 bg-white">
      {/* Header with Venue Image */}
      <div className="relative h-48 bg-gray-900">
        {booking.venue?.photo_url ? (
          <Image
            src={booking.venue.photo_url}
            alt={booking.venue.name || 'Venue'}
            fill
            className="object-cover opacity-80"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Mobile Close Button */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h1 className="text-2xl font-bold text-white">
            {booking.venue?.name || 'Unknown Venue'}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-2xl">
        {/* Status Badge */}
        <div className="mb-4">
          <StatusBadge status={booking.status} />
        </div>

        {/* Date & Time */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            {formatDate(booking.booking_date)} at {formatTime(startTime)}
          </h2>
          <p className="text-gray-600 mt-1">{totalDuration} minutes duration</p>
        </div>

        {/* Review Section - Only for completed bookings with unreviewed stylists */}
        {canReview && (
          <ReviewSection
            bookingId={booking.id}
            venueName={booking.venue?.name || 'this salon'}
            venuePhotoUrl={booking.venue?.photo_url || null}
            teamMembers={Array.from(uniqueTeamMembers.entries()).map(
              ([id, tm]) => ({
                id,
                first_name: tm.first_name,
                last_name: tm.last_name,
                photo_url: tm.photo_url,
                services: tm.services,
              })
            )}
            existingReviews={booking.reviews}
            onReviewSubmitted={onReviewSubmitted}
          />
        )}

        {/* Services */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
          <button
            onClick={() => setShowServices(!showServices)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Services</h3>
                <p className="text-sm text-gray-500">
                  {booking.appointments.length}{' '}
                  {booking.appointments.length === 1 ? 'service' : 'services'}
                </p>
              </div>
            </div>
            {showServices ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showServices && (
            <div className="border-t border-gray-200 divide-y divide-gray-100">
              {booking.appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 flex items-start justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {apt.service_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {apt.duration_minutes} min
                      {apt.team_member && (
                        <span>
                          {' '}
                          · with {apt.team_member.first_name}{' '}
                          {apt.team_member.last_name?.charAt(0) || ''}.
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="font-medium text-gray-900">${apt.price}</p>
                </div>
              ))}
              {/* Total */}
              <div className="p-4 flex items-center justify-between bg-gray-50">
                <p className="font-semibold text-gray-900">Total</p>
                <p className="font-semibold text-gray-900">
                  ${booking.total_price}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Book Again */}
        {booking.venue?.slug && (
          <Link
            href={`/${booking.venue.slug}`}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors mb-4"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Book again</h3>
              <p className="text-sm text-gray-500">
                Book your next appointment
              </p>
            </div>
          </Link>
        )}

        {/* Venue Details */}
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Venue details</h3>
              <p className="text-sm text-gray-500">{booking.venue?.name}</p>
            </div>
          </div>

          {booking.venue?.address && (
            <p className="text-sm text-gray-600 mb-2 pl-[52px]">
              {booking.venue.address}
            </p>
          )}

          {booking.venue?.phone_number && (
            <div className="flex items-center gap-2 text-sm text-gray-600 pl-[52px]">
              <Phone className="w-4 h-4" />
              {booking.venue.phone_number}
            </div>
          )}
        </div>

        {/* Cancel Booking - Only for confirmed upcoming bookings */}
        {canCancel && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="w-full mt-4 flex items-center justify-center gap-2 p-4 border border-red-200 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="font-medium">Cancel Booking</span>
          </button>
        )}

        {/* Bottom padding for mobile */}
        {isMobile && <div className="h-8" />}
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Cancel Booking?
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this booking? This action cannot
              be undone.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Note: Bookings can only be cancelled 48+ hours before the
              appointment time.
            </p>

            {cancelError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {cancelError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  setCancelError(null);
                }}
                disabled={isCancelling}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main export - handles both desktop and mobile views
export function BookingDetail(props: BookingDetailProps) {
  return <BookingDetailContent {...props} />;
}

// Mobile slide-over wrapper
interface MobileBookingDetailProps extends BookingDetailProps {
  isOpen: boolean;
}

export function MobileBookingDetail({
  isOpen,
  onClose,
  ...props
}: MobileBookingDetailProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full bg-white md:hidden',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="h-full overflow-y-auto">
          <BookingDetailContent {...props} onClose={onClose} isMobile />
        </div>
      </div>
    </>
  );
}
