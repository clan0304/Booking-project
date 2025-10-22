// components/public/bookings/booking-summary.tsx
'use client';

import { useState } from 'react';
import { Calendar, Clock, MapPin, User, Mail, Phone } from 'lucide-react';
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
  authenticatedUserId, // ✅ Now using this prop
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
          client_id: authenticatedUserId, // ✅ FIXED: Include client_id if user is authenticated
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
          Please review your appointment details before confirming
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Venue Information */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-gray-700">
          <MapPin className="h-5 w-5" />
          <div>
            <p className="font-medium">{venue.name}</p>
            <p className="text-sm text-gray-600">{venue.address}</p>
          </div>
        </div>
      </div>

      {/* Appointment Details */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Appointments</h3>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-700 mb-4">
            <Calendar className="h-5 w-5" />
            <p className="font-medium">{formatDate(bookingData.bookingDate)}</p>
          </div>

          <div className="space-y-3">
            {bookingData.appointments.map((appt, index) => (
              <div
                key={index}
                className="flex justify-between items-start pb-3 border-b border-gray-200 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">
                    {appt.serviceName}
                  </p>
                  <p className="text-sm text-gray-600">
                    with {appt.teamMemberName}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {appt.startTime} - {appt.endTime}
                    </span>
                    <span>({appt.durationMinutes} min)</span>
                  </div>
                </div>
                <p className="font-medium text-gray-900">${appt.price}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-300 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Total time: {totalDuration} minutes
            </div>
            <div className="text-lg font-bold text-gray-900">
              Total: ${totalPrice}
            </div>
          </div>
        </div>
      </div>

      {/* Guest Information */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Your Information</h3>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-gray-700">
            <User className="h-5 w-5" />
            <p>
              {bookingData.guestFirstName} {bookingData.guestLastName}
            </p>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <Mail className="h-5 w-5" />
            <p>{bookingData.guestEmail}</p>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <Phone className="h-5 w-5" />
            <p>{bookingData.guestPhone}</p>
          </div>
        </div>
      </div>

      {/* Notes */}
      {bookingData.notes && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900">Additional Notes</h3>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-gray-700">{bookingData.notes}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Confirming...' : 'Confirm Booking'}
        </button>
      </div>

      {/* Terms */}
      <p className="text-xs text-gray-500 text-center">
        By confirming, you agree to our terms and cancellation policies
      </p>
    </div>
  );
}
