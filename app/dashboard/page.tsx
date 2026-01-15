// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { PublicLayout } from '@/components/public';
import { DashboardClient } from '@/components/public/dashboard';
import { getMyBookings, type DashboardBooking } from '@/app/actions/bookings';

// Split bookings into upcoming and past
// Upcoming: confirmed + booking_date >= today
// Past: completed, cancelled, no_show, OR confirmed with past date
function splitBookings(bookings: DashboardBooking[]) {
  const today = new Date().toISOString().split('T')[0];
  const upcoming: DashboardBooking[] = [];
  const past: DashboardBooking[] = [];

  bookings.forEach((booking) => {
    if (booking.status === 'confirmed' && booking.booking_date >= today) {
      upcoming.push(booking);
    } else {
      past.push(booking);
    }
  });

  // Sort upcoming by date ascending (nearest first)
  upcoming.sort((a, b) => {
    const dateCompare = a.booking_date.localeCompare(b.booking_date);
    if (dateCompare !== 0) return dateCompare;
    const aTime = a.appointments[0]?.start_time || '00:00';
    const bTime = b.appointments[0]?.start_time || '00:00';
    return aTime.localeCompare(bTime);
  });

  // Past is already sorted by date descending from the query

  return { upcoming, past };
}

// Calculate stats from bookings
function calculateStats(
  upcoming: DashboardBooking[],
  past: DashboardBooking[]
) {
  return {
    upcomingCount: upcoming.length,
    pastCount: past.length,
    completedCount: past.filter((b) => b.status === 'completed').length,
    totalSpent: past
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price || 0), 0),
  };
}

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Fetch bookings using existing getMyBookings
  const result = await getMyBookings();

  // Handle error state
  if (!result.success || !result.data) {
    return (
      <PublicLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to load bookings
            </h3>
            <p className="text-gray-600 mb-6">
              Please try again later or book a new appointment.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Calendar className="w-5 h-5" />
              Book Now
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Split bookings and calculate stats
  const { upcoming, past } = splitBookings(result.data);
  const stats = calculateStats(upcoming, past);

  // Empty state - no bookings at all
  if (upcoming.length === 0 && past.length === 0) {
    return (
      <PublicLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {user.firstName || 'there'}!
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your bookings and account settings
            </p>
          </div>

          {/* Empty State */}
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No bookings yet
            </h3>
            <p className="text-gray-600 mb-6">
              You don&apos;t have any appointments scheduled yet.
              <br />
              Book your first appointment to get started!
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Calendar className="w-5 h-5" />
              Book Now
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Has bookings - show full dashboard
  return (
    <PublicLayout>
      <DashboardClient
        initialUpcoming={upcoming}
        initialPast={past}
        stats={stats}
      />
    </PublicLayout>
  );
}
