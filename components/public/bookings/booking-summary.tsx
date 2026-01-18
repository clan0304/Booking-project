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
  FileText,
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
  onNotesChange?: (notes: string) => void;
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
  onNotesChange,
}: BookingSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToPolicy, setAgreedToPolicy] = useState(!cancellationPolicy);
  const [notes, setNotes] = useState(bookingData.notes || '');

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

  // Handle notes change
  const handleNotesChange = (value: string) => {
    setNotes(value);
    onNotesChange?.(value);
  };

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
          notes: notes.trim() || null,
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
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Review & Confirm</h2>
        <p className="text-gray-600 mt-1">
          Please review your booking details before confirming
        </p>
      </div>

      {/* Booking Details Card */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        {/* Venue */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-purple-600 font-semibold">
              {venue.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{venue.name}</h3>
            <p className="text-sm text-gray-600">{venue.address}</p>
          </div>
        </div>

        {/* Date & Time */}
        <div className="flex items-center gap-3 text-gray-700">
          <Calendar className="w-5 h-5 text-gray-400" />
          <span>{formatDate(bookingData.bookingDate)}</span>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-3 text-gray-700">
          <Clock className="w-5 h-5 text-gray-400" />
          <span>
            {formatTime(bookingData.appointments[0]?.startTime || '09:00')} •{' '}
            {totalDuration} min
          </span>
        </div>
      </div>

      {/* Services List */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Services</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {bookingData.appointments.map((appt, index) => (
            <div key={index} className="p-4 flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-900">{appt.serviceName}</p>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{appt.teamMemberName}</span>
                  <span className="text-gray-300">•</span>
                  <span>{appt.durationMinutes} min</span>
                </div>
              </div>
              <p className="font-semibold text-gray-900">
                ${appt.price.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
        {/* Total */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="text-lg font-bold text-gray-900">
            ${totalPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Notes Section */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900">
            Special Requests{' '}
            <span className="font-normal text-gray-500">(Optional)</span>
          </h3>
        </div>
        <div className="p-4">
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Let us know if you have any special requests or notes for your appointment..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1.5 text-right">
            {notes.length}/500
          </p>
        </div>
      </div>

      {/* Payment Method (if has saved card) */}
      {savedCard && (
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-gray-600" />
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
              className="text-purple-600 text-sm font-medium hover:text-purple-700"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Cancellation Policy Agreement */}
      {cancellationPolicy && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-900">
                Cancellation Policy
              </h4>
              <p className="text-sm text-amber-800 mt-1">
                Cancellations made less than {cancellationPolicy.notice_hours}{' '}
                hours before the appointment will incur a{' '}
                {cancellationPolicy.fee_percentage}% fee
                {cancellationPolicy.fee_fixed_amount
                  ? ` (min $${cancellationPolicy.fee_fixed_amount})`
                  : ''}
                .
              </p>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToPolicy}
                  onChange={(e) => setAgreedToPolicy(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-amber-900">
                  I understand and agree to the cancellation policy
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span>Your payment information is securely stored</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading || (!!cancellationPolicy && !agreedToPolicy)}
          className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
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
