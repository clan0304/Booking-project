// components/admin/staff-management/payroll-reports-tab.tsx
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Percent,
  Trophy,
} from 'lucide-react';
import {
  calculatePayroll,
  calculateCommissionForPayroll,
} from '@/app/actions/staff-pay-rates';
import { getTimeEntries } from '@/app/actions/staff-management';

// =====================================================
// DATE UTILITY FUNCTIONS (No external dependencies)
// =====================================================

function formatDate(date: Date, formatStr: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  if (formatStr === 'yyyy-MM-dd') {
    return `${year}-${month}-${day}`;
  } else if (formatStr === 'HH:mm') {
    return `${hours}:${minutes}`;
  } else if (formatStr === 'EEE dd MMM yyyy') {
    return `${days[date.getDay()]} ${day} ${months[date.getMonth()]} ${year}`;
  }
  return date.toISOString();
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getStartOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function subtractWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - weeks * 7);
  return d;
}

function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// =====================================================
// TYPES
// =====================================================

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
}

interface PayrollItem {
  team_member_id: string;
  team_member_name: string;
  total_hours: number;
  total_paid_hours: number;
  weekday_hours: number;
  saturday_hours: number;
  sunday_hours: number;
  public_holiday_hours: number;
  total_pay: number;
  entries_count: number;
}

interface CommissionSummary {
  team_member_id: string;
  team_member_name: string;
  total_services: number;
  total_sales: number;
  total_commission: number;
  by_client_type: {
    typeA: { count: number; sales: number; commission: number };
    typeB: { count: number; sales: number; commission: number };
    typeBPlus: { count: number; sales: number; commission: number };
    typeC: { count: number; sales: number; commission: number };
  };
}

interface CombinedPayrollItem extends PayrollItem {
  commission?: CommissionSummary;
  recommended_pay: 'hourly' | 'commission';
  final_pay: number;
}

interface TimeEntry {
  id: string;
  team_member_id: string;
  shift_date: string;
  clock_in_time: string;
  clock_out_time: string;
  total_hours: number;
  total_paid_hours: number;
  notes: string | null;
  venues: {
    name: string;
  };
}

type PeriodType = 'weekly' | 'fortnightly' | 'monthly';

interface PayrollReportsTabProps {
  teamMembers: TeamMember[];
}

// =====================================================
// COMPONENT
// =====================================================

