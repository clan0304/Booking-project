// app/actions/admin-dashboard.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

// =====================================================
// TYPES
// =====================================================

export interface DailySalesData {
  date: string;
  dayLabel: string;
  sales: number;
  appointmentsValue: number;
  appointmentsCount: number;
}

export interface DailyAppointmentsData {
  date: string;
  dayLabel: string;
  confirmed: number;
  cancelled: number;
}

export interface TopServiceData {
  serviceName: string;
  thisMonth: number;
  lastMonth: number;
}

export interface TopTeamMemberData {
  teamMemberId: string;
  teamMemberName: string;
  thisMonth: number;
  lastMonth: number;
}

export interface RecentSalesResult {
  totalSales: number;
  totalAppointments: number;
  appointmentsValue: number;
  dailyData: DailySalesData[];
}

export interface UpcomingAppointmentsResult {
  totalBooked: number;
  confirmedCount: number;
  cancelledCount: number;
  dailyData: DailyAppointmentsData[];
}

// =====================================================
// HELPERS
// =====================================================

function formatDayLabel(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[date.getDay()];
  const dayNum = date.getDate();
  return `${day} ${dayNum}`;
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// =====================================================
// GET RECENT SALES (Last 7 days)
// =====================================================

export async function getRecentSales(): Promise<{
  success: boolean;
  data?: RecentSalesResult;
  error?: string;
}> {
  try {
    await requireStaff();

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Include today = 7 days

    const startDate = getDateString(sevenDaysAgo);
    const endDate = getDateString(today);

    // Melbourne timezone
    const startOfRangeUTC = `${startDate}T00:00:00+11:00`;
    const endOfRangeUTC = `${endDate}T23:59:59.999+11:00`;

    // Get transactions (actual payments)
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, created_at')
      .gte('created_at', startOfRangeUTC)
      .lte('created_at', endOfRangeUTC)
      .in('status', ['succeeded', 'partially_refunded']);

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return { success: false, error: 'Failed to fetch sales data' };
    }

    // Get appointments (booked appointments value)
    const { data: appointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select(
        `
        id,
        price,
        booking_groups!inner(booking_date)
      `
      )
      .gte('booking_groups.booking_date', startDate)
      .lte('booking_groups.booking_date', endDate)
      .in('status', ['confirmed', 'completed']);

    if (apptError) {
      console.error('Error fetching appointments:', apptError);
    }

    // Build daily data
    const dailyData: DailySalesData[] = [];
    let totalSales = 0;
    let totalAppointments = 0;
    let appointmentsValue = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const dateStr = getDateString(date);

      // Calculate sales for this day
      const daySales = (transactions || [])
        .filter((tx) => tx.created_at.startsWith(dateStr))
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      // Calculate appointments for this day
      const dayAppointments = (appointments || []).filter((appt) => {
        const bg = appt.booking_groups as unknown as { booking_date: string };
        return bg?.booking_date === dateStr;
      });

      const dayApptCount = dayAppointments.length;
      const dayApptValue = dayAppointments.reduce(
        (sum, appt) => sum + (Number(appt.price) || 0),
        0
      );

      dailyData.push({
        date: dateStr,
        dayLabel: formatDayLabel(date),
        sales: daySales,
        appointmentsValue: dayApptValue,
        appointmentsCount: dayApptCount,
      });

      totalSales += daySales;
      totalAppointments += dayApptCount;
      appointmentsValue += dayApptValue;
    }

    return {
      success: true,
      data: {
        totalSales,
        totalAppointments,
        appointmentsValue,
        dailyData,
      },
    };
  } catch (error) {
    console.error('Get recent sales error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get sales data',
    };
  }
}

// =====================================================
// GET UPCOMING APPOINTMENTS (Next 7 days)
// =====================================================

