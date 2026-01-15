// components/public/dashboard/dashboard-client.tsx
'use client';

import { useState } from 'react';
import { BookingList } from './booking-list';
import { BookingDetail } from './booking-detail';
import type { DashboardBooking } from '@/app/actions/bookings';

// Stats type (calculated in page.tsx)
export interface DashboardStats {
  upcomingCount: number;
  pastCount: number;
  completedCount: number;
  totalSpent: number;
}

interface DashboardClientProps {
  initialUpcoming: DashboardBooking[];
  initialPast: DashboardBooking[];
  stats: DashboardStats;
}

export function DashboardClient({
  initialUpcoming,
  initialPast,
  stats: initialStats,
}: DashboardClientProps) {
  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [past, setPast] = useState(initialPast);
  const [stats, setStats] = useState(initialStats);
  const [selectedBooking, setSelectedBooking] =
    useState<DashboardBooking | null>(
      // Default to first booking (upcoming first, then past)
      initialUpcoming[0] || initialPast[0] || null
    );

  // Handle booking cancellation - move from upcoming to past
  const handleBookingCancelled = (bookingId: string) => {
    // Find the cancelled booking in upcoming
    const cancelledBooking = upcoming.find((b) => b.id === bookingId);

    if (cancelledBooking) {
      // Update the booking status
      const updatedBooking: DashboardBooking = {
        ...cancelledBooking,
        status: 'cancelled',
      };

      // Remove from upcoming
      setUpcoming((prev) => prev.filter((b) => b.id !== bookingId));

      // Add to past (at the beginning)
      setPast((prev) => [updatedBooking, ...prev]);

      // Update stats
      setStats((prev) => ({
        ...prev,
        upcomingCount: prev.upcomingCount - 1,
        pastCount: prev.pastCount + 1,
      }));

      // Update selected booking if it's the one being cancelled
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(updatedBooking);
      }
    }
  };

  // Handle review submission - update the booking's reviews
  const handleReviewSubmitted = (
    bookingId: string,
    teamMemberId: string,
    reviewId: string,
    rating: number,
    reviewText: string | null
  ) => {
    const newReview = {
      id: reviewId,
      team_member_id: teamMemberId,
      rating,
      review_text: reviewText,
      status: 'published',
      created_at: new Date().toISOString(),
    };

    // Update in past bookings
    setPast((prev) =>
      prev.map((booking) => {
        if (booking.id === bookingId) {
          return {
            ...booking,
            reviews: [...booking.reviews, newReview],
          };
        }
        return booking;
      })
    );

    // Update selected booking if it's the one being reviewed
    if (selectedBooking?.id === bookingId) {
      setSelectedBooking((prev) =>
        prev
          ? {
              ...prev,
              reviews: [...prev.reviews, newReview],
            }
          : null
      );
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Left Panel - Booking List */}
      <div className="w-full md:w-[400px] lg:w-[450px] border-r border-gray-200 bg-white overflow-y-auto">
        <BookingList
          upcoming={upcoming}
          past={past}
          stats={stats}
          selectedBookingId={selectedBooking?.id || null}
          onSelectBooking={(booking) => setSelectedBooking(booking)}
        />
      </div>

      {/* Right Panel - Booking Detail */}
      <div className="hidden md:flex flex-1 overflow-y-auto">
        {selectedBooking ? (
          <BookingDetail
            booking={selectedBooking}
            onReviewSubmitted={handleReviewSubmitted}
            onBookingCancelled={handleBookingCancelled}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p>Select a booking to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
