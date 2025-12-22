// components/public/bookings/booking-summary.tsx
'use client';

import { useState } from 'react';
import {
  Calendar,
  Clock,
  CreditCard,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
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
  onChangeCard: () => void;
  onConfirm: () => void;
  onBack: () => void;
}

// Format time to 12-hour format
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Get card brand icon/display
function getCardBrandDisplay(brand: string): string {
  const brands: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return brands[brand.toLowerCase()] || brand;
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
  const [agreedToPolicy, setAgreedToPolicy] = useState(!cancellationPolicy);

  // Calculate total price
  const totalPrice = bookingData.appointments.reduce(
    (sum, appt) => sum + appt.price,
    0
  );

  // Calculate total duration
  const totalDuration = bookingData.appointments.reduce(
    (sum, appt) => sum + appt.durationMinutes,
    0
  );

  // Handle booking confirmation
  const handleConfirm = async () => {
    if (cancellationPolicy && !agreedToPolicy) {
      setError('Please agree to the cancellation policy to continue');
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
            team_member_id: appt.teamMemberId,
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

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

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

        {/* Services with Stylist Names */}
        <div className="p-4 space-y-3">
          {bookingData.appointments.map((appt, index) => (
            <div
              key={index}
              className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900">{appt.serviceName}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                  {/* Time */}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                  </span>
                  {/* Duration */}
                  <span>{appt.durationMinutes} min</span>
                  {/* Stylist Name - Show assigned stylist */}
                  {appt.teamMemberName &&
                    appt.teamMemberName !== 'Any professional' && (
                      <span className="flex items-center gap-1 text-[#6C5CE7]">
                        <User className="h-3.5 w-3.5" />
                        with {appt.teamMemberName}
                      </span>
                    )}
                </div>
              </div>
              <span className="font-medium text-gray-900 ml-4">
                ${appt.price}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="bg-gray-50 p-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-600">Total</span>
              <span className="text-sm text-gray-500 ml-2">
                ({totalDuration} min)
              </span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              ${totalPrice}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
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
                  Expires {savedCard.exp_month}/{savedCard.exp_year}
                </p>
              </div>
            </div>
            <button
              onClick={onChangeCard}
              className="text-sm text-[#6C5CE7] hover:underline"
            >
              Change
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Your card will only be charged if you cancel within the cancellation
            period or don&apos;t show up for your appointment.
          </p>
        </div>
      )}

      {/* Cancellation Policy */}
      {cancellationPolicy && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
          <h4 className="font-medium text-amber-800 mb-2">
            Cancellation Policy
          </h4>
          <p className="text-sm text-amber-700 mb-3">
            Free cancellation up to {cancellationPolicy.notice_hours} hours
            before your appointment. Late cancellations or no-shows will be
            charged{' '}
            {cancellationPolicy.fee_fixed_amount
              ? `$${cancellationPolicy.fee_fixed_amount}`
              : `${cancellationPolicy.fee_percentage}% of the booking total`}
            .
          </p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToPolicy}
              onChange={(e) => setAgreedToPolicy(e.target.checked)}
              className="mt-1 rounded border-amber-300 text-[#6C5CE7] focus:ring-[#6C5CE7]"
            />
            <span className="text-sm text-amber-800">
              I understand and agree to the cancellation policy
            </span>
          </label>
        </div>
      )}

      {/* Contact Info Summary */}
      <div className="border border-gray-200 rounded-xl p-4">
        <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            {bookingData.guestFirstName} {bookingData.guestLastName}
          </p>
          <p>{bookingData.guestEmail}</p>
          {bookingData.guestPhone && <p>{bookingData.guestPhone}</p>}
        </div>
      </div>

      {/* Confirmation Note */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-green-800">
          <p className="font-medium">Confirmation will be sent to your email</p>
          <p className="mt-1">
            You&apos;ll receive a booking confirmation at{' '}
            {bookingData.guestEmail}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || (!!cancellationPolicy && !agreedToPolicy)}
          className={`
            flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
            ${
              loading || (!!cancellationPolicy && !agreedToPolicy)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#6C5CE7] text-white hover:bg-[#5b4bc4]'
            }
          `}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
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