export async function getUpcomingAppointments(): Promise<{
  success: boolean;
  data?: UpcomingAppointmentsResult;
  error?: string;
}> {
  try {
    await requireStaff();

    const today = new Date();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 6); // Include today = 7 days

    const startDate = getDateString(today);
    const endDate = getDateString(sevenDaysLater);

    // Get booking groups with appointments
    const { data: bookingGroups, error: bgError } = await supabaseAdmin
      .from('booking_groups')
      .select(
        `
        id,
        booking_date,
        status,
        appointments(id, status)
      `
      )
      .gte('booking_date', startDate)
      .lte('booking_date', endDate);

    if (bgError) {
      console.error('Error fetching booking groups:', bgError);
      return { success: false, error: 'Failed to fetch appointments data' };
    }

    // Build daily data
    const dailyData: DailyAppointmentsData[] = [];
    let confirmedCount = 0;
    let cancelledCount = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = getDateString(date);

      // Get appointments for this day
      const dayBookings = (bookingGroups || []).filter(
        (bg) => bg.booking_date === dateStr
      );

      let dayConfirmed = 0;
      let dayCancelled = 0;

      for (const booking of dayBookings) {
        const appointments = booking.appointments as Array<{
          id: string;
          status: string;
        }>;

        // ✅ FIX: Check if booking itself is cancelled (handles legacy data where
        // individual appointments weren't updated when booking was cancelled)
        const isBookingCancelled =
          booking.status === 'cancelled' ||
          booking.status === 'fully_cancelled' ||
          booking.status === 'no_show';

        for (const appt of appointments || []) {
          // If booking is cancelled, count all its appointments as cancelled
          // regardless of individual appointment status
          if (isBookingCancelled) {
            dayCancelled++;
          } else if (
            appt.status === 'confirmed' ||
            appt.status === 'completed'
          ) {
            dayConfirmed++;
          } else if (appt.status === 'cancelled' || appt.status === 'no_show') {
            dayCancelled++;
          }
        }
      }

      dailyData.push({
        date: dateStr,
        dayLabel: formatDayLabel(date),
        confirmed: dayConfirmed,
        cancelled: dayCancelled,
      });

      confirmedCount += dayConfirmed;
      cancelledCount += dayCancelled;
    }

    return {
      success: true,
      data: {
        totalBooked: confirmedCount + cancelledCount,
        confirmedCount,
        cancelledCount,
        dailyData,
      },
    };
  } catch (error) {
    console.error('Get upcoming appointments error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get appointments data',
    };
  }
}

// =====================================================
// GET TOP SERVICES (This month vs Last month - from PAID transactions)
// =====================================================

export async function getTopServices(): Promise<{
  success: boolean;
  data?: TopServiceData[];
  error?: string;
}> {
  try {
    await requireStaff();

    const today = new Date();

    // This month range
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Last month range
    const lastMonthStart = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // Melbourne timezone
    const thisMonthStartUTC = `${getDateString(thisMonthStart)}T00:00:00+11:00`;
    const thisMonthEndUTC = `${getDateString(thisMonthEnd)}T23:59:59.999+11:00`;
    const lastMonthStartUTC = `${getDateString(lastMonthStart)}T00:00:00+11:00`;
    const lastMonthEndUTC = `${getDateString(lastMonthEnd)}T23:59:59.999+11:00`;

    // Get this month PAID service items from transactions
    const { data: thisMonthItems, error: thisError } = await supabaseAdmin
      .from('transaction_items')
      .select(
        `
        item_name,
        quantity,
        transactions!inner(created_at, status)
      `
      )
      .eq('item_type', 'appointment')
      .gte('transactions.created_at', thisMonthStartUTC)
      .lte('transactions.created_at', thisMonthEndUTC)
      .in('transactions.status', ['succeeded', 'partially_refunded']);

    if (thisError) {
      console.error('Error fetching this month services:', thisError);
    }

    // Get last month PAID service items from transactions
    const { data: lastMonthItems, error: lastError } = await supabaseAdmin
      .from('transaction_items')
      .select(
        `
        item_name,
        quantity,
        transactions!inner(created_at, status)
      `
      )
      .eq('item_type', 'appointment')
      .gte('transactions.created_at', lastMonthStartUTC)
      .lte('transactions.created_at', lastMonthEndUTC)
      .in('transactions.status', ['succeeded', 'partially_refunded']);

    if (lastError) {
      console.error('Error fetching last month services:', lastError);
    }

    // Count services this month
    const thisMonthCounts: Record<string, number> = {};
    for (const item of thisMonthItems || []) {
      const name = item.item_name || 'Unknown';
      thisMonthCounts[name] =
        (thisMonthCounts[name] || 0) + (item.quantity || 1);
    }

    // Count services last month
    const lastMonthCounts: Record<string, number> = {};
    for (const item of lastMonthItems || []) {
      const name = item.item_name || 'Unknown';
      lastMonthCounts[name] =
        (lastMonthCounts[name] || 0) + (item.quantity || 1);
    }

    // Combine and sort by this month count
    const allServices = new Set([
      ...Object.keys(thisMonthCounts),
      ...Object.keys(lastMonthCounts),
    ]);

    const topServices: TopServiceData[] = Array.from(allServices)
      .map((serviceName) => ({
        serviceName,
        thisMonth: thisMonthCounts[serviceName] || 0,
        lastMonth: lastMonthCounts[serviceName] || 0,
      }))
      .sort((a, b) => b.thisMonth - a.thisMonth)
      .slice(0, 5);

    return { success: true, data: topServices };
  } catch (error) {
    console.error('Get top services error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get top services',
    };
  }
}

