// app/dashboard/page.tsx
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default async function DashboardPage() {
  const { userId } = await requireAuth();

  // Check if user has completed onboarding
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .single();

  if (user && !user.onboarding_completed) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/profile"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Edit Profile
            </Link>
            {/* Show admin link if user has staff roles */}
            {user?.roles &&
              (user.roles.includes('admin') ||
                user.roles.includes('team_member')) && (
                <Link
                  href="/admin"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Admin Panel
                </Link>
              )}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome, {user?.first_name || 'there'}!
        </h2>
        <p className="mt-2 text-gray-600">Your client dashboard</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">My Bookings</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
            <p className="mt-1 text-sm text-gray-600">Upcoming appointments</p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">
              Booking History
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
            <p className="mt-1 text-sm text-gray-600">Past appointments</p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">
              Loyalty Points
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
            <p className="mt-1 text-sm text-gray-600">Points earned</p>
          </div>
        </div>

        <div className="mt-8">
          <button className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800">
            Book an Appointment
          </button>
        </div>
      </div>
    </div>
  );
}
