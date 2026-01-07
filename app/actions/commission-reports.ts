// app/actions/commission-reports.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import {
  CLIENT_TYPE_CONFIG,
  getCommissionRate,
  type ClientType,
} from '@/lib/client-type-config';

// =====================================================
// TYPES
// =====================================================

export interface CommissionRates {
  A: number; // New Client - 30%
  B: number; // Regular Client - 40%
  'B+': number; // Requested New - 40%
  C: number; // Salon Client - 30%
  products: number; // Product commission rate
}

// Get commission rates from existing config
const COMMISSION_RATES: CommissionRates = {
  A: CLIENT_TYPE_CONFIG.A.commission,
  B: CLIENT_TYPE_CONFIG.B.commission,
  'B+': CLIENT_TYPE_CONFIG['B+'].commission,
  C: CLIENT_TYPE_CONFIG.C.commission,
  products: 0.1, // 10% for products
};

export interface DailyServiceEntry {
  id: string;
  date: string;
  time: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  serviceName: string;
  clientType: ClientType | null;
  price: number;
  paymentMethod: 'card' | 'cash' | 'pending';
  clientName: string;
  notes: string | null;
}

export interface DailySummary {
  typeA: { count: number; total: number };
  typeB: { count: number; total: number };
  typeBPlus: { count: number; total: number };
  typeC: { count: number; total: number };
  products: { count: number; total: number };
  cash: { count: number; total: number };
  card: { count: number; total: number };
  totalCount: number;
  totalAmount: number;
  commission: number;
}

export interface DailyReport {
  date: string;
  dateFormatted: string;
  dayOfWeek: string;
  entries: DailyServiceEntry[];
  summary: DailySummary;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  typeA: { count: number; total: number };
  typeB: { count: number; total: number };
  typeBPlus: { count: number; total: number };
  typeC: { count: number; total: number };
  total: { count: number; total: number };
  commission: number;
}

export interface PeriodSummary {
  totalSales: number;
  totalCommission: number;
  totalServices: number;
  totalProducts: number;
  byClientType: {
    typeA: { count: number; total: number; commission: number };
    typeB: { count: number; total: number; commission: number };
    typeBPlus: { count: number; total: number; commission: number };
    typeC: { count: number; total: number; commission: number };
  };
  byCategory: CategorySummary[];
  byPaymentMethod: {
    cash: { count: number; total: number };
    card: { count: number; total: number };
  };
}

export interface CommissionReportData {
  teamMemberId: string;
  teamMemberName: string;
  startDate: string;
  endDate: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  dailyReports: DailyReport[];
  periodSummary: PeriodSummary;
  commissionRates: CommissionRates;
}

// =====================================================
// HELPER: Create empty daily summary
// =====================================================

function createEmptyDailySummary(): DailySummary {
  return {
    typeA: { count: 0, total: 0 },
    typeB: { count: 0, total: 0 },
    typeBPlus: { count: 0, total: 0 },
    typeC: { count: 0, total: 0 },
    products: { count: 0, total: 0 },
    cash: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    totalCount: 0,
    totalAmount: 0,
    commission: 0,
  };
}

// =====================================================
// GET COMMISSION REPORT
// =====================================================

