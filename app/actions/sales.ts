// app/actions/sales.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// =====================================================
// TYPES
// =====================================================

export interface TransactionSummaryItem {
  type: string;
  label: string;
  salesQty: number;
  refundQty: number;
  grossTotal: number;
  refundTotal: number;
  netTotal: number;
}

export interface CashMovementItem {
  type: string;
  label: string;
  paymentsCollected: number;
  refundsPaid: number;
  netTotal: number;
}

export interface DailySalesData {
  date: string;
  dateFormatted: string;
  transactionSummary: TransactionSummaryItem[];
  cashMovement: CashMovementItem[];
  totals: {
    grossSales: number;
    totalRefunds: number;
    netSales: number;
    totalPaymentsCollected: number;
    totalRefundsPaid: number;
  };
}

// =====================================================
// GET DAILY SALES
// =====================================================

export async function getDailySales(
  date: string,
  venueId?: string
): Promise<{
  success: boolean;
  data?: DailySalesData;
  error?: string;
}> {
  try {
    await requireAdmin();

    // Format date for display
    const dateObj = new Date(date + 'T00:00:00');
    const dateFormatted = dateObj.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // Melbourne timezone offset: UTC+10 (standard) or UTC+11 (daylight saving)
    // To capture all transactions for a Melbourne "day", we need to query in Melbourne time
    // Convert Melbourne midnight to UTC for query
    // Safe approach: Query a wider range and filter, or use PostgreSQL's timezone functions

    // For Melbourne: date 00:00:00 AEST = date-1 14:00:00 UTC (or 13:00 during DST)
    // We'll query with a buffer and let PostgreSQL handle timezone conversion
    const startOfDayUTC = `${date}T00:00:00+11:00`; // Melbourne time with timezone
    const endOfDayUTC = `${date}T23:59:59.999+11:00`;

    // Get all transactions for the date (in Melbourne timezone)
    let transactionsQuery = supabaseAdmin
      .from('transactions')
      .select(
        `
        id,
        amount,
        tip_amount,
        payment_method,
        status,
        created_at,
        venue_id
      `
      )
      .gte('created_at', startOfDayUTC)
      .lte('created_at', endOfDayUTC)
      .in('status', ['succeeded', 'partially_refunded']);

    if (venueId) {
      transactionsQuery = transactionsQuery.eq('venue_id', venueId);
    }

    const { data: transactions, error: txError } = await transactionsQuery;

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return { success: false, error: 'Failed to fetch transactions' };
    }

    // Get transaction IDs to fetch items
    const transactionIds = (transactions || []).map((t) => t.id);

    // Get transaction items
    let items: Array<{
      transaction_id: string;
      item_type: string;
      item_name: string;
      quantity: number;
      total_price: number;
      refunded_amount: number;
      refund_status: string;
    }> = [];

    if (transactionIds.length > 0) {
      const { data: txItems, error: itemsError } = await supabaseAdmin
        .from('transaction_items')
        .select(
          'transaction_id, item_type, item_name, quantity, total_price, refunded_amount, refund_status'
        )
        .in('transaction_id', transactionIds);

      if (itemsError) {
        console.error('Error fetching transaction items:', itemsError);
      } else {
        items = txItems || [];
      }
    }

    // Get refunds for the date (refunds processed on this day)
    const { data: refunds, error: refundsError } = await supabaseAdmin
      .from('refunds')
      .select(
        `
        id,
        amount,
        status,
        created_at,
        transaction_id,
        transactions!inner(
          venue_id,
          payment_method
        )
      `
      )
      .gte('created_at', startOfDayUTC)
      .lte('created_at', endOfDayUTC)
      .eq('status', 'succeeded');

    if (refundsError) {
      console.error('Error fetching refunds:', refundsError);
    }

    // Filter refunds by venue if needed (transactions is an array from !inner join)
    const filteredRefunds = venueId
      ? (refunds || []).filter((r) => {
          const txArray = r.transactions as unknown as Array<{
            venue_id: string;
            payment_method: string;
          }>;
          const tx = Array.isArray(txArray) ? txArray[0] : txArray;
          return tx?.venue_id === venueId;
        })
      : refunds || [];

    // Build transaction summary
    const summaryMap: Record<string, TransactionSummaryItem> = {
      services: {
        type: 'appointment',
        label: 'Services',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
      products: {
        type: 'product',
        label: 'Products',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
      no_show_fee: {
        type: 'fee',
        label: 'No-show fees',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
      late_cancel_fee: {
        type: 'fee',
        label: 'Late cancellation fees',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
      other: {
        type: 'other',
        label: 'Other',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
    };

    // Track which transactions have items
    const transactionsWithItems = new Set<string>();

    // Process transaction items
    for (const item of items) {
      transactionsWithItems.add(item.transaction_id);

      let key = 'other';

      if (item.item_type === 'appointment') {
        key = 'services';
      } else if (item.item_type === 'product') {
        key = 'products';
      } else if (item.item_type === 'fee') {
        const lowerName = (item.item_name || '').toLowerCase();
        if (lowerName.includes('no-show') || lowerName.includes('no show')) {
          key = 'no_show_fee';
        } else if (lowerName.includes('cancel') || lowerName.includes('late')) {
          key = 'late_cancel_fee';
        }
      }

      summaryMap[key].salesQty += item.quantity;
      summaryMap[key].grossTotal += Number(item.total_price) || 0;

      if (item.refunded_amount && Number(item.refunded_amount) > 0) {
        summaryMap[key].refundQty += 1;
        summaryMap[key].refundTotal += Number(item.refunded_amount);
      }
    }

    // Handle transactions without items (fallback to transaction amount as "other")
    for (const tx of transactions || []) {
      if (!transactionsWithItems.has(tx.id)) {
        // Transaction exists but no items - count as "other" services
        summaryMap.other.salesQty += 1;
        summaryMap.other.grossTotal += Number(tx.amount) || 0;
      }
    }

    // Calculate net totals
    for (const key of Object.keys(summaryMap)) {
      summaryMap[key].netTotal =
        summaryMap[key].grossTotal - summaryMap[key].refundTotal;
    }

    // Build cash movement summary
    const cashMovementMap: Record<string, CashMovementItem> = {
      card: {
        type: 'card',
        label: 'Card',
        paymentsCollected: 0,
        refundsPaid: 0,
        netTotal: 0,
      },
      cash: {
        type: 'cash',
        label: 'Cash',
        paymentsCollected: 0,
        refundsPaid: 0,
        netTotal: 0,
      },
    };

    // Process payments by method
    for (const tx of transactions || []) {
      const amount = Number(tx.amount) || 0;

      if (tx.payment_method === 'cash') {
        cashMovementMap.cash.paymentsCollected += amount;
      } else {
        // card_online, card_terminal, card_saved all count as card
        cashMovementMap.card.paymentsCollected += amount;
      }
    }

    // Process refunds by original payment method
    for (const refund of filteredRefunds) {
      const amount = Number(refund.amount) || 0;
      const txArray = refund.transactions as unknown as Array<{
        venue_id: string;
        payment_method: string;
      }>;
      const tx = Array.isArray(txArray) ? txArray[0] : txArray;

      if (tx?.payment_method === 'cash') {
        cashMovementMap.cash.refundsPaid += amount;
      } else {
        cashMovementMap.card.refundsPaid += amount;
      }
    }

    // Calculate net totals for cash movement
    for (const key of Object.keys(cashMovementMap)) {
      cashMovementMap[key].netTotal =
        cashMovementMap[key].paymentsCollected -
        cashMovementMap[key].refundsPaid;
    }

    // Calculate overall totals
    const grossSales = Object.values(summaryMap).reduce(
      (sum, item) => sum + item.grossTotal,
      0
    );
    const totalRefunds = Object.values(summaryMap).reduce(
      (sum, item) => sum + item.refundTotal,
      0
    );
    const netSales = grossSales - totalRefunds;
    const totalPaymentsCollected = Object.values(cashMovementMap).reduce(
      (sum, item) => sum + item.paymentsCollected,
      0
    );
    const totalRefundsPaid = Object.values(cashMovementMap).reduce(
      (sum, item) => sum + item.refundsPaid,
      0
    );

    return {
      success: true,
      data: {
        date,
        dateFormatted,
        transactionSummary: Object.values(summaryMap),
        cashMovement: Object.values(cashMovementMap),
        totals: {
          grossSales,
          totalRefunds,
          netSales,
          totalPaymentsCollected,
          totalRefundsPaid,
        },
      },
    };
  } catch (error) {
    console.error('Get daily sales error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get sales data',
    };
  }
}

// =====================================================
// GET SALES RANGE (for custom date ranges)
// =====================================================

export async function getSalesRange(
  startDate: string,
  endDate: string,
  venueId?: string
): Promise<{
  success: boolean;
  data?: DailySalesData;
  error?: string;
}> {
  try {
    await requireAdmin();

    // Format date range for display
    const startObj = new Date(startDate + 'T00:00:00');
    const endObj = new Date(endDate + 'T00:00:00');

    const dateFormatted =
      startDate === endDate
        ? startObj.toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : `${startObj.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
          })} - ${endObj.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`;

    // Melbourne timezone: Query with explicit timezone offset
    const startOfRangeUTC = `${startDate}T00:00:00+11:00`;
    const endOfRangeUTC = `${endDate}T23:59:59.999+11:00`;

    // Get all transactions for the date range
    let transactionsQuery = supabaseAdmin
      .from('transactions')
      .select(
        `
        id,
        amount,
        tip_amount,
        payment_method,
        status,
        created_at,
        venue_id
      `
      )
      .gte('created_at', startOfRangeUTC)
      .lte('created_at', endOfRangeUTC)
      .in('status', ['succeeded', 'partially_refunded']);

    if (venueId) {
      transactionsQuery = transactionsQuery.eq('venue_id', venueId);
    }

    const { data: transactions, error: txError } = await transactionsQuery;

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return { success: false, error: 'Failed to fetch transactions' };
    }

    // Get transaction IDs to fetch items
    const transactionIds = (transactions || []).map((t) => t.id);

    // Get transaction items
    let items: Array<{
      transaction_id: string;
      item_type: string;
      item_name: string;
      quantity: number;
      total_price: number;
      refunded_amount: number;
      refund_status: string;
    }> = [];

    if (transactionIds.length > 0) {
      const { data: txItems, error: itemsError } = await supabaseAdmin
        .from('transaction_items')
        .select(
          'transaction_id, item_type, item_name, quantity, total_price, refunded_amount, refund_status'
        )
        .in('transaction_id', transactionIds);

      if (itemsError) {
        console.error('Error fetching transaction items:', itemsError);
      } else {
        items = txItems || [];
      }
    }

    // Get refunds for the date range
    const { data: refunds, error: refundsError } = await supabaseAdmin
      .from('refunds')
      .select(
        `
        id,
        amount,
        status,
        created_at,
        transaction_id,
        transactions!inner(
          venue_id,
          payment_method
        )
      `
      )
      .gte('created_at', startOfRangeUTC)
      .lte('created_at', endOfRangeUTC)
      .eq('status', 'succeeded');

    if (refundsError) {
      console.error('Error fetching refunds:', refundsError);
    }

    // Filter refunds by venue if needed (transactions is an array from !inner join)
    const filteredRefunds = venueId
      ? (refunds || []).filter((r) => {
          const txArray = r.transactions as unknown as Array<{
            venue_id: string;
            payment_method: string;
          }>;
          const tx = Array.isArray(txArray) ? txArray[0] : txArray;
          return tx?.venue_id === venueId;
        })
      : refunds || [];

    // Build transaction summary (same logic as getDailySales)
    const summaryMap: Record<string, TransactionSummaryItem> = {
      services: {
        type: 'appointment',
        label: 'Services',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
      products: {
        type: 'product',
        label: 'Products',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
      no_show_fee: {
        type: 'fee',
        label: 'No-show fees',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
      late_cancel_fee: {
        type: 'fee',
        label: 'Late cancellation fees',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
      other: {
        type: 'other',
        label: 'Other',
        salesQty: 0,
        refundQty: 0,
        grossTotal: 0,
        refundTotal: 0,
        netTotal: 0,
      },
    };

    // Track which transactions have items
    const transactionsWithItems = new Set<string>();

    // Process transaction items
    for (const item of items) {
      transactionsWithItems.add(item.transaction_id);

      let key = 'other';

      if (item.item_type === 'appointment') {
        key = 'services';
      } else if (item.item_type === 'product') {
        key = 'products';
      } else if (item.item_type === 'fee') {
        const lowerName = (item.item_name || '').toLowerCase();
        if (lowerName.includes('no-show') || lowerName.includes('no show')) {
          key = 'no_show_fee';
        } else if (lowerName.includes('cancel') || lowerName.includes('late')) {
          key = 'late_cancel_fee';
        }
      }

      summaryMap[key].salesQty += item.quantity;
      summaryMap[key].grossTotal += Number(item.total_price) || 0;

      if (item.refunded_amount && Number(item.refunded_amount) > 0) {
        summaryMap[key].refundQty += 1;
        summaryMap[key].refundTotal += Number(item.refunded_amount);
      }
    }

    // Handle transactions without items (fallback to transaction amount as "other")
    for (const tx of transactions || []) {
      if (!transactionsWithItems.has(tx.id)) {
        summaryMap.other.salesQty += 1;
        summaryMap.other.grossTotal += Number(tx.amount) || 0;
      }
    }

    // Calculate net totals
    for (const key of Object.keys(summaryMap)) {
      summaryMap[key].netTotal =
        summaryMap[key].grossTotal - summaryMap[key].refundTotal;
    }

    // Build cash movement summary
    const cashMovementMap: Record<string, CashMovementItem> = {
      card: {
        type: 'card',
        label: 'Card',
        paymentsCollected: 0,
        refundsPaid: 0,
        netTotal: 0,
      },
      cash: {
        type: 'cash',
        label: 'Cash',
        paymentsCollected: 0,
        refundsPaid: 0,
        netTotal: 0,
      },
    };

    // Process payments by method
    for (const tx of transactions || []) {
      const amount = Number(tx.amount) || 0;

      if (tx.payment_method === 'cash') {
        cashMovementMap.cash.paymentsCollected += amount;
      } else {
        cashMovementMap.card.paymentsCollected += amount;
      }
    }

    // Process refunds by original payment method
    for (const refund of filteredRefunds) {
      const amount = Number(refund.amount) || 0;
      const txArray = refund.transactions as unknown as Array<{
        venue_id: string;
        payment_method: string;
      }>;
      const tx = Array.isArray(txArray) ? txArray[0] : txArray;

      if (tx?.payment_method === 'cash') {
        cashMovementMap.cash.refundsPaid += amount;
      } else {
        cashMovementMap.card.refundsPaid += amount;
      }
    }

    // Calculate net totals for cash movement
    for (const key of Object.keys(cashMovementMap)) {
      cashMovementMap[key].netTotal =
        cashMovementMap[key].paymentsCollected -
        cashMovementMap[key].refundsPaid;
    }

    // Calculate overall totals
    const grossSales = Object.values(summaryMap).reduce(
      (sum, item) => sum + item.grossTotal,
      0
    );
    const totalRefunds = Object.values(summaryMap).reduce(
      (sum, item) => sum + item.refundTotal,
      0
    );
    const netSales = grossSales - totalRefunds;
    const totalPaymentsCollected = Object.values(cashMovementMap).reduce(
      (sum, item) => sum + item.paymentsCollected,
      0
    );
    const totalRefundsPaid = Object.values(cashMovementMap).reduce(
      (sum, item) => sum + item.refundsPaid,
      0
    );

    return {
      success: true,
      data: {
        date: startDate === endDate ? startDate : `${startDate}:${endDate}`,
        dateFormatted,
        transactionSummary: Object.values(summaryMap),
        cashMovement: Object.values(cashMovementMap),
        totals: {
          grossSales,
          totalRefunds,
          netSales,
          totalPaymentsCollected,
          totalRefundsPaid,
        },
      },
    };
  } catch (error) {
    console.error('Get sales range error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to get sales data',
    };
  }
}
