// app/actions/staff-pay-rates.ts
'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAuth, requireAdmin } from '@/lib/auth';

// =====================================================
// TYPES
// =====================================================

interface DefaultPayRates {
  id: string;
  weekday_rate: number;
  saturday_rate: number;
  sunday_rate: number;
  public_holiday_rate: number;
  paid_break_minutes: number;
  updated_at: string;
}

interface CustomPayRates {
  id: string;
  team_member_id: string;
  weekday_rate: number | null;
  saturday_rate: number | null;
  sunday_rate: number | null;
  public_holiday_rate: number | null;
  paid_break_minutes: number | null;
  notes: string | null;
  updated_at: string;
  users: {
    first_name: string;
    last_name: string | null;
  };
}

interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  is_recurring: boolean;
  created_at: string;
}

interface PayrollEntry {
  team_member_id: string;
  shift_date: string;
  total_hours: number;
  total_paid_hours: number;
  users: {
    id: string;
    first_name: string;
    last_name: string | null;
  };
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

// Commission types
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

// Commission rates from client type config
const COMMISSION_RATES = {
  A: 0.3, // 30%
  B: 0.4, // 40%
  'B+': 0.4, // 40%
  C: 0.3, // 30%
};

// =====================================================
// GET DEFAULT PAY RATES
// =====================================================
export async function getDefaultPayRates(): Promise<{
  success: boolean;
  data?: DefaultPayRates;
  error?: string;
}> {
  try {
    await requireAuth();

    const { data, error } = await supabaseAdmin
      .from('staff_default_pay_rates')
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Get default pay rates error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get default pay rates',
    };
  }
}

// =====================================================
// UPDATE DEFAULT PAY RATES
// =====================================================
export async function updateDefaultPayRates(updates: {
  weekday_rate?: number;
  saturday_rate?: number;
  sunday_rate?: number;
  public_holiday_rate?: number;
  paid_break_minutes?: number;
}) {
  try {
    const { supabaseUserId } = await requireAdmin();

    const rates = [
      updates.weekday_rate,
      updates.saturday_rate,
      updates.sunday_rate,
      updates.public_holiday_rate,
    ].filter((r) => r !== undefined);
    if (rates.some((r) => r! < 0))
      return { success: false, error: 'Pay rates must be positive' };
    if (
      updates.paid_break_minutes !== undefined &&
      updates.paid_break_minutes < 0
    ) {
      return { success: false, error: 'Paid break minutes must be positive' };
    }

    const { error } = await supabaseAdmin
      .from('staff_default_pay_rates')
      .update({ ...updates, updated_by: supabaseUserId })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Update default pay rates error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update default pay rates',
    };
  }
}

// =====================================================
// GET CUSTOM PAY RATES
// =====================================================
export async function getCustomPayRates(teamMemberId?: string): Promise<{
  success: boolean;
  data?: CustomPayRates | CustomPayRates[];
  error?: string;
}> {
  try {
    await requireAdmin();

    let query = supabaseAdmin
      .from('staff_pay_rates')
      .select(
        `*, users!staff_pay_rates_team_member_id_fkey(first_name, last_name)`
      )
      .order('created_at', { ascending: false });

    if (teamMemberId) {
      query = query.eq('team_member_id', teamMemberId);
      const { data, error } = await query.single();
      if (error && error.code !== 'PGRST116') throw error;
      const typedData = data as unknown as CustomPayRates;
      return { success: true, data: typedData || undefined };
    } else {
      const { data, error } = await query;
      if (error) throw error;
      const typedData = data as unknown as CustomPayRates[];
      return { success: true, data: typedData || [] };
    }
  } catch (error) {
    console.error('Get custom pay rates error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get custom pay rates',
    };
  }
}

// =====================================================
// UPSERT CUSTOM PAY RATES
// =====================================================
export async function upsertCustomPayRates(
  teamMemberId: string,
  rates: {
    weekday_rate?: number | null;
    saturday_rate?: number | null;
    sunday_rate?: number | null;
    public_holiday_rate?: number | null;
    paid_break_minutes?: number | null;
    notes?: string | null;
  }
) {
  try {
    const { supabaseUserId } = await requireAdmin();

    const rateValues = [
      rates.weekday_rate,
      rates.saturday_rate,
      rates.sunday_rate,
      rates.public_holiday_rate,
    ].filter((r) => r !== null && r !== undefined);
    if (rateValues.some((r) => r! < 0))
      return { success: false, error: 'Pay rates must be positive' };
    if (
      rates.paid_break_minutes !== null &&
      rates.paid_break_minutes !== undefined &&
      rates.paid_break_minutes < 0
    ) {
      return { success: false, error: 'Paid break minutes must be positive' };
    }

    const { data: existing } = await supabaseAdmin
      .from('staff_pay_rates')
      .select('id')
      .eq('team_member_id', teamMemberId)
      .single();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('staff_pay_rates')
        .update({ ...rates, updated_by: supabaseUserId })
        .eq('team_member_id', teamMemberId);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('staff_pay_rates').insert({
        team_member_id: teamMemberId,
        ...rates,
        updated_by: supabaseUserId,
      });
      if (error) throw error;
    }

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Upsert custom pay rates error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update custom pay rates',
    };
  }
}

