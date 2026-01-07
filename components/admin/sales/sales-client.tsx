// components/admin/sales/sales-client.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  SlidersHorizontal,
  Loader2,
  DollarSign,
  CreditCard,
  Banknote,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  getDailySales,
  getSalesRange,
  type DailySalesData,
} from '@/app/actions/sales';

// =====================================================
// TYPES
// =====================================================

interface Venue {
  id: string;
  name: string;
}

interface SalesClientProps {
  venues: Venue[];
}

// =====================================================
// HELPERS
// =====================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatCurrency(amount: number): string {
  return `A$ ${amount.toFixed(2)}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// =====================================================
// COMPONENT
// =====================================================

export function SalesClient({ venues }: SalesClientProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedVenue, setSelectedVenue] = useState<string>('all');
  const [salesData, setSalesData] = useState<DailySalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Custom date range state
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Fetch sales data
  const fetchSalesData = useCallback(async () => {
    setLoading(true);

    const venueId = selectedVenue === 'all' ? undefined : selectedVenue;

    let result;
    if (useCustomRange && customStartDate && customEndDate) {
      result = await getSalesRange(customStartDate, customEndDate, venueId);
    } else {
      result = await getDailySales(formatDate(selectedDate), venueId);
    }

    if (result.success && result.data) {
      setSalesData(result.data);
    } else {
      setSalesData(null);
    }

    setLoading(false);
  }, [
    selectedDate,
    selectedVenue,
    useCustomRange,
    customStartDate,
    customEndDate,
  ]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  // Navigate to previous day
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
    setUseCustomRange(false);
  };

  // Navigate to next day
  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
    setUseCustomRange(false);
  };

  // Go to today
  const goToToday = () => {
    setSelectedDate(new Date());
    setUseCustomRange(false);
  };

  // Check if selected date is today
  const isToday = formatDate(selectedDate) === formatDate(new Date());

  // Export to CSV
  const handleExportCSV = () => {
    if (!salesData) return;

    const lines: string[] = [];

    // Header
    lines.push(`Daily Sales Report - ${salesData.dateFormatted}`);
    lines.push('');

    // Transaction Summary
    lines.push('TRANSACTION SUMMARY');
    lines.push(
      'Item Type,Sales Qty,Refund Qty,Gross Total,Refund Total,Net Total'
    );
    for (const item of salesData.transactionSummary) {
      lines.push(
        `${item.label},${item.salesQty},${
          item.refundQty
        },${item.grossTotal.toFixed(2)},${item.refundTotal.toFixed(
          2
        )},${item.netTotal.toFixed(2)}`
      );
    }
    lines.push('');

    // Cash Movement
    lines.push('CASH MOVEMENT SUMMARY');
    lines.push('Payment Type,Payments Collected,Refunds Paid,Net Total');
    for (const item of salesData.cashMovement) {
      lines.push(
        `${item.label},${item.paymentsCollected.toFixed(
          2
        )},${item.refundsPaid.toFixed(2)},${item.netTotal.toFixed(2)}`
      );
    }
    lines.push('');

    // Totals
    lines.push('TOTALS');
    lines.push(`Gross Sales,${salesData.totals.grossSales.toFixed(2)}`);
    lines.push(`Total Refunds,${salesData.totals.totalRefunds.toFixed(2)}`);
    lines.push(`Net Sales,${salesData.totals.netSales.toFixed(2)}`);

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${salesData.date}.csv`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daily sales</h1>
            <p className="text-gray-600 mt-1">
              View, filter and export the transactions and cash movement for the
              day.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={!salesData}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="bg-gray-900 hover:bg-gray-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add new
            </Button>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-4">
          {/* Previous Day */}
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousDay}
            className="h-10 w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {/* Today Button */}
          <Button
            variant={isToday && !useCustomRange ? 'default' : 'outline'}
            onClick={goToToday}
            className={
              isToday && !useCustomRange ? 'bg-gray-900 text-white' : ''
            }
          >
            Today
          </Button>

          {/* Date Display */}
          <div className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white">
            <span className="font-medium">
              {useCustomRange && customStartDate && customEndDate
                ? salesData?.dateFormatted || 'Custom Range'
                : formatDisplayDate(selectedDate)}
            </span>
          </div>

          {/* Next Day */}
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextDay}
            className="h-10 w-10"
            disabled={isToday}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          {/* Filters Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="ml-4"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-end gap-4">
            {/* Venue Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Venue</label>
              <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All venues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All venues</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    if (e.target.value && customEndDate) {
                      setUseCustomRange(true);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    if (customStartDate && e.target.value) {
                      setUseCustomRange(true);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Clear Filters */}
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedVenue('all');
                setUseCustomRange(false);
                setCustomStartDate('');
                setCustomEndDate('');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !salesData ? (
          <div className="text-center py-20">
            <DollarSign className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-600">
              No sales data available
            </p>
            <p className="text-sm text-gray-500 mt-1">
              There are no transactions for this period.
            </p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Gross Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold">
                      {formatCurrency(salesData.totals.grossSales)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Total Refunds
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    <span className="text-2xl font-bold text-red-600">
                      -{formatCurrency(salesData.totals.totalRefunds)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Net Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(salesData.totals.netSales)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Payments Collected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <span className="text-2xl font-bold">
                      {formatCurrency(salesData.totals.totalPaymentsCollected)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Transaction Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Transaction summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item type</TableHead>
                        <TableHead className="text-right">Sales qty</TableHead>
                        <TableHead className="text-right">Refund qty</TableHead>
                        <TableHead className="text-right">
                          Gross total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesData.transactionSummary.map((item) => (
                        <TableRow key={item.label}>
                          <TableCell className="font-medium">
                            {item.label}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.salesQty}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.refundQty}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.grossTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="font-bold bg-gray-50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {salesData.transactionSummary.reduce(
                            (sum, item) => sum + item.salesQty,
                            0
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {salesData.transactionSummary.reduce(
                            (sum, item) => sum + item.refundQty,
                            0
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(salesData.totals.grossSales)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Cash Movement Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Cash movement summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment type</TableHead>
                        <TableHead className="text-right">
                          Payments collected
                        </TableHead>
                        <TableHead className="text-right">
                          Refunds paid
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesData.cashMovement.map((item) => (
                        <TableRow key={item.label}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.type === 'card' ? (
                                <CreditCard className="h-4 w-4 text-gray-500" />
                              ) : (
                                <Banknote className="h-4 w-4 text-gray-500" />
                              )}
                              {item.label}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.paymentsCollected)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.refundsPaid)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="font-bold bg-gray-50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            salesData.totals.totalPaymentsCollected
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(salesData.totals.totalRefundsPaid)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
