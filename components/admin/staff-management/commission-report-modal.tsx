// components/admin/staff-management/commission-report-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  ChevronDown,
  ChevronRight,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getCommissionReport,
  exportCommissionReportCSV,
  type CommissionReportData,
  type DailyReport,
  type CommissionRates,
} from '@/app/actions/commission-reports';
import Image from 'next/image';

interface CommissionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMember: {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  };
}

type ViewMode = 'daily' | 'summary';

// Helper to get date range presets
function getDatePresets() {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const startOfLastMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  );
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    today: {
      start: formatDate(today),
      end: formatDate(today),
      label: 'Today',
    },
    thisWeek: {
      start: formatDate(startOfWeek),
      end: formatDate(today),
      label: 'This Week',
    },
    thisMonth: {
      start: formatDate(startOfMonth),
      end: formatDate(endOfMonth),
      label: 'This Month',
    },
    lastMonth: {
      start: formatDate(startOfLastMonth),
      end: formatDate(endOfLastMonth),
      label: 'Last Month',
    },
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function CommissionReportModal({
  isOpen,
  onClose,
  teamMember,
}: CommissionReportModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [datePreset, setDatePreset] = useState<string>('thisMonth');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [report, setReport] = useState<CommissionReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Initialize dates
  useEffect(() => {
    const presets = getDatePresets();
    const preset = presets.thisMonth;
    setStartDate(preset.start);
    setEndDate(preset.end);
  }, []);

  // Fetch report
  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    try {
      const result = await getCommissionReport(
        teamMember.id,
        startDate,
        endDate
      );
      if (result.success && result.data) {
        setReport(result.data);
        // Auto-expand first day for daily view
        if (result.data.dailyReports.length > 0) {
          setExpandedDays(new Set([result.data.dailyReports[0].date]));
        }
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }, [teamMember.id, startDate, endDate]);

  useEffect(() => {
    if (isOpen && startDate && endDate) {
      fetchReport();
    }
  }, [isOpen, fetchReport, startDate, endDate]);

  // Handle date preset change
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const presets = getDatePresets();
    const selected = presets[preset as keyof typeof presets];
    if (selected) {
      setStartDate(selected.start);
      setEndDate(selected.end);
    }
  };

  // Toggle day expansion
  const toggleDay = (date: string) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDays(newExpanded);
  };

  // Expand/collapse all
  const toggleAllDays = () => {
    if (expandedDays.size === report?.dailyReports.length) {
      setExpandedDays(new Set());
    } else {
      setExpandedDays(new Set(report?.dailyReports.map((d) => d.date) || []));
    }
  };

  // Export CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportCommissionReportCSV(
        teamMember.id,
        startDate,
        endDate
      );
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commission-report-${teamMember.first_name}-${startDate}-${endDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  const presets = getDatePresets();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {teamMember.photo_url ? (
              <Image
                src={teamMember.photo_url}
                alt={teamMember.first_name}
                className="rounded-full object-cover border-2 border-white"
                height={12}
                width={12}
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold">
                {teamMember.first_name[0]}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                Commission Report
              </h2>
              <p className="text-white/80">
                {teamMember.first_name} {teamMember.last_name || ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            {/* Date Preset */}
            <Select value={datePreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(presets).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Inputs */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'daily'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Daily Detail
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'summary'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Summary
              </button>
            </div>
          </div>

          {/* Export Button */}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || !report}
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !report ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No data available
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <SummaryCard
                  icon={DollarSign}
                  label="Total Sales"
                  value={formatCurrency(report.periodSummary.totalSales)}
                  color="blue"
                />
                <SummaryCard
                  icon={TrendingUp}
                  label="Commission"
                  value={formatCurrency(report.periodSummary.totalCommission)}
                  color="green"
                />
                <SummaryCard
                  icon={Users}
                  label="Services"
                  value={report.periodSummary.totalServices.toString()}
                  color="purple"
                />
                <SummaryCard
                  icon={Calendar}
                  label="Working Days"
                  value={report.dailyReports.length.toString()}
                  color="orange"
                />
              </div>

              {viewMode === 'summary' ? (
                <SummaryView report={report} />
              ) : (
                <DailyView
                  report={report}
                  expandedDays={expandedDays}
                  toggleDay={toggleDay}
                  toggleAllDays={toggleAllDays}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// =====================================================
// SUMMARY CARD COMPONENT
// =====================================================

interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function SummaryCard({ icon: Icon, label, value, color }: SummaryCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// SUMMARY VIEW COMPONENT
// =====================================================

interface SummaryViewProps {
  report: CommissionReportData;
}

function SummaryView({ report }: SummaryViewProps) {
  const { periodSummary, commissionRates } = report;

  return (
    <div className="space-y-6">
      {/* Client Type Summary */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">By Client Type</h3>
          </div>
          <div className="divide-y divide-gray-100">
            <ClientTypeRow
              label="Type A (New Client)"
              rate={commissionRates.A}
              data={periodSummary.byClientType.typeA}
              color="bg-blue-500"
            />
            <ClientTypeRow
              label="Type B (Regular Client)"
              rate={commissionRates.B}
              data={periodSummary.byClientType.typeB}
              color="bg-green-500"
            />
            <ClientTypeRow
              label="Type B+ (Requested New)"
              rate={commissionRates['B+']}
              data={periodSummary.byClientType.typeBPlus}
              color="bg-purple-500"
            />
            <ClientTypeRow
              label="Type C (Salon Client)"
              rate={commissionRates.C}
              data={periodSummary.byClientType.typeC}
              color="bg-orange-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Summary Table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">By Service Category</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    A
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    B
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    B+
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    C
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Commission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {periodSummary.byCategory.map((cat) => (
                  <tr key={cat.categoryId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.categoryColor }}
                        />
                        <span className="font-medium text-gray-900">
                          {cat.categoryName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="text-gray-600">{cat.typeA.count}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(cat.typeA.total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="text-gray-600">{cat.typeB.count}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(cat.typeB.total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="text-gray-600">
                        {cat.typeBPlus.count}
                      </span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(cat.typeBPlus.total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="text-gray-600">{cat.typeC.count}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(cat.typeC.total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span className="text-gray-600">{cat.total.count}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(cat.total.total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-green-600">
                        {formatCurrency(cat.commission)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center text-sm">
                    {periodSummary.byClientType.typeA.count} /{' '}
                    {formatCurrency(periodSummary.byClientType.typeA.total)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {periodSummary.byClientType.typeB.count} /{' '}
                    {formatCurrency(periodSummary.byClientType.typeB.total)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {periodSummary.byClientType.typeBPlus.count} /{' '}
                    {formatCurrency(periodSummary.byClientType.typeBPlus.total)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {periodSummary.byClientType.typeC.count} /{' '}
                    {formatCurrency(periodSummary.byClientType.typeC.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {periodSummary.totalServices} /{' '}
                    {formatCurrency(periodSummary.totalSales)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {formatCurrency(periodSummary.totalCommission)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Summary */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Payment Methods</h3>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Banknote className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cash</p>
                <p className="text-lg font-bold text-gray-900">
                  {periodSummary.byPaymentMethod.cash.count} transactions
                </p>
                <p className="text-sm text-gray-600">
                  {formatCurrency(periodSummary.byPaymentMethod.cash.total)}
                </p>
              </div>
            </div>
            <div className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Card</p>
                <p className="text-lg font-bold text-gray-900">
                  {periodSummary.byPaymentMethod.card.count} transactions
                </p>
                <p className="text-sm text-gray-600">
                  {formatCurrency(periodSummary.byPaymentMethod.card.total)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// CLIENT TYPE ROW COMPONENT
// =====================================================

interface ClientTypeRowProps {
  label: string;
  rate: number;
  data: { count: number; total: number; commission: number };
  color: string;
}

function ClientTypeRow({ label, rate, data, color }: ClientTypeRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm text-gray-500">
            {Math.round(rate * 100)}% rate
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-900">{formatCurrency(data.total)}</p>
        <p className="text-sm text-gray-500">
          {data.count} services → {formatCurrency(data.commission)} commission
        </p>
      </div>
    </div>
  );
}

// =====================================================
// DAILY VIEW COMPONENT
// =====================================================

interface DailyViewProps {
  report: CommissionReportData;
  expandedDays: Set<string>;
  toggleDay: (date: string) => void;
  toggleAllDays: () => void;
}

function DailyView({
  report,
  expandedDays,
  toggleDay,
  toggleAllDays,
}: DailyViewProps) {
  const allExpanded = expandedDays.size === report.dailyReports.length;

  return (
    <div className="space-y-4">
      {/* Expand/Collapse All */}
      <div className="flex justify-end">
        <button
          onClick={toggleAllDays}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Daily Reports */}
      {report.dailyReports.map((day) => (
        <DailyCard
          key={day.date}
          day={day}
          isExpanded={expandedDays.has(day.date)}
          onToggle={() => toggleDay(day.date)}
          commissionRates={report.commissionRates}
        />
      ))}

      {report.dailyReports.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No services recorded for this period
        </div>
      )}
    </div>
  );
}

// =====================================================
// DAILY CARD COMPONENT
// =====================================================

interface DailyCardProps {
  day: DailyReport;
  isExpanded: boolean;
  onToggle: () => void;
  commissionRates: CommissionReportData['commissionRates'];
}

function DailyCard({
  day,
  isExpanded,
  onToggle,
  commissionRates,
}: DailyCardProps) {
  return (
    <Card className="overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-4">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
          <div className="text-left">
            <p className="font-semibold text-gray-900">{day.dayOfWeek}</p>
            <p className="text-sm text-gray-500">{day.dateFormatted}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Services</p>
            <p className="font-bold text-gray-900">{day.summary.totalCount}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Sales</p>
            <p className="font-bold text-gray-900">
              {formatCurrency(day.summary.totalAmount)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Commission</p>
            <p className="font-bold text-green-600">
              {formatCurrency(day.summary.commission)}
            </p>
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="p-0">
          {/* Summary Row */}
          <div className="grid grid-cols-7 gap-2 px-4 py-2 bg-purple-50 border-b border-purple-100 text-xs">
            <div className="text-center">
              <span className="text-purple-700">A:</span>{' '}
              <span className="font-bold">{day.summary.typeA.count}</span> /{' '}
              <span className="font-bold">
                {formatCurrency(day.summary.typeA.total)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-purple-700">B:</span>{' '}
              <span className="font-bold">{day.summary.typeB.count}</span> /{' '}
              <span className="font-bold">
                {formatCurrency(day.summary.typeB.total)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-purple-700">B+:</span>{' '}
              <span className="font-bold">{day.summary.typeBPlus.count}</span> /{' '}
              <span className="font-bold">
                {formatCurrency(day.summary.typeBPlus.total)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-purple-700">C:</span>{' '}
              <span className="font-bold">{day.summary.typeC.count}</span> /{' '}
              <span className="font-bold">
                {formatCurrency(day.summary.typeC.total)}
              </span>
            </div>
            <div className="text-center col-span-2">
              <span className="text-purple-700">Cash:</span>{' '}
              <span className="font-bold">{day.summary.cash.count}</span> /{' '}
              <span className="font-bold">
                {formatCurrency(day.summary.cash.total)}
              </span>
              <span className="mx-2">|</span>
              <span className="text-purple-700">Card:</span>{' '}
              <span className="font-bold">{day.summary.card.count}</span> /{' '}
              <span className="font-bold">
                {formatCurrency(day.summary.card.total)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-purple-700">Total:</span>{' '}
              <span className="font-bold">{day.summary.totalCount}</span> /{' '}
              <span className="font-bold text-green-600">
                {formatCurrency(day.summary.totalAmount)}
              </span>
            </div>
          </div>

          {/* Entries Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-2 text-left font-medium text-gray-600">
                  Time
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">
                  Category
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">
                  Service
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">
                  Type
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">
                  Client
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">
                  Payment
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">
                  Price
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">
                  Commission
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {day.entries.map((entry) => {
                // Get commission rate from commissionRates prop
                const rate = entry.clientType
                  ? (commissionRates[
                      entry.clientType as keyof CommissionRates
                    ] as number) || 0
                  : 0;
                const commission = entry.price * rate;

                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{entry.time}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: entry.categoryColor }}
                        />
                        <span className="text-gray-900">
                          {entry.categoryName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {entry.serviceName}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <ClientTypeBadge type={entry.clientType} />
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {entry.clientName}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <PaymentBadge method={entry.paymentMethod} />
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">
                      {formatCurrency(entry.price)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-green-600">
                      {formatCurrency(commission)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      )}
    </Card>
  );
}

// =====================================================
// BADGE COMPONENTS
// =====================================================

function ClientTypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-gray-400">-</span>;

  const config: Record<string, { label: string; bg: string; text: string }> = {
    A: { label: 'A', bg: 'bg-blue-100', text: 'text-blue-700' },
    B: { label: 'B', bg: 'bg-green-100', text: 'text-green-700' },
    'B+': { label: 'B+', bg: 'bg-purple-100', text: 'text-purple-700' },
    C: { label: 'C', bg: 'bg-orange-100', text: 'text-orange-700' },
  };

  const { label, bg, text } = config[type] || {
    label: '?',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  };

  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${bg} ${text}`}
    >
      {label}
    </span>
  );
}

function PaymentBadge({ method }: { method: string }) {
  if (method === 'cash') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
        <Banknote className="h-3 w-3" />
        Cash
      </span>
    );
  }
  if (method === 'card') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
        <CreditCard className="h-3 w-3" />
        Card
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
      Pending
    </span>
  );
}