// =====================================================
// DELETE CUSTOM PAY RATES
// =====================================================
export async function deleteCustomPayRates(teamMemberId: string) {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin
      .from('staff_pay_rates')
      .delete()
      .eq('team_member_id', teamMemberId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Delete custom pay rates error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete custom pay rates',
    };
  }
}

// =====================================================
// GET PUBLIC HOLIDAYS
// =====================================================
export async function getPublicHolidays(year?: number): Promise<{
  success: boolean;
  data?: PublicHoliday[];
  error?: string;
}> {
  try {
    await requireAuth();

    const baseQuery = supabaseAdmin
      .from('public_holidays')
      .select('*')
      .order('date', { ascending: true });

    const { data, error } = year
      ? await baseQuery
          .gte('date', `${year}-01-01`)
          .lte('date', `${year}-12-31`)
      : await baseQuery;

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Get public holidays error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get public holidays',
    };
  }
}

// =====================================================
// ADD PUBLIC HOLIDAY
// =====================================================
export async function addPublicHoliday(holiday: {
  date: string;
  name: string;
  is_recurring?: boolean;
}) {
  try {
    const { supabaseUserId } = await requireAdmin();

    const { error } = await supabaseAdmin.from('public_holidays').insert({
      date: holiday.date,
      name: holiday.name,
      is_recurring: holiday.is_recurring || false,
      created_by: supabaseUserId,
    });

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Add public holiday error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to add public holiday',
    };
  }
}

// =====================================================
// UPDATE PUBLIC HOLIDAY
// =====================================================
export async function updatePublicHoliday(
  holidayId: string,
  updates: {
    date?: string;
    name?: string;
    is_recurring?: boolean;
  }
) {
  try {
    const { supabaseUserId } = await requireAdmin();

    const { error } = await supabaseAdmin
      .from('public_holidays')
      .update({ ...updates, updated_by: supabaseUserId })
      .eq('id', holidayId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Update public holiday error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update public holiday',
    };
  }
}

// =====================================================
// DELETE PUBLIC HOLIDAY
// =====================================================
export async function deletePublicHoliday(holidayId: string) {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin
      .from('public_holidays')
      .delete()
      .eq('id', holidayId);

    if (error) throw error;

    revalidatePath('/admin/staff-management');
    return { success: true };
  } catch (error) {
    console.error('Delete public holiday error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to delete public holiday',
    };
  }
}

// =====================================================
// CHECK IF PUBLIC HOLIDAY
// =====================================================
export async function checkIsPublicHoliday(date: string): Promise<{
  success: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  error?: string;
}> {
  try {
    await requireAuth();

    const { data, error } = await supabaseAdmin
      .from('public_holidays')
      .select('name')
      .eq('date', date)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return { success: true, isHoliday: !!data, holidayName: data?.name };
  } catch (error) {
    console.error('Check public holiday error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to check public holiday',
    };
  }
}

// =====================================================
// CALCULATE PAYROLL
// =====================================================
export async function calculatePayroll(
  startDate: string,
  endDate: string,
  teamMemberId?: string
): Promise<{
  success: boolean;
  data?: PayrollItem[];
  error?: string;
}> {
  try {
    await requireAdmin();

    let query = supabaseAdmin
      .from('staff_time_entries')
      .select(
        `*, users!staff_time_entries_team_member_id_fkey(id, first_name, last_name)`
      )
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .eq('status', 'completed')
      .not('total_paid_hours', 'is', null);

    if (teamMemberId) query = query.eq('team_member_id', teamMemberId);

    const { data: entries, error } = await query;
    if (error) throw error;

    const typedEntries = entries as unknown as PayrollEntry[];
    const payrollMap = new Map<string, PayrollItem>();

    for (const entry of typedEntries || []) {
      const key = entry.team_member_id;

      if (!payrollMap.has(key)) {
        payrollMap.set(key, {
          team_member_id: entry.team_member_id,
          team_member_name: `${entry.users.first_name} ${
            entry.users.last_name || ''
          }`.trim(),
          total_hours: 0,
          total_paid_hours: 0,
          weekday_hours: 0,
          saturday_hours: 0,
          sunday_hours: 0,
          public_holiday_hours: 0,
          total_pay: 0,
          entries_count: 0,
        });
      }

      const payroll = payrollMap.get(key)!;

      const { data: rates } = await supabaseAdmin.rpc(
        'get_effective_pay_rate',
        {
          p_team_member_id: entry.team_member_id,
          p_date: entry.shift_date,
        }
      );

      const { data: isHoliday } = await supabaseAdmin.rpc('is_public_holiday', {
        p_date: entry.shift_date,
      });

      const dayOfWeek = new Date(entry.shift_date + 'T00:00:00Z').getUTCDay();
      const paidHours = entry.total_paid_hours || 0;

      let rate = rates?.[0]?.weekday_rate || 25;
      let hoursCategory:
        | 'weekday_hours'
        | 'saturday_hours'
        | 'sunday_hours'
        | 'public_holiday_hours' = 'weekday_hours';

      if (isHoliday) {
        rate = rates?.[0]?.public_holiday_rate || 50;
        hoursCategory = 'public_holiday_hours';
      } else if (dayOfWeek === 0) {
        rate = rates?.[0]?.sunday_rate || 35;
        hoursCategory = 'sunday_hours';
      } else if (dayOfWeek === 6) {
        rate = rates?.[0]?.saturday_rate || 30;
        hoursCategory = 'saturday_hours';
      }

      payroll.total_hours += entry.total_hours || 0;
      payroll.total_paid_hours += paidHours;
      payroll[hoursCategory] += paidHours;
      payroll.total_pay += paidHours * rate;
      payroll.entries_count += 1;
    }

    const payrollData = Array.from(payrollMap.values());
    return { success: true, data: payrollData };
  } catch (error) {
    console.error('Calculate payroll error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to calculate payroll',
    };
  }
}

