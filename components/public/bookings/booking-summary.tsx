// components/public/bookings/booking-summary.tsx
'use client';

import { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  CreditCard,
  Shield,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import type { Venue, BookingData } from '@/types/bookings';

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

interface CancellationPolicy {
  id: string;
  notice_hours: number;
  fee_percentage: number;
  fee_fixed_amount: number | null;
}

interface BookingSummaryProps {
  venue: Venue;
  bookingData: BookingData;
  authenticatedUserId: string;
  savedCard: SavedCard | null;
  cancellationPolicy: CancellationPolicy | null;
  onChangeCard?: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function BookingSummary({
  venue,
  bookingData,
  authenticatedUserId,
  savedCard,
  cancellationPolicy,
  onChangeCard,
  onConfirm,
  onBack,
}: BookingSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);

  const totalPrice = bookingData.appointments.reduce(
    (sum, appt) => sum + appt.price,
    0
  );

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Get card brand display name
  const getCardBrandDisplay = (brand: string) => {
    const brandMap: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
    };
    return brandMap[brand.toLowerCase()] || brand;
  };

  // Calculate cancellation fee
  const getCancellationFee = () => {
    if (!cancellationPolicy) return null;
    if (cancellationPolicy.fee_fixed_amount) {
      return `A$${cancellationPolicy.fee_fixed_amount.toFixed(2)}`;
    }
    if (cancellationPolicy.fee_percentage > 0) {
      const fee = (totalPrice * cancellationPolicy.fee_percentage) / 100;
      return `A$${fee.toFixed(2)} (${cancellationPolicy.fee_percentage}%)`;
    }
    return null;
  };

  const handleConfirm = async () => {
    if (cancellationPolicy && !agreedToPolicy) {
      setError('Please agree to the cancellation policy to continue.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create the booking
      const response = await fetch('/api/public/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venue.id,
          booking_date: bookingData.bookingDate,
          guest_first_name: bookingData.guestFirstName,
          guest_last_name: bookingData.guestLastName,
          guest_email: bookingData.guestEmail,
          guest_phone: bookingData.guestPhone,
          notes: bookingData.notes,
          client_id: authenticatedUserId,
          payment_method_id: savedCard?.id || bookingData.paymentMethodId,
          appointments: bookingData.appointments.map((appt) => ({
            service_id: appt.serviceId,
            service_name: appt.serviceName,
            team_member_id:
              appt.teamMemberId === 'any' ? null : appt.teamMemberId,
            start_time: appt.startTime,
            end_time: appt.endTime,
            duration_minutes: appt.durationMinutes,
            price: appt.price,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create booking');
      }

      onConfirm();
    } catch (err) {
      console.error('Booking error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Review & Confirm
        </h2>
        <p className="text-gray-600">Please review your booking details</p>
      </div>

      {/* Booking Details Card */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Venue & Date */}
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{venue.name}</h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(bookingData.bookingDate)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatTime(bookingData.appointments[0]?.startTime || '00:00')}
            </span>
          </div>
        </div>

        {/* Services */}
        <div className="p-4 space-y-3">
          {bookingData.appointments.map((appt, index) => (
            <div
              key={index}
              className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div>
                <p className="font-medium text-gray-900">{appt.serviceName}</p>
                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {appt.teamMemberName || 'Any professional'}
                  </span>
                  <span>{appt.durationMinutes} min</span>
                </div>
              </div>
              <span className="font-medium text-gray-900">
                A${appt.price.toFixed(2)}
              </span>
            </div>
          ))}

          {/* Total */}
          <div className="flex justify-between pt-3 border-t border-gray-200">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-semibold text-gray-900">
              A${totalPrice.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Saved Card Display */}
      {savedCard && (
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {getCardBrandDisplay(savedCard.brand)} •••• {savedCard.last4}
                </p>
                <p className="text-sm text-gray-500">
                  Expires {savedCard.exp_month.toString().padStart(2, '0')}/
                  {savedCard.exp_year}
                </p>
              </div>
            </div>
            {onChangeCard && (
              <button
                type="button"
                onClick={onChangeCard}
                className="flex items-center gap-1 text-sm text-[#6C5CE7] hover:text-[#5b4bc4] font-medium"
              >
                <Pencil className="h-4 w-4" />
                Change
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
            <Shield className="h-4 w-4 text-green-600" />
            <span>Your card won&apos;t be charged today</span>
          </div>
        </div>
      )}

      {/* No Card Warning */}
      {!savedCard && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">No payment method</p>
              <p className="text-sm text-amber-700 mt-1">
                Please go back and add a payment method to secure your booking.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Policy */}
      {cancellationPolicy && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Cancellation Policy</p>
              <p className="text-sm text-gray-600 mt-1">
                Cancel at least {cancellationPolicy.notice_hours} hours before
                your appointment to avoid a {getCancellationFee()} fee.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToPolicy}
              onChange={(e) => setAgreedToPolicy(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#6C5CE7] focus:ring-[#6C5CE7]"
            />
            <span className="text-sm text-gray-700">
              I understand and agree to the cancellation policy. I authorize the
              salon to charge my saved card if I cancel late or don&apos;t show
              up.
            </span>
          </label>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={
            loading || !savedCard || (!!cancellationPolicy && !agreedToPolicy)
          }
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Confirming...
            </>
          ) : (
            'Confirm Booking'
          )}
        </button>
      </div>
    </div>
  );
}
