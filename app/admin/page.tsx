// app/admin/page.tsx
import { requireStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Calendar, Users, TrendingUp, Clock } from 'lucide-react';
import type { UserRole } from '@/types/database';

export default async function AdminDashboardPage() {
  const { roles } = await requireStaff();

  // Fetch stats
  const { count: totalClients } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .contains('roles', ['client']);

  const { count: totalTeamMembers } = await supabaseAdmin
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const stats = [
    {
      title: 'Total Clients',
      value: totalClients || 0,
      icon: Users,
      color: 'bg-blue-500',
      change: '+12%',
    },
    {
      title: 'Team Members',
      value: totalTeamMembers || 0,
      icon: Users,
      color: 'bg-purple-500',
      change: '+2',
    },
    {
      title: 'Bookings Today',
      value: 0,
      icon: Calendar,
      color: 'bg-green-500',
      change: '+8%',
    },
    {
      title: 'Revenue (Month)',
      value: '$0',
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '+15%',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back! Here&apos;s what&apos;s happening with your salon today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-xl ${stat.color} p-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-semibold text-green-600">
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-600">
                  {stat.title}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <button className="rounded-xl bg-[#6C5CE7] p-6 text-left text-white transition-transform hover:scale-105">
            <Calendar className="h-8 w-8 mb-3" />
            <h3 className="font-semibold text-lg">New Booking</h3>
            <p className="mt-1 text-sm text-purple-100">
              Schedule an appointment
            </p>
          </button>

          <button className="rounded-xl bg-white p-6 text-left border-2 border-gray-200 transition-all hover:border-[#6C5CE7] hover:shadow-md">
            <Users className="h-8 w-8 mb-3 text-[#6C5CE7]" />
            <h3 className="font-semibold text-lg text-gray-900">Add Client</h3>
            <p className="mt-1 text-sm text-gray-600">Register new client</p>
          </button>

          <button className="rounded-xl bg-white p-6 text-left border-2 border-gray-200 transition-all hover:border-[#6C5CE7] hover:shadow-md">
            <Clock className="h-8 w-8 mb-3 text-[#6C5CE7]" />
            <h3 className="font-semibold text-lg text-gray-900">
              View Schedule
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Check today&apos;s calendar
            </p>
          </button>
        </div>
      </div>

      {/* User Roles Info */}
      <div className="mt-8 rounded-xl bg-blue-50 p-6 border border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-2">Your Access Level</h3>
        <div className="flex flex-wrap gap-2">
          {roles.map((role: UserRole) => (
            <span
              key={role}
              className="rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-800"
            >
              {role}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-blue-700">
          ℹ️ Roles are checked from database in real-time. Changes take effect
          immediately!
        </p>
      </div>
    </div>
  );
}
