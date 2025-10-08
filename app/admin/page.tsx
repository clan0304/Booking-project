// app/admin/page.tsx
import { requireStaff } from '@/lib/auth';

export default async function AdminPage() {
  const { roles } = await requireStaff();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome to the admin panel. You have{' '}
            {roles.includes('admin') ? 'admin' : 'team member'} access.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Stats Card */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">
              Total Clients
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
            <p className="mt-1 text-sm text-gray-600">
              Active clients in system
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">
              Team Members
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
            <p className="mt-1 text-sm text-gray-600">Staff members</p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-semibold text-gray-900">
              Bookings Today
            </h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">0</p>
            <p className="mt-1 text-sm text-gray-600">Scheduled appointments</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <button className="rounded-lg bg-black px-4 py-3 text-white hover:bg-gray-800">
              Add Client
            </button>
            <button className="rounded-lg bg-black px-4 py-3 text-white hover:bg-gray-800">
              Add Team Member
            </button>
            <button className="rounded-lg bg-black px-4 py-3 text-white hover:bg-gray-800">
              View Schedule
            </button>
            <button className="rounded-lg bg-black px-4 py-3 text-white hover:bg-gray-800">
              Reports
            </button>
          </div>
        </div>

        {/* Your Roles */}
        <div className="mt-8 rounded-lg bg-blue-50 p-4">
          <h3 className="font-semibold text-blue-900">Your Roles:</h3>
          <div className="mt-2 flex gap-2">
            {roles.map((role) => (
              <span
                key={role}
                className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
