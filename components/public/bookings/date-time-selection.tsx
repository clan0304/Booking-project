// components/public/bookings/date-time-selection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { SelectedAppointment } from '@/types/bookings';

// ✅ LOCAL HELPER: Format date using LOCAL timezone (not UTC)
// This matches what the user sees in the calendar
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // Generate calendar days
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

  const days = getDaysInMonth(currentMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch available time slots when date is selected
  useEffect(() => {
    if (!selectedDate || appointments.length === 0) return;

    const fetchAvailableSlots = async () => {
      setLoading(true);
      try {
        // Fetch availability for each team member's appointment
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
        // In a production app, you might want to find common slots across all team members
        const firstServiceId = appointments[0].serviceId;
        setAvailableSlots(allSlots[firstServiceId] || []);
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
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
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
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isPast = day < today;
              // ✅ FIXED: Compare using LOCAL timezone
              const isSelected = selectedDate === formatLocalDate(day);
              const isToday = day.toDateString() === today.toDateString();

              return (
                <button
                  key={index}
                  onClick={() =>
                    !isPast && isCurrentMonth && handleDateSelect(day)
                  }
                  disabled={isPast || !isCurrentMonth}
                  className={`
                    aspect-square rounded-lg p-2 text-sm font-medium transition-colors
                    ${!isCurrentMonth ? 'text-gray-300 cursor-not-allowed' : ''}
                    ${
                      isPast && isCurrentMonth
                        ? 'text-gray-400 cursor-not-allowed'
                        : ''
                    }
                    ${isSelected ? 'bg-[#6C5CE7] text-white' : ''}
                    ${
                      isToday && !isSelected
                        ? 'border-2 border-[#6C5CE7] text-[#6C5CE7]'
                        : ''
                    }
                    ${
                      !isSelected && !isPast && isCurrentMonth
                        ? 'hover:bg-gray-100'
                        : ''
                    }
                  `}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div className="border border-gray-200 rounded-xl p-4">
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Calendar className="h-12 w-12 mb-2" />
              <p>Select a date to view available times</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C5CE7]" />
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Available Times
              </h3>

              {appointments.map((appointment, index) => (
                <div key={appointment.serviceId} className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    {index + 1}. {appointment.serviceName} (
                    {appointment.durationMinutes} min)
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => {
                      const isSelected =
                        selectedTimes[appointment.serviceId] === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() =>
                            handleTimeSelect(appointment.serviceId, slot)
                          }
                          className={`
                            py-2 px-3 rounded-lg text-sm font-medium transition-colors
                            ${
                              isSelected
                                ? 'bg-[#6C5CE7] text-white'
                                : 'border border-gray-300 hover:border-[#6C5CE7] hover:bg-purple-50'
                            }
                          `}
                        >
                          {slot}
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
          disabled={!selectedDate || !allTimesSelected}
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
