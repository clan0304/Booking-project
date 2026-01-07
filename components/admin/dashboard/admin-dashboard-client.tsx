// components/admin/dashboard/admin-dashboard-client.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, MoreVertical } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getRecentSales,
  getUpcomingAppointments,
  getTopServices,
  getTopTeamMembers,
  type RecentSalesResult,
  type UpcomingAppointmentsResult,
  type TopServiceData,
  type TopTeamMemberData,
} from '@/app/actions/admin-dashboard';

// =====================================================
// HELPERS
// =====================================================

function formatCurrency(amount: number): string {
  return `A$ ${amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// =====================================================
// COMPONENT
// =====================================================

export function AdminDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [recentSales, setRecentSales] = useState<RecentSalesResult | null>(
    null
  );
  const [upcomingAppointments, setUpcomingAppointments] =
    useState<UpcomingAppointmentsResult | null>(null);
  const [topServices, setTopServices] = useState<TopServiceData[]>([]);
  const [topTeamMembers, setTopTeamMembers] = useState<TopTeamMemberData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [salesResult, appointmentsResult, servicesResult, teamResult] =
        await Promise.all([
          getRecentSales(),
          getUpcomingAppointments(),
          getTopServices(),
          getTopTeamMembers(),
        ]);

      if (salesResult.success && salesResult.data) {
        setRecentSales(salesResult.data);
      }
      if (appointmentsResult.success && appointmentsResult.data) {
        setUpcomingAppointments(appointmentsResult.data);
      }
      if (servicesResult.success && servicesResult.data) {
        setTopServices(servicesResult.data);
      }
      if (teamResult.success && teamResult.data) {
        setTopTeamMembers(teamResult.data);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Top Row - Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <Card className="rounded-2xl border border-gray-200">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-xl font-semibold">
                Recent sales
              </CardTitle>
              <p className="text-sm text-gray-500">
                All locations, Last 7 days
              </p>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
          </CardHeader>
          <CardContent>
            {recentSales ? (
              <>
                <div className="mb-4">
                  <p className="text-4xl font-bold">
                    {formatCurrency(recentSales.totalSales)}
                  </p>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>
                      Appointments{' '}
                      <span className="font-semibold">
                        {recentSales.totalAppointments}
                      </span>
                    </p>
                    <p>
                      Appointments value{' '}
                      <span className="font-semibold">
                        {formatCurrency(recentSales.appointmentsValue)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={recentSales.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="dayLabel"
                        tick={{ fontSize: 12 }}
                        axisLine={{ stroke: '#e0e0e0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        axisLine={{ stroke: '#e0e0e0' }}
                        tickFormatter={(value) =>
                          `A$ ${value.toLocaleString()}`
                        }
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          name === 'sales'
                            ? formatCurrency(Number(value) || 0)
                            : value,
                          name === 'sales' ? 'Sales' : 'Appointments',
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
                        name="Sales"
                      />
                      <Line
                        type="monotone"
                        dataKey="appointmentsValue"
                        stroke="#22C55E"
                        strokeWidth={2}
                        dot={{ fill: '#22C55E', strokeWidth: 2 }}
                        name="Appointments"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="text-gray-500">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="rounded-2xl border border-gray-200">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-xl font-semibold">
                Upcoming appointments
              </CardTitle>
              <p className="text-sm text-gray-500">
                All locations, Next 7 days
              </p>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded">
              <MoreVertical className="h-5 w-5 text-gray-400" />
            </button>
          </CardHeader>
          <CardContent>
            {upcomingAppointments ? (
              <>
                <div className="mb-4">
                  <p className="text-4xl font-bold">
                    {upcomingAppointments.totalBooked} booked
                  </p>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>
                      Confirmed appointments{' '}
                      <span className="font-semibold">
                        {upcomingAppointments.confirmedCount}
                      </span>
                    </p>
                    <p>
                      Cancelled appointments{' '}
                      <span className="font-semibold">
                        {upcomingAppointments.cancelledCount}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={upcomingAppointments.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="dayLabel"
                        tick={{ fontSize: 12 }}
                        axisLine={{ stroke: '#e0e0e0' }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        axisLine={{ stroke: '#e0e0e0' }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="confirmed"
                        stackId="a"
                        fill="#8B5CF6"
                        name="Confirmed"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="cancelled"
                        stackId="a"
                        fill="#EF4444"
                        name="Cancelled"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="text-gray-500">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <Card className="rounded-2xl border border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">
              Top services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-gray-900">
                    Service
                  </TableHead>
                  <TableHead className="text-right font-semibold text-gray-900">
                    This month
                  </TableHead>
                  <TableHead className="text-right font-semibold text-gray-900">
                    Last month
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topServices.length > 0 ? (
                  topServices.map((service) => (
                    <TableRow key={service.serviceName}>
                      <TableCell className="font-medium">
                        {service.serviceName}
                      </TableCell>
                      <TableCell className="text-right">
                        {service.thisMonth}
                      </TableCell>
                      <TableCell className="text-right">
                        {service.lastMonth}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-gray-500 py-8"
                    >
                      No services data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Team Members */}
        <Card className="rounded-2xl border border-gray-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold">
              Top team member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-gray-900">
                    Team member
                  </TableHead>
                  <TableHead className="text-right font-semibold text-gray-900">
                    This month
                  </TableHead>
                  <TableHead className="text-right font-semibold text-gray-900">
                    Last month
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topTeamMembers.length > 0 ? (
                  topTeamMembers.map((member) => (
                    <TableRow key={member.teamMemberId}>
                      <TableCell className="font-medium">
                        {member.teamMemberName}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(member.thisMonth)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(member.lastMonth)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-gray-500 py-8"
                    >
                      No team member data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