// =====================================================
// CALCULATE COMMISSION FOR PAYROLL
// =====================================================
export async function calculateCommissionForPayroll(
  startDate: string,
  endDate: string,
  teamMemberId?: string
): Promise<{
  success: boolean;
  data?: CommissionSummary[];
  error?: string;
}> {
  try {
    await requireAdmin();

    // Build query to get appointments with team member info
    let query = supabaseAdmin
      .from('appointments')
      .select(
        `
        id,
        team_member_id,
        price,
        status,
        booking_group:booking_groups!inner (
          id,
          booking_date,
          client_type,
          status
        )
      `
      )
      .gte('booking_group.booking_date', startDate)
      .lte('booking_group.booking_date', endDate)
      .in('status', ['confirmed', 'completed'])
      .in('booking_group.status', ['confirmed', 'completed']);

    if (teamMemberId) {
      query = query.eq('team_member_id', teamMemberId);
    }

    const { data: appointments, error } = await query;
    if (error) throw error;

    // Get team member names
    const teamMemberIds = [
      ...new Set((appointments || []).map((a) => a.team_member_id)),
    ];

    const teamMemberNames: Record<string, string> = {};

    if (teamMemberIds.length > 0) {
      const { data: members } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name')
        .in('id', teamMemberIds);

      for (const m of members || []) {
        teamMemberNames[m.id] = `${m.first_name} ${m.last_name || ''}`.trim();
      }
    }

    // Process appointments into commission summaries
    const commissionMap = new Map<string, CommissionSummary>();

    for (const appt of appointments || []) {
      const key = appt.team_member_id;
      const booking = Array.isArray(appt.booking_group)
        ? appt.booking_group[0]
        : appt.booking_group;
      const clientType = booking?.client_type as 'A' | 'B' | 'B+' | 'C' | null;
      const price = appt.price || 0;

      if (!commissionMap.has(key)) {
        commissionMap.set(key, {
          team_member_id: key,
          team_member_name: teamMemberNames[key] || 'Unknown',
          total_services: 0,
          total_sales: 0,
          total_commission: 0,
          by_client_type: {
            typeA: { count: 0, sales: 0, commission: 0 },
            typeB: { count: 0, sales: 0, commission: 0 },
            typeBPlus: { count: 0, sales: 0, commission: 0 },
            typeC: { count: 0, sales: 0, commission: 0 },
          },
        });
      }

      const summary = commissionMap.get(key)!;
      summary.total_services++;
      summary.total_sales += price;

      // Calculate commission based on client type
      const rate = clientType ? COMMISSION_RATES[clientType] : 0;
      const commission = price * rate;
      summary.total_commission += commission;

      // Update client type breakdown
      if (clientType === 'A') {
        summary.by_client_type.typeA.count++;
        summary.by_client_type.typeA.sales += price;
        summary.by_client_type.typeA.commission += commission;
      } else if (clientType === 'B') {
        summary.by_client_type.typeB.count++;
        summary.by_client_type.typeB.sales += price;
        summary.by_client_type.typeB.commission += commission;
      } else if (clientType === 'B+') {
        summary.by_client_type.typeBPlus.count++;
        summary.by_client_type.typeBPlus.sales += price;
        summary.by_client_type.typeBPlus.commission += commission;
      } else if (clientType === 'C') {
        summary.by_client_type.typeC.count++;
        summary.by_client_type.typeC.sales += price;
        summary.by_client_type.typeC.commission += commission;
      }
    }

    const commissionData = Array.from(commissionMap.values());
    return { success: true, data: commissionData };
  } catch (error) {
    console.error('Calculate commission error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to calculate commission',
    };
  }
}
