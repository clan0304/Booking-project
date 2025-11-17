// components/public/bookings/date-time-selection.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { SelectedAppointment } from '@/types/bookings';

// ✅ LOCAL HELPER: Format date using LOCAL timezone (not UTC)
// This matches what the user sees in the calendar
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ✅ NEW: Calculate minimum bookable datetime (24 hours from now)
function getMinimumBookableDateTime(): Date {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return twentyFourHoursFromNow;
}

// ✅ NEW: Check if a date is bookable (not within 24 hours)
function isDateBookable(date: Date): boolean {
  const minBookableDate = getMinimumBookableDateTime();
  minBookableDate.setHours(0, 0, 0, 0); // Start of day for date comparison

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate >= minBookableDate;
}

// ✅ NEW: Filter time slots to exclude those within 24 hours
function filterSlotsBy24HourRule(dateStr: string, slots: string[]): string[] {
  const minBookableDateTime = getMinimumBookableDateTime();
  const slotDate = new Date(dateStr);

  return slots.filter((timeSlot) => {
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const slotDateTime = new Date(slotDate);
    slotDateTime.setHours(hours, minutes, 0, 0);

    // Only include slots that are at least 24 hours from now
    return slotDateTime >= minBookableDateTime;
  });
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

  // ✅ FIXED: Memoize days array to prevent recreation
  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  // ✅ FIXED: Memoize today to prevent recreation on every render
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // ✅ NEW: Check availability for all days in current month
  useEffect(() => {
    const checkMonthAvailability = async () => {
      if (appointments.length === 0) return;

      setCheckingAvailability(true);
      const availability: Record<string, boolean> = {};

      // Check if ANY appointment has "any" professional selected
      const hasAnyProfessional = appointments.some(
        (appt) => appt.teamMemberId === 'any'
      );

      // Get all days in current month (future dates only)
      const daysToCheck = days.filter((day) => {
        const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
        const isFutureDate = day >= today;
        return isCurrentMonth && isFutureDate;
      });

      // Check availability for each day (in parallel for speed)
      await Promise.all(
        daysToCheck.map(async (day) => {
          const dateStr = formatLocalDate(day);

          try {
            if (hasAnyProfessional) {
              // Check combined availability
              const response = await fetch(
                `/api/public/bookings/availability/combined?date=${dateStr}&venue_id=${venueId}`
              );
              const data = await response.json();
              availability[dateStr] = data.available && data.slots?.length > 0;
            } else {
              // Check specific team member availability
              const appointment = appointments[0]; // Use first appointment's team member
              const response = await fetch(
                `/api/public/bookings/availability?team_member_id=${appointment.teamMemberId}&date=${dateStr}&venue_id=${venueId}`
              );
              const data = await response.json();
              availability[dateStr] = data.available && data.slots?.length > 0;
            }
          } catch (error) {
            console.error(`Error checking availability for ${dateStr}:`, error);
            availability[dateStr] = false;
          }
        })
      );

      setDayAvailability(availability);
      setCheckingAvailability(false);
    };

    checkMonthAvailability();
  }, [currentMonth, appointments, venueId, today, days]);

  // Fetch available time slots when date is selected
  useEffect(() => {
    if (!selectedDate || appointments.length === 0) return;

    const fetchAvailableSlots = async () => {
      setLoading(true);
      try {
        // Check if ANY appointment has "any" professional selected
        const hasAnyProfessional = appointments.some(
          (appt) => appt.teamMemberId === 'any'
        );

        if (hasAnyProfessional) {
          // ✅ NEW: Fetch combined availability for all team members
          const response = await fetch(
            `/api/public/bookings/availability/combined?date=${selectedDate}&venue_id=${venueId}`
          );

          const data = await response.json();

          if (data.available && data.slots) {
            // ✅ NEW: Filter slots by 24-hour rule
            const filteredSlots = filterSlotsBy24HourRule(
              selectedDate,
              data.slots
            );
            setAvailableSlots(filteredSlots);
          } else {
            setAvailableSlots([]);
          }
        } else {
          // ✅ EXISTING: Fetch availability for specific team members
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

          // Use the first appointment's slots as the base
          const firstServiceId = appointments[0].serviceId;
          const slots = allSlots[firstServiceId] || [];

          // ✅ NEW: Filter slots by 24-hour rule
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

  // ✅ FIXED: Use LOCAL timezone formatting (not UTC)
  const handleDateSelect = (date: Date) => {
    const dateStr = formatLocalDate(date); // Uses LOCAL date values
    setSelectedDate(dateStr);
    setSelectedTimes({});
  };

  const handleTimeSelect = (serviceId: string, time: string) => {
    setSelectedTimes((prev) => ({
      ...prev,
      [serviceId]: time,
    }));
  };

  const handleContinue = () => {
    const updatedAppointments = appointments.map((appt) => {
      const startTime = selectedTimes[appt.serviceId];
      const [hours, minutes] = startTime.split(':').map(Number);
      const endMinutes = hours * 60 + minutes + appt.durationMinutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins
        .toString()
        .padStart(2, '0')}`;

      return {
        ...appt,
        startTime,
        endTime,
      };
    });

    onSelect(selectedDate, updatedAppointments);
  };

  const allTimesSelected = appointments.every(
    (appt) => selectedTimes[appt.serviceId]
  );

  const previousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {currentMonth.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-gray-600 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              const dateStr = formatLocalDate(day);
              const isToday = day.getTime() === today.getTime();
              const isPastDate = day < today;
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isSelected = selectedDate === dateStr;

              // ✅ NEW: Check if day has availability
              const hasAvailability = dayAvailability[dateStr] !== false;

              // ✅ NEW: Check if date is within 24-hour advance booking window
              const isWithin24Hours = !isPastDate && !isDateBookable(day);
              const isUnavailable =
                isCurrentMonth &&
                !isPastDate &&
                (!hasAvailability || isWithin24Hours);

              return (
                <button
                  key={index}
                  onClick={() =>
                    !isPastDate && !isUnavailable && handleDateSelect(day)
                  }
                  disabled={isPastDate || isUnavailable}
                  className={`
                    aspect-square p-2 text-sm rounded-lg transition-colors relative
                    ${
                      !isCurrentMonth
                        ? 'text-gray-300'
                        : isPastDate || isUnavailable
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
                    !isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded-lg">
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-[#6C5CE7] rounded-full animate-spin"></div>
                      </div>
                    )}
                </button>
              );
            })}
          </div>
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
              No available times for this date
            </p>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div key={appointment.serviceId}>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {appointment.serviceName} ({appointment.durationMinutes}{' '}
                    min)
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((time) => {
                      const isSelected =
                        selectedTimes[appointment.serviceId] === time;
                      return (
                        <button
                          key={time}
                          onClick={() =>
                            handleTimeSelect(appointment.serviceId, time)
                          }
                          className={`
                            px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${
                              isSelected
                                ? 'bg-[#6C5CE7] text-white'
                                : 'bg-gray-50 text-gray-900 hover:bg-gray-100 border border-gray-200'
                            }
                          `}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!allTimesSelected}
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
