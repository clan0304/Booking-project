// lib/shift-helpers.ts
// Date and time utility functions for shift management
// FIXED: Timezone-safe for Melbourne (UTC+10/+11)

// =====================================================
// LOCAL TYPES (only used in scheduling)
// =====================================================

export interface ShiftPattern {
  days: number[]; // [0-6] where 0=Sunday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ShiftInput {
  shift_date: string;
  start_time: string;
  end_time: string;
}

export type ConflictResolution = 'skip' | 'replace';

// =====================================================
// INTERNAL HELPER
// =====================================================

/**
 * Parse date string as UTC date
 * CRITICAL: Always add 'Z' to force UTC interpretation
 * This prevents timezone conversion issues in Melbourne
 */
function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00Z');
}

// =====================================================
// DATE UTILITIES
// =====================================================

/**
 * Format date as YYYY-MM-DD (UTC-safe)
 */
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getToday(): string {
  return formatDate(new Date());
}

/**
 * Get tomorrow's date as YYYY-MM-DD
 */
export function getTomorrow(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return formatDate(tomorrow);
}

/**
 * Add days to a date string
 */
export function addDays(dateStr: string, days: number): string {
  const date = parseUTCDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

/**
 * Add weeks to a date string
 */
export function addWeeks(dateStr: string, weeks: number): string {
  return addDays(dateStr, weeks * 7);
}

/**
 * Get the Monday of the week containing the given date
 */
export function getStartOfWeek(dateStr?: string): string {
  const date = dateStr ? parseUTCDate(dateStr) : new Date();
  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate days to subtract to get to Monday
  // If Sunday (0), go back 6 days to get previous Monday
  // If Monday (1), stay (0 days back)
  // If Tuesday (2), go back 1 day
  // etc.
  const daysToMonday = day === 0 ? 6 : day - 1;

  date.setUTCDate(date.getUTCDate() - daysToMonday);
  return formatDate(date);
}

/**
 * Get the Sunday of the week containing the given date
 */
export function getEndOfWeek(dateStr?: string): string {
  const monday = getStartOfWeek(dateStr);
  return addDays(monday, 6); // Monday + 6 = Sunday
}

/**
 * Check if date is in the past
 */
export function isPastDate(dateStr: string): boolean {
  const date = parseUTCDate(dateStr);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if date is today
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

/**
 * Get day name from day of week number
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayOfWeek];
}

/**
 * Get full day name from day of week number
 */
export function getFullDayName(dayOfWeek: number): string {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return days[dayOfWeek];
}

/**
 * Get day of week (0-6) from date string
 */
export function getDayOfWeek(dateStr: string): number {
  const date = parseUTCDate(dateStr);
  return date.getUTCDay();
}

/**
 * Get week range for display (Mon-Sun)
 */
export function getWeekRange(weekStart: string): {
  start: string;
  end: string;
  days: Array<{ date: string; dayOfWeek: number; dayName: string }>;
} {
  // Ensure we start on Monday
  const monday = getStartOfWeek(weekStart);
  const sunday = addDays(monday, 6);
  const days = [];

  // Generate 7 days starting from Monday
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const dayOfWeek = getDayOfWeek(date);
    days.push({
      date,
      dayOfWeek,
      dayName: getDayName(dayOfWeek),
    });
  }

  return { start: monday, end: sunday, days };
}

/**
 * Format date range for display (Mon-Sun)
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseUTCDate(startDate);
  const end = parseUTCDate(endDate);

  const startMonth = start.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  const endMonth = end.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const year = end.getUTCFullYear();

  if (startMonth === endMonth) {
    // Same month: "Oct 13-19, 2025"
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  } else {
    // Different months: "Oct 28 - Nov 3, 2025"
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }
}

// =====================================================
// TIME UTILITIES
// =====================================================

/**
 * Format time as HH:MM (24-hour)
 */
export function formatTime(time: string): string {
  // Ensure HH:MM format
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return time;
}

/**
 * Format time for display (12-hour with am/pm)
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
}

/**
 * Convert time to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Calculate duration between two times in hours
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return (endMinutes - startMinutes) / 60;
}

/**
 * Format duration as "X hours" or "X.5 hours"
 */
export function formatDuration(hours: number): string {
  if (hours === 1) return '1 hour';
  if (hours % 1 === 0) return `${hours} hours`;
  return `${hours.toFixed(1)} hours`;
}

/**
 * Validate shift times
 */
export function isValidShiftTime(
  startTime: string,
  endTime: string
): { valid: boolean; error?: string } {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    return { valid: false, error: 'End time must be after start time' };
  }

  const duration = (endMinutes - startMinutes) / 60;
  if (duration > 24) {
    return { valid: false, error: 'Shift cannot exceed 24 hours' };
  }

  if (duration < 0.5) {
    return {
      valid: false,
      error: 'Shift must be at least 30 minutes',
    };
  }

  return { valid: true };
}

