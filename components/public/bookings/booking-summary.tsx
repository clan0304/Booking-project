// components/public/bookings/booking-summary.tsx
'use client';

import { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  DollarSign,
} from 'lucide-react';
import type { Venue, BookingData } from '@/types/bookings';

interface BookingSummaryProps {
  venue: Venue;
  bookingData: BookingData;
  authenticatedUserId: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

export function BookingSummary({
  venue,
  bookingData,
  onConfirm,
  onBack,
}: BookingSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPrice = bookingData.appointments.reduce(
    (sum, appt) => sum + appt.price,
    0
  );

  const totalDuration = bookingData.appointments.reduce(
    (sum, appt) => sum + appt.durationMinutes,
    0
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/public/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_id: bookingData.venueId,
          guest_first_name: bookingData.guestFirstName,
          guest_last_name: bookingData.guestLastName,
          guest_email: bookingData.guestEmail,
          guest_phone: bookingData.guestPhone,
          booking_date: bookingData.bookingDate,
          notes: bookingData.notes,
          appointments: bookingData.appointments.map((appt) => ({
            service_id: appt.serviceId,
            variant_id: appt.variantId,
            team_member_id: appt.teamMemberId,
            start_time: appt.startTime,
            end_time: appt.endTime,
            duration_minutes: appt.durationMinutes,
            service_name: appt.serviceName,
            price: appt.price,
            notes: appt.notes,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create booking');
      }

      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Review Your Booking
        </h2>
        <p className="text-gray-600">
          Please review all details before confirming
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Booking Details */}
        <div className="space-y-6">
          {/* Venue Info */}
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </h3>
            <div className="space-y-1">
              <p className="font-medium text-gray-900">{venue.name}</p>
              <p className="text-sm text-gray-600">{venue.address}</p>
              {venue.phone_number && (
                <p className="text-sm text-gray-600">{venue.phone_number}</p>
              )}
            </div>
          </div>

          {/* Date & Time */}
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date & Time
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium text-gray-900">
                  {formatDate(bookingData.bookingDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Time</p>
                <p className="font-medium text-gray-900">
                  {bookingData.appointments[0]?.startTime || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Duration</p>
                <p className="font-medium text-gray-900">
                  {totalDuration} minutes
                </p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Information
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium text-gray-900">
                  {bookingData.guestFirstName} {bookingData.guestLastName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <p className="text-sm text-gray-900">
                  {bookingData.guestEmail}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <p className="text-sm text-gray-900">
                  {bookingData.guestPhone}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Services */}
        <div className="space-y-6">
          {/* Services List */}
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-4">
              Services ({bookingData.appointments.length})
            </h3>
            <div className="space-y-4">
              {bookingData.appointments.map((appointment, index) => (
                <div
                  key={index}
                  className="border-b border-gray-200 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {appointment.serviceName}
                      </p>
                      <p className="text-sm text-gray-600">
                        with {appointment.teamMemberName}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      ${appointment.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {appointment.startTime} - {appointment.endTime}
                      </span>
                    </div>
                    <span>•</span>
                    <span>{appointment.durationMinutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Price */}
          <div className="border-2 border-[#6C5CE7] rounded-xl p-6 bg-purple-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-[#6C5CE7]" />
                <span className="text-lg font-semibold text-gray-900">
                  Total Price
                </span>
              </div>
              <span className="text-2xl font-bold text-[#6C5CE7]">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Special Requests */}
          {bookingData.notes && (
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-2">
                Special Requests
              </h3>
              <p className="text-sm text-gray-700">{bookingData.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              Processing...
            </>
          ) : (
            'Confirm Booking'
          )}
        </button>
      </div>

      {/* Cancellation Policy */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Cancellation Policy:</strong> You can cancel or reschedule
          this booking up to 48 hours before your appointment time.
        </p>
      </div>
    </div>
  );
}