export function PayrollReportsTab({ teamMembers }: PayrollReportsTabProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');
  const [startDate, setStartDate] = useState(
    formatDate(getStartOfWeek(new Date()), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    formatDate(getEndOfWeek(new Date()), 'yyyy-MM-dd')
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [combinedData, setCombinedData] = useState<CombinedPayrollItem[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [shiftDetails, setShiftDetails] = useState<{
    [key: string]: TimeEntry[];
  }>({});
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Quick preset handlers
  const applyPreset = (preset: string) => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case 'this-week':
        start = getStartOfWeek(today);
        end = getEndOfWeek(today);
        break;
      case 'last-week':
        start = getStartOfWeek(subtractWeeks(today, 1));
        end = getEndOfWeek(subtractWeeks(today, 1));
        break;
      case 'this-fortnight':
        start = getStartOfWeek(today);
        end = addDays(start, 13); // 14 days total
        break;
      case 'last-fortnight':
        start = getStartOfWeek(subtractWeeks(today, 2));
        end = addDays(start, 13);
        break;
      case 'this-month':
        start = getStartOfMonth(today);
        end = getEndOfMonth(today);
        break;
      case 'last-month':
        start = getStartOfMonth(subtractMonths(today, 1));
        end = getEndOfMonth(subtractMonths(today, 1));
        break;
      default:
        return;
    }

    setStartDate(formatDate(start, 'yyyy-MM-dd'));
    setEndDate(formatDate(end, 'yyyy-MM-dd'));
  };

  // Generate report
  const handleGenerateReport = useCallback(async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    setLoading(true);
    const memberId = selectedMemberId === 'all' ? undefined : selectedMemberId;

    // Fetch both payroll and commission data
    const [payrollResult, commissionResult] = await Promise.all([
      calculatePayroll(startDate, endDate, memberId),
      calculateCommissionForPayroll(startDate, endDate, memberId),
    ]);

    if (payrollResult.success && payrollResult.data) {
      // Create a map of commission data by team member ID
      const commissionMap = new Map<string, CommissionSummary>();
      if (commissionResult.success && commissionResult.data) {
        for (const item of commissionResult.data) {
          commissionMap.set(item.team_member_id, item);
        }
      }

      // Combine payroll with commission data
      const combined: CombinedPayrollItem[] = payrollResult.data.map(
        (payroll) => {
          const commission = commissionMap.get(payroll.team_member_id);
          const commissionAmount = commission?.total_commission || 0;
          const hourlyAmount = payroll.total_pay;

          // Determine which is higher
          const recommended =
            commissionAmount > hourlyAmount ? 'commission' : 'hourly';
          const finalPay = Math.max(commissionAmount, hourlyAmount);

          return {
            ...payroll,
            commission,
            recommended_pay: recommended,
            final_pay: finalPay,
          };
        }
      );

      // Also add team members who have commission but no shifts
      if (commissionResult.success && commissionResult.data) {
        for (const comm of commissionResult.data) {
          const exists = combined.some(
            (c) => c.team_member_id === comm.team_member_id
          );
          if (!exists) {
            combined.push({
              team_member_id: comm.team_member_id,
              team_member_name: comm.team_member_name,
              total_hours: 0,
              total_paid_hours: 0,
              weekday_hours: 0,
              saturday_hours: 0,
              sunday_hours: 0,
              public_holiday_hours: 0,
              total_pay: 0,
              entries_count: 0,
              commission: comm,
              recommended_pay: 'commission',
              final_pay: comm.total_commission,
            });
          }
        }
      }

      setCombinedData(combined);
      setHasGenerated(true);
    } else {
      alert(payrollResult.error || 'Failed to generate report');
      setCombinedData([]);
    }

    setLoading(false);
  }, [startDate, endDate, selectedMemberId]);

  // Toggle row expansion
  const toggleRow = async (memberId: string) => {
    const newExpanded = new Set(expandedRows);

    if (newExpanded.has(memberId)) {
      newExpanded.delete(memberId);
    } else {
      newExpanded.add(memberId);

      // Load shift details if not already loaded
      if (!shiftDetails[memberId]) {
        const result = await getTimeEntries({
          teamMemberId: memberId,
          startDate,
          endDate,
        });

        if (result.success && result.data) {
          setShiftDetails({
            ...shiftDetails,
            [memberId]: result.data as unknown as TimeEntry[],
          });
        }
      }
    }

    setExpandedRows(newExpanded);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (combinedData.length === 0) return;

    const headers = [
      'Staff Member',
      'Weekday Hours',
      'Saturday Hours',
      'Sunday Hours',
      'Holiday Hours',
      'Total Paid Hours',
      'Hourly Pay',
      'Services',
      'Sales',
      'Commission',
      'Recommended',
      'Final Pay',
    ];

    const rows = combinedData.map((item) => [
      item.team_member_name,
      item.weekday_hours.toFixed(2),
      item.saturday_hours.toFixed(2),
      item.sunday_hours.toFixed(2),
      item.public_holiday_hours.toFixed(2),
      item.total_paid_hours.toFixed(2),
      `$${item.total_pay.toFixed(2)}`,
      item.commission?.total_services || 0,
      `$${(item.commission?.total_sales || 0).toFixed(2)}`,
      `$${(item.commission?.total_commission || 0).toFixed(2)}`,
      item.recommended_pay === 'commission' ? 'Commission' : 'Hourly',
      `$${item.final_pay.toFixed(2)}`,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-report-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  // Calculate summary stats
  const totalHourlyPay = combinedData.reduce(
    (sum, item) => sum + item.total_pay,
    0
  );
  const totalCommission = combinedData.reduce(
    (sum, item) => sum + (item.commission?.total_commission || 0),
    0
  );
  const totalFinalPay = combinedData.reduce(
    (sum, item) => sum + item.final_pay,
    0
  );
  const totalHours = combinedData.reduce(
    (sum, item) => sum + item.total_paid_hours,
    0
  );
  const staffCount = combinedData.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payroll Reports
          </CardTitle>
          <CardDescription>
            Compare hourly pay vs commission - pay the higher amount
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Period Type Selector */}
          <div className="space-y-2">
            <Label>Pay Period Type</Label>
            <div className="flex gap-2">
              <Button
                variant={periodType === 'weekly' ? 'default' : 'outline'}
                onClick={() => setPeriodType('weekly')}
              >
                Weekly
              </Button>
              <Button
                variant={periodType === 'fortnightly' ? 'default' : 'outline'}
                onClick={() => setPeriodType('fortnightly')}
              >
                Fortnightly
              </Button>
              <Button
                variant={periodType === 'monthly' ? 'default' : 'outline'}
                onClick={() => setPeriodType('monthly')}
              >
                Monthly
              </Button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label>Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {periodType === 'weekly' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('this-week')}
                  >
                    This Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('last-week')}
                  >
                    Last Week
                  </Button>
                </>
              )}
              {periodType === 'fortnightly' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('this-fortnight')}
                  >
                    This Fortnight
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('last-fortnight')}
                  >
                    Last Fortnight
                  </Button>
                </>
              )}
              {periodType === 'monthly' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('this-month')}
                  >
                    This Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('last-month')}
                  >
                    Last Month
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team_member">Team Member</Label>
              <Select
                value={selectedMemberId}
                onValueChange={setSelectedMemberId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name || ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateReport}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {hasGenerated && (
        <>
          {combinedData.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No data for this period</p>
                <p className="text-sm mt-2">
                  There are no completed shifts or appointments in the selected
                  date range
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Hourly Pay
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <div className="text-2xl font-bold">
                        ${totalHourlyPay.toFixed(2)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Commission
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Percent className="h-5 w-5 text-purple-600" />
                      <div className="text-2xl font-bold">
                        ${totalCommission.toFixed(2)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-green-700">
                      Final Payroll (Higher)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-green-600" />
                      <div className="text-2xl font-bold text-green-700">
                        ${totalFinalPay.toFixed(2)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                      <div className="text-2xl font-bold">
                        {totalHours.toFixed(1)}h
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Staff Count
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-600" />
                      <div className="text-2xl font-bold">{staffCount}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Export Button */}
              <div className="flex justify-end">
                <Button onClick={handleExportCSV} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              {/* Detailed Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Breakdown</CardTitle>
                  <CardDescription>
                    Click on a row to see individual shift details. Green
                    highlight = recommended pay method.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {combinedData.map((item) => (
                      <div
                        key={item.team_member_id}
                        className="border rounded-lg"
                      >
                        {/* Main Row */}
                        <div
                          className="p-4 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleRow(item.team_member_id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {expandedRows.has(item.team_member_id) ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <div>
                                <p className="font-semibold">
                                  {item.team_member_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {item.entries_count} shifts •{' '}
                                  {item.commission?.total_services || 0}{' '}
                                  services
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 items-stretch">
                              {/* Hourly Pay */}
                              <div
                                className={`p-3 rounded border flex flex-col justify-between ${
                                  item.recommended_pay === 'hourly'
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50'
                                }`}
                              >
                                <p className="text-xs text-muted-foreground">
                                  Hourly Pay
                                </p>
                                <div>
                                  <p
                                    className={`font-bold text-lg ${
                                      item.recommended_pay === 'hourly'
                                        ? 'text-green-700'
                                        : ''
                                    }`}
                                  >
                                    ${item.total_pay.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.total_paid_hours.toFixed(1)}h
                                  </p>
                                </div>
                              </div>

                              {/* Commission */}
                              <div
                                className={`p-3 rounded border flex flex-col justify-between ${
                                  item.recommended_pay === 'commission'
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50'
                                }`}
                              >
                                <p className="text-xs text-muted-foreground">
                                  Commission
                                </p>
                                <div>
                                  <p
                                    className={`font-bold text-lg ${
                                      item.recommended_pay === 'commission'
                                        ? 'text-green-700'
                                        : ''
                                    }`}
                                  >
                                    $
                                    {(
                                      item.commission?.total_commission || 0
                                    ).toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    $
                                    {(
                                      item.commission?.total_sales || 0
                                    ).toFixed(0)}{' '}
                                    sales
                                  </p>
                                </div>
                              </div>

                              {/* Recommended */}
                              <div className="p-3 rounded border bg-gray-50 flex flex-col justify-between">
                                <p className="text-xs text-muted-foreground">
                                  Recommended
                                </p>
                                <div>
                                  <Badge
                                    variant={
                                      item.recommended_pay === 'commission'
                                        ? 'default'
                                        : 'secondary'
                                    }
                                    className={
                                      item.recommended_pay === 'commission'
                                        ? 'bg-purple-600'
                                        : 'bg-blue-600 text-white'
                                    }
                                  >
                                    {item.recommended_pay === 'commission'
                                      ? 'Commission'
                                      : 'Hourly'}
                                  </Badge>
                                </div>
                              </div>

                              {/* Final Pay */}
                              <div className="p-3 rounded border bg-gray-50 flex flex-col justify-between">
                                <p className="text-xs text-muted-foreground">
                                  Final Pay
                                </p>
                                <div>
                                  <p className="font-bold text-green-600 text-xl">
                                    ${item.final_pay.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedRows.has(item.team_member_id) && (
                          <div className="border-t bg-gray-50 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Hours Breakdown */}
                              <div>
                                <p className="font-semibold mb-3 text-sm">
                                  Hours Breakdown
                                </p>
                                <div className="grid grid-cols-4 gap-2 text-sm">
                                  <div className="bg-white p-2 rounded border">
                                    <p className="text-xs text-muted-foreground">
                                      Weekday
                                    </p>
                                    <p className="font-medium">
                                      {item.weekday_hours.toFixed(1)}h
                                    </p>
                                  </div>
                                  <div className="bg-white p-2 rounded border">
                                    <p className="text-xs text-muted-foreground">
                                      Saturday
                                    </p>
                                    <p className="font-medium">
                                      {item.saturday_hours.toFixed(1)}h
                                    </p>
                                  </div>
                                  <div className="bg-white p-2 rounded border">
                                    <p className="text-xs text-muted-foreground">
                                      Sunday
                                    </p>
                                    <p className="font-medium">
                                      {item.sunday_hours.toFixed(1)}h
                                    </p>
                                  </div>
                                  <div className="bg-white p-2 rounded border">
                                    <p className="text-xs text-muted-foreground">
                                      Holiday
                                    </p>
                                    <p className="font-medium">
                                      {item.public_holiday_hours.toFixed(1)}h
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Commission Breakdown */}
                              {item.commission && (
                                <div>
                                  <p className="font-semibold mb-3 text-sm">
                                    Commission Breakdown
                                  </p>
                                  <div className="grid grid-cols-4 gap-2 text-sm">
                                    <div className="bg-white p-2 rounded border">
                                      <p className="text-xs text-muted-foreground">
                                        A (New) 30%
                                      </p>
                                      <p className="font-medium">
                                        {
                                          item.commission.by_client_type.typeA
                                            .count
                                        }
                                      </p>
                                      <p className="text-xs text-green-600">
                                        $
                                        {item.commission.by_client_type.typeA.commission.toFixed(
                                          0
                                        )}
                                      </p>
                                    </div>
                                    <div className="bg-white p-2 rounded border">
                                      <p className="text-xs text-muted-foreground">
                                        B (Regular) 40%
                                      </p>
                                      <p className="font-medium">
                                        {
                                          item.commission.by_client_type.typeB
                                            .count
                                        }
                                      </p>
                                      <p className="text-xs text-green-600">
                                        $
                                        {item.commission.by_client_type.typeB.commission.toFixed(
                                          0
                                        )}
                                      </p>
                                    </div>
                                    <div className="bg-white p-2 rounded border">
                                      <p className="text-xs text-muted-foreground">
                                        B+ (Request) 40%
                                      </p>
                                      <p className="font-medium">
                                        {
                                          item.commission.by_client_type
                                            .typeBPlus.count
                                        }
                                      </p>
                                      <p className="text-xs text-green-600">
                                        $
                                        {item.commission.by_client_type.typeBPlus.commission.toFixed(
                                          0
                                        )}
                                      </p>
                                    </div>
                                    <div className="bg-white p-2 rounded border">
                                      <p className="text-xs text-muted-foreground">
                                        C (Salon) 30%
                                      </p>
                                      <p className="font-medium">
                                        {
                                          item.commission.by_client_type.typeC
                                            .count
                                        }
                                      </p>
                                      <p className="text-xs text-green-600">
                                        $
                                        {item.commission.by_client_type.typeC.commission.toFixed(
                                          0
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Individual Shifts */}
                            <div className="mt-4">
                              <p className="font-semibold mb-3 text-sm">
                                Individual Shifts
                              </p>
                              {shiftDetails[item.team_member_id] ? (
                                shiftDetails[item.team_member_id].length > 0 ? (
                                  <div className="space-y-2">
                                    {shiftDetails[item.team_member_id].map(
                                      (shift) => (
                                        <div
                                          key={shift.id}
                                          className="flex justify-between items-center bg-white p-3 rounded border text-sm"
                                        >
                                          <div>
                                            <p className="font-medium">
                                              {formatDate(
                                                new Date(
                                                  shift.shift_date + 'T00:00:00'
                                                ),
                                                'EEE dd MMM yyyy'
                                              )}
                                            </p>
                                            <p className="text-muted-foreground">
                                              {shift.venues.name}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-medium">
                                              {shift.total_paid_hours?.toFixed(
                                                1
                                              )}
                                              h paid
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {formatDate(
                                                new Date(shift.clock_in_time),
                                                'HH:mm'
                                              )}{' '}
                                              -{' '}
                                              {shift.clock_out_time &&
                                                formatDate(
                                                  new Date(
                                                    shift.clock_out_time
                                                  ),
                                                  'HH:mm'
                                                )}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    No shifts recorded
                                  </p>
                                )
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Loading shifts...
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