// =====================================================
// SHIFT PATTERN UTILITIES
// =====================================================

/**
 * Generate shift dates from a repeating pattern
 * This is the core function for creating multiple shifts
 */
export function generateShiftDates(pattern: ShiftPattern): ShiftInput[] {
  const shifts: ShiftInput[] = [];
  const { days, startTime, endTime, startDate, endDate } = pattern;

  const currentDate = parseUTCDate(startDate);
  const endDateObj = parseUTCDate(endDate);

  while (currentDate <= endDateObj) {
    const dayOfWeek = currentDate.getUTCDay();

    // Check if this day is in the selected days
    if (days.includes(dayOfWeek)) {
      shifts.push({
        shift_date: formatDate(currentDate),
        start_time: formatTime(startTime),
        end_time: formatTime(endTime),
      });
    }

    // Move to next day
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return shifts;
}

/**
 * Filter out closed days from shift list
 */
export function filterClosedDays(
  shifts: ShiftInput[],
  closedDates: string[]
): ShiftInput[] {
  return shifts.filter((shift) => !closedDates.includes(shift.shift_date));
}

/**
 * Count shifts by day of week
 */
export function countShiftsByDay(shifts: ShiftInput[]): {
  [dayOfWeek: number]: number;
} {
  const counts: { [dayOfWeek: number]: number } = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };

  shifts.forEach((shift) => {
    const dayOfWeek = getDayOfWeek(shift.shift_date);
    counts[dayOfWeek]++;
  });

  return counts;
}

// =====================================================
// VALIDATION UTILITIES
// =====================================================

/**
 * Validate date range
 */
export function isValidDateRange(
  startDate: string,
  endDate: string
): { valid: boolean; error?: string } {
  const start = parseUTCDate(startDate);
  const end = parseUTCDate(endDate);

  if (end < start) {
    return { valid: false, error: 'End date must be after start date' };
  }

  // Check if range is too long (e.g., max 1 year)
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 365) {
    return { valid: false, error: 'Date range cannot exceed 1 year' };
  }

  return { valid: true };
}

/**
 * Validate shift pattern
 */
export function validateShiftPattern(pattern: ShiftPattern): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if at least one day selected
  if (pattern.days.length === 0) {
    errors.push('Select at least one day');
  }

  // Validate times
  const timeValidation = isValidShiftTime(pattern.startTime, pattern.endTime);
  if (!timeValidation.valid) {
    errors.push(timeValidation.error!);
  }

  // Validate date range
  const dateValidation = isValidDateRange(pattern.startDate, pattern.endDate);
  if (!dateValidation.valid) {
    errors.push(dateValidation.error!);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =====================================================
// DISPLAY UTILITIES
// =====================================================

/**
 * Format date for display (e.g., "Mon, Oct 6")
 */
export function formatDateDisplay(dateStr: string): string {
  const date = parseUTCDate(dateStr);
  const dayName = date.toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  const month = date.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  const day = date.getUTCDate();
  return `${dayName}, ${month} ${day}`;
}

/**
 * Format date for display with year (e.g., "Mon, Oct 6, 2025")
 */
export function formatDateDisplayWithYear(dateStr: string): string {
  const date = parseUTCDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Get relative date description (Today, Tomorrow, date)
 */
export function getRelativeDateDescription(dateStr: string): string {
  if (isToday(dateStr)) return 'Today';
  if (dateStr === getTomorrow()) return 'Tomorrow';
  return formatDateDisplay(dateStr);
}
