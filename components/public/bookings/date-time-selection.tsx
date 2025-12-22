// components/public/bookings/date-time-selection.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import type { SelectedAppointment } from '@/types/bookings';

interface DateTimeSelectionProps {
  venueId: string;
  appointments: SelectedAppointment[];
  onSelect: (date: string, appointments: SelectedAppointment[]) => void;
  onBack: () => void;
}

// Team member info (internal use only - not displayed to user)
interface TeamMemberInfo {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
}

// Helper function to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Helper function to format date to YYYY-MM-DD in local timezone
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format time to 12-hour format
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
}

// Filter slots to only show times 24+ hours from now
function filterSlotsBy24HourRule(date: string, slots: string[]): string[] {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return slots.filter((slot) => {
    const [hours, minutes] = slot.split(':').map(Number);
    const slotDateTime = new Date(date + 'T00:00:00');
    slotDateTime.setHours(hours, minutes, 0, 0);
    return slotDateTime >= tomorrow;
  });
}

export function DateTimeSelection({
  venueId,
  appointments,
  onSelect,
  onBack,
}: DateTimeSelectionProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  // Internal: Store slot-to-team-member mapping (not shown to user)
  const [slotToTeamMember, setSlotToTeamMember] = useState<
    Record<string, string>
  >({});
  const [teamMemberInfo, setTeamMemberInfo] = useState<
    Record<string, TeamMemberInfo>
  >({});

  // Track if we've already fetched the 30-day availability
  const availabilityFetchedRef = useRef(false);

  // Check if using "Any Professional"
  const hasAnyProfessional = useMemo(
    () => appointments.some((appt) => appt.teamMemberId === 'any'),
    [appointments]
  );

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

  // Calculate 30-day window: today → today + 30 days
  const dateRange = useMemo(() => {
    const startDate = new Date(today);
    const endDate = addDays(today, 30);
    return {
      start: formatLocalDate(startDate),
      end: formatLocalDate(endDate),
    };
  }, [today]);

  // Fetch 30-day availability in ONE request (only once on mount)
  useEffect(() => {
    const fetchAvailability = async () => {
      if (appointments.length === 0) return;
      if (availabilityFetchedRef.current) return;

      setCheckingAvailability(true);
      availabilityFetchedRef.current = true;

      try {
        if (hasAnyProfessional) {
          // ONE REQUEST for 30-day range
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
  }, [appointments, venueId, dateRange, hasAnyProfessional]);

  // Fetch available time slots when date is selected (single date)
  useEffect(() => {
    if (!selectedDate || appointments.length === 0) return;

    const fetchAvailableSlots = async () => {
      setLoading(true);

      try {
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

            // Store the slot-to-team-member mapping (internal - not shown to user)
            setSlotToTeamMember(data.slotToTeamMember || {});
            setTeamMemberInfo(data.teamMemberInfo || {});
          } else {
            setAvailableSlots([]);
            setSlotToTeamMember({});
            setTeamMemberInfo({});
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
  }, [selectedDate, appointments, venueId, hasAnyProfessional]);

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

    // Get the selected time
    const selectedTime = Object.values(selectedTimes)[0];

    // Build updated appointments with real team member ID if "Any Professional" was selected
    const updatedAppointments = appointments.map((appt) => {
      const startTime = selectedTimes[appt.serviceId];
      const [hours, minutes] = startTime.split(':').map(Number);
      const endMinutes = hours * 60 + minutes + appt.durationMinutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(
        endMins
      ).padStart(2, '0')}`;

      // If this appointment has "any" team member, replace with actual team member (internally)
      if (appt.teamMemberId === 'any' && slotToTeamMember[selectedTime]) {
        const teamMemberId = slotToTeamMember[selectedTime];
        const member = teamMemberInfo[teamMemberId];
        const teamMemberName = member
          ? `${member.first_name} ${member.last_name || ''}`.trim()
          : 'Professional';

        return {
          ...appt,
          startTime,
          endTime,
          teamMemberId, // Replace "any" with actual team member ID
          teamMemberName, // Keep name for internal use (confirmation email, etc.)
        };
      }

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

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              const dateStr = formatLocalDate(date);
              const isCurrentMonth =
                date.getMonth() === currentMonth.getMonth();
              const isPast = date < today;
              const isSelected = selectedDate === dateStr;
              const isWithinWindow = isWithinBookableWindow(date);
              const hasAvailability = dayAvailability[dateStr];
              const isAvailable =
                isWithinWindow && !isPast && hasAvailability !== false;

              return (
                <button
                  key={index}
                  onClick={() => isAvailable && handleDateSelect(date)}
                  disabled={!isAvailable || checkingAvailability}
                  className={`
                    aspect-square p-2 rounded-lg text-sm font-medium
                    transition-colors relative
                    ${!isCurrentMonth ? 'text-gray-300' : ''}
                    ${isPast ? 'text-gray-300 cursor-not-allowed' : ''}
                    ${
                      !isWithinWindow && !isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : ''
                    }
                    ${
                      isAvailable && !isSelected
                        ? 'text-gray-900 hover:bg-gray-100'
                        : ''
                    }
                    ${
                      isSelected
                        ? 'bg-[#6C5CE7] text-white hover:bg-[#5b4bc4]'
                        : ''
                    }
                    ${
                      hasAvailability === false && isWithinWindow && !isPast
                        ? 'text-gray-400 cursor-not-allowed'
                        : ''
                    }
                  `}
                >
                  {date.getDate()}
                  {/* Availability indicator */}
                  {isWithinWindow &&
                    !isPast &&
                    hasAvailability === true &&
                    !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full" />
                    )}
                </button>
              );
            })}
          </div>

          {checkingAvailability && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking availability...
            </div>
          )}
        </div>

        {/* Time Slots */}
        <div className="border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-900 mb-4">
            {selectedDate
              ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(
                  'en-AU',
                  {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }
                )
              : 'Select a date'}
          </h3>

          {!selectedDate ? (
            <p className="text-gray-500 text-center py-8">
              Please select a date to see available times
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#6C5CE7]" />
            </div>
          ) : availableSlots.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No available times on this date
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
              {availableSlots.map((time) => {
                const isSelected = Object.values(selectedTimes).includes(time);

                return (
                  <button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    className={`
                      py-2 px-3 rounded-lg text-sm font-medium
                      transition-colors border
                      ${
                        isSelected
                          ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]'
                          : 'border-gray-200 text-gray-700 hover:border-[#6C5CE7] hover:text-[#6C5CE7]'
                      }
                    `}
                  >
                    {formatTime(time)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Services Summary */}
      <div className="border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Your Services</h3>
        <div className="space-y-2">
          {appointments.map((appt) => (
            <div
              key={appt.serviceId}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">
                    {appt.serviceName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {appt.durationMinutes} min
                    {selectedTimes[appt.serviceId] && (
                      <span className="ml-2 text-[#6C5CE7]">
                        at {formatTime(selectedTimes[appt.serviceId])}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span className="font-medium text-gray-900">${appt.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={`
            flex-1 py-3 rounded-lg font-medium transition-colors
            ${
              canContinue
                ? 'bg-[#6C5CE7] text-white hover:bg-[#5b4bc4]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