// =====================================================
// GET TOP TEAM MEMBERS (This month vs Last month - from PAID transactions)
// =====================================================

export async function getTopTeamMembers(): Promise<{
  success: boolean;
  data?: TopTeamMemberData[];
  error?: string;
}> {
  try {
    await requireStaff();

    const today = new Date();

    // This month range
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Last month range
    const lastMonthStart = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // Melbourne timezone
    const thisMonthStartUTC = `${getDateString(thisMonthStart)}T00:00:00+11:00`;
    const thisMonthEndUTC = `${getDateString(thisMonthEnd)}T23:59:59.999+11:00`;
    const lastMonthStartUTC = `${getDateString(lastMonthStart)}T00:00:00+11:00`;
    const lastMonthEndUTC = `${getDateString(lastMonthEnd)}T23:59:59.999+11:00`;

    // Get this month PAID service items with appointment details
    const { data: thisMonthItems, error: thisError } = await supabaseAdmin
      .from('transaction_items')
      .select(
        `
        item_id,
        total_price,
        transactions!inner(created_at, status)
      `
      )
      .eq('item_type', 'appointment')
      .not('item_id', 'is', null)
      .gte('transactions.created_at', thisMonthStartUTC)
      .lte('transactions.created_at', thisMonthEndUTC)
      .in('transactions.status', ['succeeded', 'partially_refunded']);

    if (thisError) {
      console.error('Error fetching this month items:', thisError);
    }

    // Get last month PAID service items
    const { data: lastMonthItems, error: lastError } = await supabaseAdmin
      .from('transaction_items')
      .select(
        `
        item_id,
        total_price,
        transactions!inner(created_at, status)
      `
      )
      .eq('item_type', 'appointment')
      .not('item_id', 'is', null)
      .gte('transactions.created_at', lastMonthStartUTC)
      .lte('transactions.created_at', lastMonthEndUTC)
      .in('transactions.status', ['succeeded', 'partially_refunded']);

    if (lastError) {
      console.error('Error fetching last month items:', lastError);
    }

    // Collect all appointment IDs to fetch team member info
    const allAppointmentIds = new Set<string>();
    for (const item of [...(thisMonthItems || []), ...(lastMonthItems || [])]) {
      if (item.item_id) {
        allAppointmentIds.add(item.item_id);
      }
    }

    // Get appointments with team member IDs
    const appointmentTeamMembers: Record<string, string> = {};
    if (allAppointmentIds.size > 0) {
      const { data: appointments } = await supabaseAdmin
        .from('appointments')
        .select('id, team_member_id')
        .in('id', Array.from(allAppointmentIds));

      for (const appt of appointments || []) {
        if (appt.team_member_id) {
          appointmentTeamMembers[appt.id] = appt.team_member_id;
        }
      }
    }

    // Get unique team member IDs
    const teamMemberIds = new Set<string>(
      Object.values(appointmentTeamMembers)
    );

    // Get team member names
    const { data: teamMembers } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name')
      .in('id', Array.from(teamMemberIds));

    const teamMemberNames: Record<string, string> = {};
    for (const tm of teamMembers || []) {
      teamMemberNames[tm.id] =
        `${tm.first_name || ''}${
          tm.last_name ? ' ' + tm.last_name : ''
        }`.trim() || 'Unknown';
    }

    // Calculate sales this month by team member
    const thisMonthSales: Record<string, number> = {};
    for (const item of thisMonthItems || []) {
      if (item.item_id) {
        const teamMemberId = appointmentTeamMembers[item.item_id];
        if (teamMemberId) {
          thisMonthSales[teamMemberId] =
            (thisMonthSales[teamMemberId] || 0) +
            (Number(item.total_price) || 0);
        }
      }
    }

    // Calculate sales last month by team member
    const lastMonthSales: Record<string, number> = {};
    for (const item of lastMonthItems || []) {
      if (item.item_id) {
        const teamMemberId = appointmentTeamMembers[item.item_id];
        if (teamMemberId) {
          lastMonthSales[teamMemberId] =
            (lastMonthSales[teamMemberId] || 0) +
            (Number(item.total_price) || 0);
        }
      }
    }

    // Combine and sort by this month sales
    const topTeamMembers: TopTeamMemberData[] = Array.from(teamMemberIds)
      .map((id) => ({
        teamMemberId: id,
        teamMemberName: teamMemberNames[id] || 'Unknown',
        thisMonth: thisMonthSales[id] || 0,
        lastMonth: lastMonthSales[id] || 0,
      }))
      .sort((a, b) => b.thisMonth - a.thisMonth)
      .slice(0, 5);

    return { success: true, data: topTeamMembers };
  } catch (error) {
    console.error('Get top team members error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get top team members',
    };
  }
}
