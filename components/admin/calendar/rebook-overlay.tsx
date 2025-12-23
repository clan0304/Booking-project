// components/admin/calendar/rebook-overlay.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarDays,
} from 'lucide-react';
import Image from 'next/image';
import { getCalendarBookings } from '@/app/actions/bookings';
import { getBlockedTimes } from '@/app/actions/blocked-times';
import { getLocalToday, addDays } from '@/lib/shift-helpers';
import { RebookConfirmModal } from './rebook-confirm-modal';
import type { CalendarBooking, BlockedTime } from '@/types/calendar';

// =====================================================
// TYPES
// =====================================================

export interface RebookService {
  serviceId: string;
  serviceName: string;
  duration: number;
  price: number;
  categoryColor?: string | null;
}

export interface RebookClient {
  clientId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export interface RebookData {
  client: RebookClient;
  services: RebookService[];
  originalBookingId: string;
  venueId: string;
}

interface SelectedSlot {
  teamMemberId: string;
  teamMemberName: string;
  date: string;
  startTime: string;
}

interface RebookOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  rebookData: RebookData;
  onConfirm: (data: {
    teamMemberId: string;
    teamMemberName: string;
    date: string;
    startTime: string;
    services: RebookService[];
    client: RebookClient;
  }) => Promise<void>;
}

interface AssignedTeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatMonthYear(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
  });
}

function formatTime12Hour(time: string): string {
  const [hour, min] = time.split(':');
  const hourNum = parseInt(hour);
  const period = hourNum >= 12 ? 'pm' : 'am';
  const displayHour =
    hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
  return `${displayHour}:${min}${period}`;
}

function getMonthDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay(); // 0 = Sunday

  const days: (string | null)[] = [];

  // Add empty slots for days before the first of the month
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
      day
    ).padStart(2, '0')}`;
    days.push(dateStr);
  }

  return days;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function RebookOverlay({
  isOpen,
  onClose,
  rebookData,
  onConfirm,
}: RebookOverlayProps) {
  const [currentDate, setCurrentDate] = useState(getLocalToday());
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [assignedTeamMembers, setAssignedTeamMembers] = useState<
    AssignedTeamMember[]
  >([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [hoveredSlot, setHoveredSlot] = useState<{
    time: string;
    memberId: string;
  } | null>(null);

  // Selected slot and confirmation modal state
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Calendar popup state
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  // Editable state for the confirm modal
  const [editableServices, setEditableServices] = useState<RebookService[]>([]);
  const [editableTeamMemberId, setEditableTeamMemberId] = useState<string>('');
  const [editableTeamMemberName, setEditableTeamMemberName] =
    useState<string>('');
  const [editableTime, setEditableTime] = useState<string>('');

  // Calculate total duration of all services (for availability check)
  const totalDuration = useMemo(() => {
    return rebookData.services.reduce((sum, s) => sum + s.duration, 0);
  }, [rebookData.services]);

  // Fetch calendar data
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookingsResult, blockedResult] = await Promise.all([
          getCalendarBookings({
            venueId: rebookData.venueId,
            startDate: currentDate,
            endDate: currentDate,
            viewType: 'day',
          }),
          getBlockedTimes(rebookData.venueId, currentDate, currentDate),
        ]);

        if (bookingsResult.success) {
          setBookings(bookingsResult.data || []);
          setAssignedTeamMembers(bookingsResult.assignedTeamMembers || []);
        }

        if (blockedResult.success) {
          setBlockedTimes(blockedResult.data || []);
        }
      } catch (error) {
        console.error('Error fetching calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, rebookData.venueId, currentDate]);

  // Generate time slots (6 AM to 10 PM for better UX)
  const timeSlots = useMemo((): string[] => {
    const slots: string[] = [];
    for (let hour = 6; hour < 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:15`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
      slots.push(`${hour.toString().padStart(2, '0')}:45`);
    }
    return slots;
  }, []);

  // Group blocked times by team member
  const blockedTimesByMember = useMemo(() => {
    const grouped = new Map<string, BlockedTime[]>();
    blockedTimes.forEach((bt) => {
      if (!grouped.has(bt.team_member_id)) {
        grouped.set(bt.team_member_id, []);
      }
      grouped.get(bt.team_member_id)!.push(bt);
    });
    return grouped;
  }, [blockedTimes]);

  // Navigate dates
  const goToPreviousDay = () => {
    setSelectedSlot(null);
    const prev = addDays(currentDate, -1);
    if (prev >= getLocalToday()) {
      setCurrentDate(prev);
    }
  };

  const goToNextDay = () => {
    setSelectedSlot(null);
    setCurrentDate(addDays(currentDate, 1));
  };

  const goToToday = () => {
    setSelectedSlot(null);
    setCurrentDate(getLocalToday());
  };

  // Calendar popup navigation
  const goToPreviousMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedSlot(null);
    setCurrentDate(dateStr);
    setShowCalendarPopup(false);
  };

  const openCalendarPopup = () => {
    // Set calendar to show the current date's month
    const date = new Date(currentDate + 'T00:00:00');
    setCalendarMonth({ year: date.getFullYear(), month: date.getMonth() });
    setShowCalendarPopup(true);
  };

  // Handle slot click - open confirm modal
  const handleSlotClick = (time: string, member: AssignedTeamMember) => {
    const slot: SelectedSlot = {
      teamMemberId: member.id,
      teamMemberName: `${member.first_name} ${member.last_name}`,
      date: currentDate,
      startTime: time,
    };

    setSelectedSlot(slot);

    // Initialize editable state
    setEditableServices([...rebookData.services]);
    setEditableTeamMemberId(member.id);
    setEditableTeamMemberName(`${member.first_name} ${member.last_name}`);
    setEditableTime(time);

    // Open confirm modal
    setShowConfirmModal(true);
  };

  // Handle confirm modal close
  const handleConfirmModalClose = () => {
    setShowConfirmModal(false);
    setSelectedSlot(null);
  };

  // Handle service update
  const handleUpdateService = (
    index: number,
    updates: Partial<RebookService>
  ) => {
    setEditableServices((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  // Handle add service
  const handleAddService = (service: RebookService) => {
    setEditableServices((prev) => [...prev, service]);
  };

  // Handle delete service
  const handleDeleteService = (index: number) => {
    setEditableServices((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle team member update
  const handleUpdateTeamMember = (
    teamMemberId: string,
    teamMemberName: string
  ) => {
    setEditableTeamMemberId(teamMemberId);
    setEditableTeamMemberName(teamMemberName);
  };

  // Handle time update
  const handleUpdateTime = (time: string) => {
    setEditableTime(time);
  };

  // Handle confirm booking
  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;

    setIsConfirming(true);
    try {
      await onConfirm({
        teamMemberId: editableTeamMemberId,
        teamMemberName: editableTeamMemberName,
        date: selectedSlot.date,
        startTime: editableTime,
        services: editableServices,
        client: rebookData.client,
      });
    } catch (error) {
      console.error('Error confirming rebook:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  // Column width calculation
  const getColumnWidth = (memberCount: number): string => {
    if (memberCount === 1) return '100%';
    if (memberCount === 2) return '50%';
    if (memberCount === 3) return '33.333%';
    if (memberCount === 4) return '25%';
    if (memberCount === 5) return '20%';
    return '180px';
  };

  const columnWidth = getColumnWidth(assignedTeamMembers.length);
  const useFixedWidth = assignedTeamMembers.length >= 6;

  if (!isOpen) return null;

  const clientName = `${rebookData.client.firstName} ${
    rebookData.client.lastName || ''
  }`.trim();

  // Calculate end time for display
  const getEndTime = (startTime: string): string => {
    const startMinutes = timeToMinutes(startTime);
    return minutesToTime(startMinutes + totalDuration);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex flex-col bg-white">
        {/* Purple Header */}
        <div className="bg-purple-600 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Select a time to book</h1>
            <span className="text-sm text-purple-200">for {clientName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Navigation */}
        <div className="border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0 bg-white">
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Today
          </button>
          <div className="flex items-center gap-2 relative">
            <button
              onClick={goToPreviousDay}
              disabled={currentDate <= getLocalToday()}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>

            {/* Clickable Date - Opens Calendar */}
            <button
              onClick={openCalendarPopup}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:bg-gray-100 rounded-lg px-3 py-1 transition-colors"
            >
              <CalendarDays className="w-5 h-5 text-gray-500" />
              {formatDateDisplay(currentDate)}
            </button>

            <button
              onClick={goToNextDay}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>

            {/* Calendar Popup - Positioned below date */}
            {showCalendarPopup && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowCalendarPopup(false)}
                />
                <div className="absolute left-0 top-full mt-2 z-40 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-80">
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatMonthYear(
                        `${calendarMonth.year}-${String(
                          calendarMonth.month + 1
                        ).padStart(2, '0')}-01`
                      )}
                    </span>
                    <button
                      onClick={goToNextMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                      (day) => (
                        <div
                          key={day}
                          className="text-center text-xs font-medium text-gray-500 py-2"
                        >
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {getMonthDays(calendarMonth.year, calendarMonth.month).map(
                      (dateStr, index) => {
                        if (!dateStr) {
                          return (
                            <div key={`empty-${index}`} className="h-10" />
                          );
                        }

                        const isToday = dateStr === getLocalToday();
                        const isSelected = dateStr === currentDate;
                        const isPast = dateStr < getLocalToday();
                        const dayNum = new Date(
                          dateStr + 'T00:00:00'
                        ).getDate();

                        return (
                          <button
                            key={dateStr}
                            onClick={() => !isPast && handleDateSelect(dateStr)}
                            disabled={isPast}
                            className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-purple-600 text-white'
                                : isToday
                                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                : isPast
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={() => handleDateSelect(getLocalToday())}
                      className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Today
                    </button>
                    <button
                      onClick={() =>
                        handleDateSelect(addDays(getLocalToday(), 7))
                      }
                      className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      +1 Week
                    </button>
                    <button
                      onClick={() =>
                        handleDateSelect(addDays(getLocalToday(), 30))
                      }
                      className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      +1 Month
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : assignedTeamMembers.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No team members scheduled for this day
            </div>
          ) : (
            <div className={useFixedWidth ? 'overflow-x-auto' : ''}>
              <div
                style={{
                  minWidth: useFixedWidth
                    ? `${assignedTeamMembers.length * 180 + 60}px`
                    : '100%',
                }}
              >
                {/* Team Member Headers */}
                <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  <div className="flex-shrink-0 w-16" />
                  {assignedTeamMembers.map((member) => {
                    const isSelected = selectedSlot?.teamMemberId === member.id;
                    return (
                      <div
                        key={member.id}
                        className={`border-r border-gray-200 p-4 transition-colors ${
                          isSelected ? 'bg-purple-100' : ''
                        }`}
                        style={{
                          width: useFixedWidth ? '180px' : columnWidth,
                          minWidth: useFixedWidth ? '180px' : 'auto',
                        }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          {member.photo_url ? (
                            <Image
                              src={member.photo_url}
                              alt={`${member.first_name} ${member.last_name}`}
                              width={48}
                              height={48}
                              className={`rounded-full object-cover ${
                                isSelected ? 'ring-2 ring-purple-500' : ''
                              }`}
                            />
                          ) : (
                            <div
                              className={`w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center ${
                                isSelected ? 'ring-2 ring-purple-500' : ''
                              }`}
                            >
                              <span className="text-purple-600 font-semibold">
                                {member.first_name[0]}
                                {member.last_name[0]}
                              </span>
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 text-center">
                            {member.first_name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Time Grid */}
                <div className="flex">
                  {/* Time Labels */}
                  <div className="flex-shrink-0 w-16 bg-gray-50 border-r border-gray-200">
                    {timeSlots.map((time) => {
                      const isHourMark = time.endsWith(':00');
                      return (
                        <div
                          key={time}
                          className={`h-5 px-2 text-xs text-right ${
                            isHourMark
                              ? 'text-gray-600 font-medium border-t border-gray-300'
                              : 'text-transparent'
                          }`}
                        >
                          {isHourMark ? formatTime12Hour(time) : '·'}
                        </div>
                      );
                    })}
                  </div>

                  {/* Team Member Columns */}
                  {assignedTeamMembers.map((member) => {
                    const isColumnSelected =
                      selectedSlot?.teamMemberId === member.id;

                    // Get existing appointments for this team member
                    const memberAppointments: Array<{
                      id: string;
                      startTime: string;
                      endTime: string;
                      serviceName: string;
                      clientName: string;
                      categoryColor: string | null;
                    }> = [];

                    bookings.forEach((booking) => {
                      booking.appointments?.forEach((apt) => {
                        if (apt.team_member_id === member.id) {
                          const clientDisplayName = booking.guest_first_name
                            ? `${booking.guest_first_name} ${
                                booking.guest_last_name || ''
                              }`.trim()
                            : 'Walk-in';
                          memberAppointments.push({
                            id: apt.id,
                            startTime: apt.start_time,
                            endTime: apt.end_time,
                            serviceName: apt.service_name,
                            clientName: clientDisplayName,
                            categoryColor: apt.category_color || null,
                          });
                        }
                      });
                    });

                    return (
                      <div
                        key={member.id}
                        className={`border-r border-gray-200 relative ${
                          isColumnSelected ? 'bg-purple-50/50' : ''
                        }`}
                        style={{
                          width: useFixedWidth ? '180px' : columnWidth,
                          minWidth: useFixedWidth ? '180px' : 'auto',
                        }}
                      >
                        {timeSlots.map((time) => {
                          const isHourMark = time.endsWith(':00');
                          const isHovered =
                            hoveredSlot?.time === time &&
                            hoveredSlot?.memberId === member.id;
                          const isSelected =
                            selectedSlot?.teamMemberId === member.id &&
                            selectedSlot?.startTime === time;

                          return (
                            <div
                              key={time}
                              className={`h-5 border-t transition-colors ${
                                isHourMark
                                  ? 'border-gray-300'
                                  : 'border-gray-100'
                              } ${
                                isSelected
                                  ? 'bg-purple-500'
                                  : isHovered
                                  ? 'bg-purple-100 cursor-pointer'
                                  : 'bg-white hover:bg-purple-50 cursor-pointer'
                              }`}
                              onClick={() => handleSlotClick(time, member)}
                              onMouseEnter={() =>
                                setHoveredSlot({ time, memberId: member.id })
                              }
                              onMouseLeave={() => setHoveredSlot(null)}
                            >
                              {isHovered && !isSelected && (
                                <div className="h-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-purple-700">
                                    {formatTime12Hour(time)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Existing Appointments */}
                        {memberAppointments.map((apt) => {
                          const startMinutes = timeToMinutes(apt.startTime);
                          const endMinutes = timeToMinutes(apt.endTime);
                          const durationMinutes = endMinutes - startMinutes;
                          const topOffset = ((startMinutes - 6 * 60) / 15) * 20;
                          const height = (durationMinutes / 15) * 20;
                          const bgColor = apt.categoryColor || '#8B5CF6';

                          return (
                            <div
                              key={apt.id}
                              className="absolute rounded-lg shadow-sm pointer-events-none z-10 overflow-hidden"
                              style={{
                                top: `${topOffset}px`,
                                height: `${height}px`,
                                backgroundColor: bgColor,
                                left: '2.5%',
                                width: '95%',
                              }}
                            >
                              <div className="p-1.5 text-white text-xs h-full">
                                <div className="font-medium truncate text-[10px]">
                                  {formatTime12Hour(apt.startTime)}
                                </div>
                                <div className="font-semibold truncate">
                                  {apt.clientName}
                                </div>
                                {height > 40 && (
                                  <div className="opacity-90 truncate text-[10px]">
                                    {apt.serviceName}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Blocked Times */}
                        {(blockedTimesByMember.get(member.id) || []).map(
                          (blocked) => {
                            const startMinutes = timeToMinutes(
                              blocked.start_time
                            );
                            const endMinutes = timeToMinutes(blocked.end_time);
                            const durationMinutes = endMinutes - startMinutes;
                            const topOffset =
                              ((startMinutes - 6 * 60) / 15) * 20;
                            const height = (durationMinutes / 15) * 20;

                            return (
                              <div
                                key={blocked.id}
                                className="absolute rounded-lg pointer-events-none z-10 overflow-hidden bg-gray-300"
                                style={{
                                  top: `${topOffset}px`,
                                  height: `${height}px`,
                                  left: '2.5%',
                                  width: '95%',
                                  backgroundImage:
                                    'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)',
                                }}
                              >
                                <div className="p-1.5 text-gray-600 text-xs h-full">
                                  <div className="font-medium truncate text-[10px]">
                                    {formatTime12Hour(blocked.start_time)}
                                  </div>
                                  <div className="font-semibold truncate">
                                    {blocked.reason || 'Blocked'}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}

                        {/* Selected Slot Preview */}
                        {selectedSlot?.teamMemberId === member.id && (
                          <div
                            className="absolute bg-purple-500 rounded-lg shadow-lg pointer-events-none z-20"
                            style={{
                              top: `${
                                ((timeToMinutes(selectedSlot.startTime) -
                                  6 * 60) /
                                  15) *
                                20
                              }px`,
                              height: `${(totalDuration / 15) * 20}px`,
                              left: '2.5%',
                              width: '95%',
                            }}
                          >
                            <div className="p-2 text-white text-xs">
                              <div className="font-medium">
                                {formatTime12Hour(selectedSlot.startTime)} -{' '}
                                {formatTime12Hour(
                                  getEndTime(selectedSlot.startTime)
                                )}
                              </div>
                              <div className="opacity-90 truncate">
                                {clientName}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && selectedSlot && (
        <RebookConfirmModal
          isOpen={showConfirmModal}
          onClose={handleConfirmModalClose}
          onConfirm={handleConfirmBooking}
          isConfirming={isConfirming}
          venueId={rebookData.venueId}
          selectedDate={selectedSlot.date}
          selectedTime={editableTime}
          selectedTeamMemberId={editableTeamMemberId}
          selectedTeamMemberName={editableTeamMemberName}
          client={rebookData.client}
          services={editableServices}
          onUpdateService={handleUpdateService}
          onAddService={handleAddService}
          onDeleteService={handleDeleteService}
          onUpdateTeamMember={handleUpdateTeamMember}
          onUpdateTime={handleUpdateTime}
        />
      )}
    </>
  );
}
