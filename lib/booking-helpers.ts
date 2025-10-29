// lib/booking-helpers.ts
/**
 * Booking helper utilities for calendar appointments
 * Handles time calculations and formatting
 */

/**
 * Calculate back-to-back appointment times
 * Takes start time and array of service durations
 * Returns array of {startTime, endTime} for each service
 */
export function calculateAppointmentTimes(
  startTime: string, // HH:MM format
  services: Array<{ duration: number }> // duration in minutes
): Array<{ startTime: string; endTime: string }> {
  const appointments = [];
  let currentTime = startTime;

  for (const service of services) {
    const [hours, minutes] = currentTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + service.duration;

    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;

    const endTime = `${String(endHours).padStart(2, '0')}:${String(
      endMins
    ).padStart(2, '0')}`;

    appointments.push({
      startTime: currentTime,
      endTime: endTime,
    });

    // Next service starts when this one ends
    currentTime = endTime;
  }

  return appointments;
}

/**
 * Calculate total duration and price
 */
export function calculateBookingSummary(
  services: Array<{ duration: number; price: number }>
): { totalMinutes: number; totalPrice: number; endTime?: string } {
  return services.reduce(
    (acc, service) => ({
      totalMinutes: acc.totalMinutes + service.duration,
      totalPrice: acc.totalPrice + service.price,
    }),
    { totalMinutes: 0, totalPrice: 0 }
  );
}

/**
 * Format duration in minutes to readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${mins} min`;
}

/**
 * Format time from HH:MM to 12-hour format
 */
export function formatTime12Hour(time: string): string {
  const [hours, mins] = time.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, '0')}${period}`;
}

/**
 * Format time range for display
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
}

/**
 * Calculate end time given start time and duration
 */
export function calculateEndTime(
  startTime: string,
  durationMinutes: number
): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMinutes;

  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;

  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(
    2,
    '0'
  )}`;
}
