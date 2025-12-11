// components/public/bookings/date-time-selection.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { SelectedAppointment } from '@/types/bookings';

// LOCAL HELPER: Format date using LOCAL timezone (not UTC)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate minimum bookable datetime (24 hours from now)
function getMinimumBookableDateTime(): Date {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return twentyFourHoursFromNow;
}

// Check if a date is bookable (not within 24 hours)
function isDateBookable(date: Date): boolean {
  const minBookableDate = getMinimumBookableDateTime();
  minBookableDate.setHours(0, 0, 0, 0);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate >= minBookableDate;
}

// Filter time slots to exclude those within 24 hours
function filterSlotsBy24HourRule(dateStr: string, slots: string[]): string[] {
  const minBookableDateTime = getMinimumBookableDateTime();
  const slotDate = new Date(dateStr);

  return slots.filter((timeSlot) => {
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const slotDateTime = new Date(slotDate);
    slotDateTime.setHours(hours, minutes, 0, 0);

    return slotDateTime >= minBookableDateTime;
  });
}

// Add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface DateTimeSelectionProps {
  venueId: string;
  appointments: SelectedAppointment[];
  onSelect: (date: string, appointments: SelectedAppointment[]) => void;
  onBack: () => void;
}

export function DateTimeSelection({
  venueId,
  appointments,
  onSelect,
  onBack,
}: DateTimeSelectionProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimes, setSelectedTimes] = useState<Record<string, string>>(
    {}
  );
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dayAvailability, setDayAvailability] = useState<
    Record<string, boolean>
  >({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Track if we've already fetched the 30-day availability
  const availabilityFetchedRef = useRef(false);

  // Generate calendar days (memoized)
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add days from previous month to fill first week
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push(prevDate);
    }

    // Add all days in current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // ✅ Calculate 30-day window: today → today + 30 days
  const dateRange = useMemo(() => {
    const startDate = new Date(today);
    const endDate = addDays(today, 30);
    return {
      start: formatLocalDate(startDate),
      end: formatLocalDate(endDate),
    };
  }, [today]);

  // ✅ OPTIMIZED: Fetch 30-day availability in ONE request (only once on mount)
  useEffect(() => {
    const fetchAvailability = async () => {
      if (appointments.length === 0) return;
      if (availabilityFetchedRef.current) return; // Already fetched

      setCheckingAvailability(true);
      availabilityFetchedRef.current = true;

      try {
        const hasAnyProfessional = appointments.some(
          (appt) => appt.teamMemberId === 'any'
        );

        if (hasAnyProfessional) {
          // ✅ ONE REQUEST for 30-day range
          const response = await fetch(
            `/api/public/bookings/availability/combined?start_date=${dateRange.start}&end_date=${dateRange.end}&venue_id=${venueId}`
          );
          const data = await response.json();

          if (data.availability) {
            const availability: Record<string, boolean> = {};
            for (const [date, info] of Object.entries(data.availability)) {
              const dateInfo = info as { available: boolean; slots: string[] };
              availability[date] =
                dateInfo.available && dateInfo.slots.length > 0;
            }
            setDayAvailability(availability);
          }
        } else {
          // For specific team member
          const appointment = appointments[0];
          const response = await fetch(
            `/api/public/bookings/availability?team_member_id=${appointment.teamMemberId}&start_date=${dateRange.start}&end_date=${dateRange.end}&venue_id=${venueId}`
          );
          const data = await response.json();

          if (data.availability) {
            const availability: Record<string, boolean> = {};
            for (const [date, info] of Object.entries(data.availability)) {
              const dateInfo = info as { available: boolean; slots: string[] };
              availability[date] =
                dateInfo.available && dateInfo.slots.length > 0;
            }
            setDayAvailability(availability);
          }
        }
      } catch (error) {
        console.error('Error checking availability:', error);
        setDayAvailability({});
      }

      setCheckingAvailability(false);
    };

    fetchAvailability();
  }, [appointments, venueId, dateRange]);

  // Fetch available time slots when date is selected (single date)
  useEffect(() => {
    if (!selectedDate || appointments.length === 0) return;

    const fetchAvailableSlots = async () => {
      setLoading(true);
      try {
        const hasAnyProfessional = appointments.some(
          (appt) => appt.teamMemberId === 'any'
        );

        if (hasAnyProfessional) {
          const response = await fetch(
            `/api/public/bookings/availability/combined?date=${selectedDate}&venue_id=${venueId}`
          );

          const data = await response.json();

          if (data.available && data.slots) {
            const filteredSlots = filterSlotsBy24HourRule(
              selectedDate,
              data.slots
            );
            setAvailableSlots(filteredSlots);
          } else {
            setAvailableSlots([]);
          }
        } else {
          const allSlots: Record<string, string[]> = {};

          for (const appointment of appointments) {
            const response = await fetch(
              `/api/public/bookings/availability?team_member_id=${appointment.teamMemberId}&date=${selectedDate}&venue_id=${venueId}`
            );

            const data = await response.json();

            if (data.available && data.slots) {
              allSlots[appointment.serviceId] = data.slots;
            } else {
              allSlots[appointment.serviceId] = [];
            }
          }

          const firstServiceId = appointments[0].serviceId;
          const slots = allSlots[firstServiceId] || [];

          const filteredSlots = filterSlotsBy24HourRule(selectedDate, slots);
          setAvailableSlots(filteredSlots);
        }
      } catch (error) {
        console.error('Error fetching slots:', error);
        setAvailableSlots([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableSlots();
  }, [selectedDate, appointments, venueId]);

  const handleDateSelect = (date: Date) => {
    const dateStr = formatLocalDate(date);
    setSelectedDate(dateStr);
    setSelectedTimes({});
  };

  const handleTimeSelect = (time: string) => {
    const times: Record<string, string> = {};
    appointments.forEach((appt) => {
      times[appt.serviceId] = time;
    });
    setSelectedTimes(times);
  };

  const handleContinue = () => {
    if (!selectedDate || Object.keys(selectedTimes).length === 0) return;

    const updatedAppointments = appointments.map((appt) => {
      const startTime = selectedTimes[appt.serviceId];
      const [hours, minutes] = startTime.split(':').map(Number);
      const endMinutes = hours * 60 + minutes + appt.durationMinutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(
        endMins
      ).padStart(2, '0')}`;

      return {
        ...appt,
        startTime,
        endTime,
      };
    });

    onSelect(selectedDate, updatedAppointments);
  };

  // Check if a date is within the 30-day bookable window
  const isWithinBookableWindow = (date: Date): boolean => {
    const dateStr = formatLocalDate(date);
    return dateStr >= dateRange.start && dateStr <= dateRange.end;
  };

  const canContinue =
    selectedDate && Object.keys(selectedTimes).length === appointments.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select Date & Time
        </h2>
        <p className="text-gray-600">
          Choose when you&apos;d like your appointment
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="border border-gray-200 rounded-xl p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1
                  )
                )
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h3 className="font-semibold text-gray-900">
              {currentMonth.toLocaleDateString('en-AU', {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1
                  )
                )
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const dateStr = formatLocalDate(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isPastDate = day < today;
              const isToday = day.getTime() === today.getTime();
              const isSelected = dateStr === selectedDate;
              const isWithin24Hours = !isDateBookable(day);
              const isOutsideWindow = !isWithinBookableWindow(day);
              const hasAvailability = dayAvailability[dateStr];
              const isUnavailable = hasAvailability === false;

              // Disable if: not current month, past, within 24hrs, outside 30-day window, or no availability
              const isDisabled =
                !isCurrentMonth ||
                isPastDate ||
                isWithin24Hours ||
                isOutsideWindow ||
                isUnavailable;

              return (
                <button
                  key={index}
                  onClick={() => handleDateSelect(day)}
                  disabled={isDisabled}
                  className={`
                    relative aspect-square flex items-center justify-center text-sm rounded-lg transition-colors
                    ${!isCurrentMonth ? 'text-gray-300' : ''}
                    ${
                      isDisabled
                        ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                        : 'text-gray-900 hover:bg-gray-100'
                    }
                    ${isToday ? 'font-bold border border-[#6C5CE7]' : ''}
                    ${
                      isSelected
                        ? 'bg-[#6C5CE7] text-white hover:bg-[#5b4bc4]'
                        : ''
                    }
                  `}
                  title={
                    isWithin24Hours
                      ? 'Must book 24 hours in advance'
                      : isOutsideWindow
                      ? 'Outside booking window'
                      : isUnavailable
                      ? 'No availability'
                      : ''
                  }
                >
                  {day.getDate()}
                  {/* Show loading indicator while checking availability */}
                  {checkingAvailability &&
                    isCurrentMonth &&
                    !isPastDate &&
                    !isOutsideWindow &&
                    !isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded-lg">
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-[#6C5CE7] rounded-full animate-spin"></div>
                      </div>
                    )}
                </button>
              );
            })}
          </div>

          {/* Booking window info */}
          <p className="text-xs text-gray-500 mt-3 text-center">
            Bookings available from{' '}
            {new Date(dateRange.start + 'T00:00:00').toLocaleDateString(
              'en-AU',
              { month: 'short', day: 'numeric' }
            )}{' '}
            to{' '}
            {new Date(dateRange.end + 'T00:00:00').toLocaleDateString('en-AU', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Time Slots */}
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Available Times</h3>
          </div>

          {!selectedDate ? (
            <p className="text-gray-500 text-center py-8">
              Please select a date first
            </p>
          ) : loading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-[#6C5CE7] border-t-transparent rounded-full mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading available times...</p>
            </div>
          ) : availableSlots.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No available times on this date
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {availableSlots.map((slot) => {
                const isSelected = Object.values(selectedTimes).includes(slot);

                return (
                  <button
                    key={slot}
                    onClick={() => handleTimeSelect(slot)}
                    className={`
                      py-2 px-3 text-sm font-medium rounded-lg border transition-colors
                      ${
                        isSelected
                          ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]'
                          : 'border-gray-200 text-gray-700 hover:border-[#6C5CE7] hover:text-[#6C5CE7]'
                      }
                    `}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Summary */}
      {selectedDate && Object.keys(selectedTimes).length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            Selected:{' '}
            <span className="font-medium text-gray-900">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(
                'en-AU',
                {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }
              )}{' '}
              at {Object.values(selectedTimes)[0]}
            </span>
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