export async function getCommissionReport(
  teamMemberId: string,
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  data?: CommissionReportData;
  error?: string;
}> {
  try {
    await requireAdmin();

    // Get team member name
    const { data: teamMember, error: memberError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name')
      .eq('id', teamMemberId)
      .single();

    if (memberError || !teamMember) {
      return { success: false, error: 'Team member not found' };
    }

    // Get all appointments for this team member in date range
    const { data: appointments, error: appointmentsError } = await supabaseAdmin
      .from('appointments')
      .select(
        `
        id,
        service_id,
        service_name,
        price,
        start_time,
        status,
        notes,
        booking_group:booking_groups!inner (
          id,
          booking_date,
          client_type,
          guest_first_name,
          guest_last_name,
          status
        ),
        service:services (
          id,
          name,
          category:service_categories (
            id,
            name,
            color
          )
        )
      `
      )
      .eq('team_member_id', teamMemberId)
      .gte('booking_group.booking_date', startDate)
      .lte('booking_group.booking_date', endDate)
      .in('status', ['confirmed', 'completed'])
      .in('booking_group.status', ['confirmed', 'completed'])
      .order('booking_group(booking_date)', { ascending: true });

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      return { success: false, error: 'Failed to fetch appointments' };
    }

    // Get payment info for these bookings
    const bookingIds = [
      ...new Set(
        (appointments || [])
          .map((a) => {
            const booking = Array.isArray(a.booking_group)
              ? a.booking_group[0]
              : a.booking_group;
            return booking?.id;
          })
          .filter(Boolean)
      ),
    ];

    const paymentsByBooking: Record<string, 'card' | 'cash' | 'pending'> = {};

    if (bookingIds.length > 0) {
      const { data: transactions } = await supabaseAdmin
        .from('transactions')
        .select('booking_group_id, payment_method')
        .in('booking_group_id', bookingIds)
        .eq('status', 'completed');

      if (transactions) {
        for (const tx of transactions) {
          if (tx.booking_group_id) {
            paymentsByBooking[tx.booking_group_id] =
              tx.payment_method === 'cash' ? 'cash' : 'card';
          }
        }
      }
    }

    // Process appointments into daily reports
    const dailyMap = new Map<string, DailyReport>();
    const categorySummaryMap = new Map<string, CategorySummary>();

    // Initialize period summary
    const periodSummary: PeriodSummary = {
      totalSales: 0,
      totalCommission: 0,
      totalServices: 0,
      totalProducts: 0,
      byClientType: {
        typeA: { count: 0, total: 0, commission: 0 },
        typeB: { count: 0, total: 0, commission: 0 },
        typeBPlus: { count: 0, total: 0, commission: 0 },
        typeC: { count: 0, total: 0, commission: 0 },
      },
      byCategory: [],
      byPaymentMethod: {
        cash: { count: 0, total: 0 },
        card: { count: 0, total: 0 },
      },
    };

    for (const apt of appointments || []) {
      // Extract nested data (handle Supabase arrays)
      const booking = Array.isArray(apt.booking_group)
        ? apt.booking_group[0]
        : apt.booking_group;
      const service = Array.isArray(apt.service) ? apt.service[0] : apt.service;
      const category = service?.category
        ? Array.isArray(service.category)
          ? service.category[0]
          : service.category
        : null;

      if (!booking) continue;

      const date = booking.booking_date;
      const clientType = booking.client_type as ClientType | null;
      const price = apt.price || 0;
      const paymentMethod = paymentsByBooking[booking.id] || 'pending';

      // Get or create daily report
      if (!dailyMap.has(date)) {
        const dateObj = new Date(date + 'T00:00:00');
        dailyMap.set(date, {
          date,
          dateFormatted: dateObj.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
          dayOfWeek: dateObj.toLocaleDateString('en-AU', { weekday: 'long' }),
          entries: [],
          summary: createEmptyDailySummary(),
        });
      }

      const dailyReport = dailyMap.get(date)!;

      // Create entry
      const entry: DailyServiceEntry = {
        id: apt.id,
        date,
        time: apt.start_time?.substring(0, 5) || '',
        categoryId: category?.id || 'uncategorized',
        categoryName: category?.name || 'Uncategorized',
        categoryColor: category?.color || '#gray',
        serviceName: apt.service_name || service?.name || 'Unknown Service',
        clientType,
        price,
        paymentMethod,
        clientName:
          `${booking.guest_first_name || ''} ${
            booking.guest_last_name || ''
          }`.trim() || 'Walk-in',
        notes: apt.notes,
      };

      dailyReport.entries.push(entry);

      // Update daily summary
      dailyReport.summary.totalCount++;
      dailyReport.summary.totalAmount += price;

      // Calculate commission based on client type using getCommissionRate helper
      const commissionRate = clientType ? getCommissionRate(clientType) : 0;
      const commission = price * commissionRate;
      dailyReport.summary.commission += commission;

      // Update client type counts
      if (clientType === 'A') {
        dailyReport.summary.typeA.count++;
        dailyReport.summary.typeA.total += price;
        periodSummary.byClientType.typeA.count++;
        periodSummary.byClientType.typeA.total += price;
        periodSummary.byClientType.typeA.commission += commission;
      } else if (clientType === 'B') {
        dailyReport.summary.typeB.count++;
        dailyReport.summary.typeB.total += price;
        periodSummary.byClientType.typeB.count++;
        periodSummary.byClientType.typeB.total += price;
        periodSummary.byClientType.typeB.commission += commission;
      } else if (clientType === 'B+') {
        dailyReport.summary.typeBPlus.count++;
        dailyReport.summary.typeBPlus.total += price;
        periodSummary.byClientType.typeBPlus.count++;
        periodSummary.byClientType.typeBPlus.total += price;
        periodSummary.byClientType.typeBPlus.commission += commission;
      } else if (clientType === 'C') {
        dailyReport.summary.typeC.count++;
        dailyReport.summary.typeC.total += price;
        periodSummary.byClientType.typeC.count++;
        periodSummary.byClientType.typeC.total += price;
        periodSummary.byClientType.typeC.commission += commission;
      }

      // Update payment method summary
      if (paymentMethod === 'cash') {
        dailyReport.summary.cash.count++;
        dailyReport.summary.cash.total += price;
        periodSummary.byPaymentMethod.cash.count++;
        periodSummary.byPaymentMethod.cash.total += price;
      } else if (paymentMethod === 'card') {
        dailyReport.summary.card.count++;
        dailyReport.summary.card.total += price;
        periodSummary.byPaymentMethod.card.count++;
        periodSummary.byPaymentMethod.card.total += price;
      }

      // Update category summary
      const categoryKey = category?.id || 'uncategorized';
      if (!categorySummaryMap.has(categoryKey)) {
        categorySummaryMap.set(categoryKey, {
          categoryId: categoryKey,
          categoryName: category?.name || 'Uncategorized',
          categoryColor: category?.color || '#gray',
          typeA: { count: 0, total: 0 },
          typeB: { count: 0, total: 0 },
          typeBPlus: { count: 0, total: 0 },
          typeC: { count: 0, total: 0 },
          total: { count: 0, total: 0 },
          commission: 0,
        });
      }

      const catSummary = categorySummaryMap.get(categoryKey)!;
      catSummary.total.count++;
      catSummary.total.total += price;
      catSummary.commission += commission;

      if (clientType === 'A') {
        catSummary.typeA.count++;
        catSummary.typeA.total += price;
      } else if (clientType === 'B') {
        catSummary.typeB.count++;
        catSummary.typeB.total += price;
      } else if (clientType === 'B+') {
        catSummary.typeBPlus.count++;
        catSummary.typeBPlus.total += price;
      } else if (clientType === 'C') {
        catSummary.typeC.count++;
        catSummary.typeC.total += price;
      }

      // Update period totals
      periodSummary.totalSales += price;
      periodSummary.totalCommission += commission;
      periodSummary.totalServices++;
    }

    // Sort daily reports by date
    const dailyReports = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Sort entries within each day by time
    for (const report of dailyReports) {
      report.entries.sort((a, b) => a.time.localeCompare(b.time));
    }

    // Convert category summary map to array
    periodSummary.byCategory = Array.from(categorySummaryMap.values()).sort(
      (a, b) => b.total.total - a.total.total
    );

    // Determine period type
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const daysDiff = Math.ceil(
      (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );

    let periodType: 'daily' | 'weekly' | 'monthly' = 'daily';
    if (daysDiff <= 1) {
      periodType = 'daily';
    } else if (daysDiff <= 7) {
      periodType = 'weekly';
    } else {
      periodType = 'monthly';
    }

    return {
      success: true,
      data: {
        teamMemberId,
        teamMemberName: `${teamMember.first_name} ${
          teamMember.last_name || ''
        }`.trim(),
        startDate,
        endDate,
        periodType,
        dailyReports,
        periodSummary,
        commissionRates: COMMISSION_RATES,
      },
    };
  } catch (error) {
    console.error('Error generating commission report:', error);
    return { success: false, error: 'Failed to generate commission report' };
  }
}

// =====================================================
// GET TEAM MEMBER COMMISSION RATES
// =====================================================

export async function getTeamMemberCommissionRates(): Promise<{
  success: boolean;
  data?: CommissionRates;
  error?: string;
}> {
  try {
    await requireAdmin();

    // Return the rates from CLIENT_TYPE_CONFIG
    return {
      success: true,
      data: COMMISSION_RATES,
    };
  } catch (error) {
    console.error('Error fetching commission rates:', error);
    return { success: false, error: 'Failed to fetch commission rates' };
  }
}

// =====================================================
// EXPORT COMMISSION REPORT TO CSV
// =====================================================

export async function exportCommissionReportCSV(
  teamMemberId: string,
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  try {
    const reportResult = await getCommissionReport(
      teamMemberId,
      startDate,
      endDate
    );

    if (!reportResult.success || !reportResult.data) {
      return { success: false, error: reportResult.error };
    }

    const report = reportResult.data;
    const lines: string[] = [];

    // Header
    lines.push(`Commission Report - ${report.teamMemberName}`);
    lines.push(`Period: ${report.startDate} to ${report.endDate}`);
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push(`Total Sales,$${report.periodSummary.totalSales.toFixed(2)}`);
    lines.push(
      `Total Commission,$${report.periodSummary.totalCommission.toFixed(2)}`
    );
    lines.push(`Total Services,${report.periodSummary.totalServices}`);
    lines.push('');

    // By Client Type
    lines.push('BY CLIENT TYPE');
    lines.push('Type,Count,Sales,Rate,Commission');
    lines.push(
      `A (New),${
        report.periodSummary.byClientType.typeA.count
      },$${report.periodSummary.byClientType.typeA.total.toFixed(
        2
      )},${Math.round(
        COMMISSION_RATES.A * 100
      )}%,$${report.periodSummary.byClientType.typeA.commission.toFixed(2)}`
    );
    lines.push(
      `B (Regular),${
        report.periodSummary.byClientType.typeB.count
      },$${report.periodSummary.byClientType.typeB.total.toFixed(
        2
      )},${Math.round(
        COMMISSION_RATES.B * 100
      )}%,$${report.periodSummary.byClientType.typeB.commission.toFixed(2)}`
    );
    lines.push(
      `B+ (Requested),${
        report.periodSummary.byClientType.typeBPlus.count
      },$${report.periodSummary.byClientType.typeBPlus.total.toFixed(
        2
      )},${Math.round(
        COMMISSION_RATES['B+'] * 100
      )}%,$${report.periodSummary.byClientType.typeBPlus.commission.toFixed(2)}`
    );
    lines.push(
      `C (Salon),${
        report.periodSummary.byClientType.typeC.count
      },$${report.periodSummary.byClientType.typeC.total.toFixed(
        2
      )},${Math.round(
        COMMISSION_RATES.C * 100
      )}%,$${report.periodSummary.byClientType.typeC.commission.toFixed(2)}`
    );
    lines.push('');

    // By Category
    lines.push('BY CATEGORY');
    lines.push(
      'Category,A Count,A $,B Count,B $,B+ Count,B+ $,C Count,C $,Total Count,Total $,Commission'
    );
    for (const cat of report.periodSummary.byCategory) {
      lines.push(
        `${cat.categoryName},${cat.typeA.count},$${cat.typeA.total.toFixed(
          2
        )},${cat.typeB.count},$${cat.typeB.total.toFixed(2)},${
          cat.typeBPlus.count
        },$${cat.typeBPlus.total.toFixed(2)},${
          cat.typeC.count
        },$${cat.typeC.total.toFixed(2)},${
          cat.total.count
        },$${cat.total.total.toFixed(2)},$${cat.commission.toFixed(2)}`
      );
    }
    lines.push('');

    // Daily Details
    lines.push('DAILY DETAILS');
    lines.push(
      'Date,Time,Category,Service,Client Type,Client Name,Price,Payment,Commission'
    );
    for (const day of report.dailyReports) {
      for (const entry of day.entries) {
        const rate = entry.clientType ? getCommissionRate(entry.clientType) : 0;
        const commission = entry.price * rate;
        lines.push(
          `${day.dateFormatted},${entry.time},${entry.categoryName},${
            entry.serviceName
          },${entry.clientType || '-'},${
            entry.clientName
          },$${entry.price.toFixed(2)},${
            entry.paymentMethod
          },$${commission.toFixed(2)}`
        );
      }
    }

    return {
      success: true,
      data: lines.join('\n'),
    };
  } catch (error) {
    console.error('Error exporting commission report:', error);
    return { success: false, error: 'Failed to export commission report' };
  }
}
