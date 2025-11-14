// components/admin/calendar/day-view.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { TimeSlotActionsModal } from './time-slot-actions-modal';
import { BlockedTimeModal } from './blocked-time-modal';
import { AppointmentCard } from './appointment-card';
import {
  isTimeInShift,
  getShiftsForMemberAndDate,
  isTimeBlocked,
} from '@/lib/shift-helpers';
import type {
  CalendarBooking,
  CalendarTeamMember,
  AppointmentWithBooking,
  AppointmentsByMember,
  BlockedTime,
} from '@/types/calendar';
import { EditAppointmentModal } from './appointment/edit-appointment-modal';
import Image from 'next/image';
import { getBookingByAppointmentId } from '@/app/actions/calendar-appointments';
import type { BookingGroupWithAppointments } from '@/types/calendar';

interface DayViewProps {
  bookings: CalendarBooking[];
  shifts: Array<{
    team_member_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    team_member: {
      id: string;
      first_name: string;
      last_name: string;
      photo_url: string | null;
    };
  }>;
  assignedTeamMembers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  }>;
  currentDate: string;
  blockedTimes: BlockedTime[];
  venueId: string;
  onRefresh: () => void;
}

// =====================================================
// OVERLAP HANDLING HELPERS
// =====================================================

/**
 * Convert HH:MM time to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:MM format
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Add minutes to a time string (HH:MM format)
 */
function addMinutesToTime(time: string, minutesToAdd: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutesToAdd;

  // Cap at 23:59
  const cappedMinutes = Math.max(0, Math.min(totalMinutes, 24 * 60 - 1));

  return minutesToTime(cappedMinutes);
}

/**
 * Check if two appointments overlap in time
 */
function appointmentsOverlap(
  appt1: AppointmentWithBooking,
  appt2: AppointmentWithBooking
): boolean {
  const start1 = timeToMinutes(appt1.start_time);
  const end1 = timeToMinutes(appt1.end_time);
  const start2 = timeToMinutes(appt2.start_time);
  const end2 = timeToMinutes(appt2.end_time);

  // Overlaps if one starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Layout information for positioning overlapping appointments
 */
interface AppointmentLayout {
  width: string;
  left: string;
  zIndex: number;
}

/**
 * Calculate layout for overlapping appointments
 * Returns a Map of appointment ID to layout properties
 */
function calculateAppointmentLayouts(
  appointments: AppointmentWithBooking[]
): Map<string, AppointmentLayout> {
  const layouts = new Map<string, AppointmentLayout>();

  // Sort appointments by start time for consistent column assignment
  const sorted = [...appointments].sort((a, b) => {
    const startA = timeToMinutes(a.start_time);
    const startB = timeToMinutes(b.start_time);
    return startA - startB;
  });

  // For each appointment, find overlapping ones and assign layout
  for (const appointment of sorted) {
    // Find all appointments that overlap with this one
    const overlapping = appointments.filter((other) =>
      appointmentsOverlap(appointment, other)
    );

    const maxConcurrent = overlapping.length;

    // Find this appointment's position among overlapping ones
    const position = overlapping
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
      .findIndex((a) => a.id === appointment.id);

    // Calculate width and left position
    const widthPercent = 100 / maxConcurrent;
    const leftPercent = (position / maxConcurrent) * 100;

    layouts.set(appointment.id, {
      width: `${widthPercent - 0.5}%`, // Subtract 0.5% for visual gap
      left: `${leftPercent}%`,
      zIndex: position,
    });
  }

  return layouts;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function DayView({
  bookings,
  shifts,
  assignedTeamMembers,
  currentDate,
  blockedTimes,
  venueId,
  onRefresh,
}: DayViewProps) {
  // State for modals
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showBlockedTimeModal, setShowBlockedTimeModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    time: string;
    teamMemberId: string;
    teamMemberName: string;
  } | null>(null);
  const [selectedBooking, setSelectedBooking] =
    useState<BookingGroupWithAppointments | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoadingBooking, setIsLoadingBooking] = useState(false);
  const [selectedBlockedTime, setSelectedBlockedTime] =
    useState<BlockedTime | null>(null);

  // NEW: Loading state for save operation
  const [isSaving, setIsSaving] = useState(false);

  // NEW: Local state for updated appointments (persists after save without refresh)
  const [updatedAppointments, setUpdatedAppointments] = useState<
    Map<
      string,
      { start_time: string; end_time: string; duration_minutes: number }
    >
  >(new Map());

  // NEW: Interaction state for resize/drag
  const [interactionState, setInteractionState] = useState<{
    mode: 'resize-top' | 'resize-bottom' | 'drag';
    appointmentId: string;
    startY: number;
    originalStartTime: string;
    originalEndTime: string;
    originalDuration: number;
    currentStartTime: string;
    currentEndTime: string;
    currentDuration: number;
  } | null>(null);

  // NEW: Flag to prevent onClick after drag/resize
  const [justInteracted, setJustInteracted] = useState(false);

  // NEW: Current time for time indicator
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Generate time slots (8 AM to 8 PM, 15-min intervals)
  const timeSlots = useMemo((): string[] => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 23 || (hour === 23 && true)) {
        slots.push(`${hour.toString().padStart(2, '0')}:15`);
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
        slots.push(`${hour.toString().padStart(2, '0')}:45`);
      }
    }
    return slots;
  }, []);

  // Generate hour labels (only show on the hour)
  const hourLabels = useMemo((): string[] => {
    const labels: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      labels.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return labels;
  }, []);

  // Group appointments by team member with local updates applied
  const appointmentsByMember = useMemo((): AppointmentsByMember[] => {
    const grouped = new Map<
      string,
      { member: CalendarTeamMember; appointments: AppointmentWithBooking[] }
    >();

    // First, add team members from bookings
    bookings.forEach((booking) => {
      booking.appointments?.forEach((appointment) => {
        const memberId = appointment.team_member_id;
        const member = appointment.team_member;

        if (!member) return;

        if (!grouped.has(memberId)) {
          grouped.set(memberId, {
            member,
            appointments: [],
          });
        }

        // Apply local updates if they exist
        const localUpdate = updatedAppointments.get(appointment.id);
        const finalAppointment: AppointmentWithBooking = localUpdate
          ? {
              ...appointment,
              start_time: localUpdate.start_time,
              end_time: localUpdate.end_time,
              duration_minutes: localUpdate.duration_minutes,
              booking,
            }
          : {
              ...appointment,
              booking,
            };

        grouped.get(memberId)!.appointments.push(finalAppointment);
      });
    });

    // Then add team members from assignedTeamMembers who don't have bookings
    assignedTeamMembers.forEach((member) => {
      if (!grouped.has(member.id)) {
        grouped.set(member.id, {
          member,
          appointments: [],
        });
      }
    });

    return Array.from(grouped.values());
  }, [bookings, assignedTeamMembers, updatedAppointments]);

  // Group blocked times by team member
  const blockedTimesByMember = useMemo(() => {
    const grouped = new Map<string, BlockedTime[]>();

    blockedTimes.forEach((blockedTime) => {
      const memberId = blockedTime.team_member_id;
      if (!grouped.has(memberId)) {
        grouped.set(memberId, []);
      }
      grouped.get(memberId)!.push(blockedTime);
    });

    return grouped;
  }, [blockedTimes]);

  // Calculate appointment layouts for ALL members (must be at component level)
  const allAppointmentLayouts = useMemo(() => {
    const layouts = new Map<string, Map<string, AppointmentLayout>>();

    appointmentsByMember.forEach(({ member, appointments }) => {
      layouts.set(member.id, calculateAppointmentLayouts(appointments));
    });

    return layouts;
  }, [appointmentsByMember]);

  // Format time for display (12-hour format)
  const formatTime12Hour = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min} ${period}`;
  };

  // Format time label for left column (simplified)
  const formatTimeLabel = (time: string): string => {
    const [hour] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}${period}`;
  };

  // Calculate position and height for appointments/blocked times
  const getStyle = (
    startTime: string,
    endTime: string
  ): { top: number; height: number } => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const baseMinutes = 0; // 12 AM (midnight)
    const top = ((startMinutes - baseMinutes) / 15) * 20; // 20px per 15min slot
    const height = ((endMinutes - startMinutes) / 15) * 20;

    return { top, height };
  };

  // Handle empty slot click
  const handleSlotClick = (
    time: string,
    teamMemberId: string,
    teamMemberName: string
  ) => {
    setSelectedSlot({ time, teamMemberId, teamMemberName });
    setShowActionsModal(true);
  };

  // Handle blocked time click
  const handleBlockedTimeClick = (
    blockedTime: BlockedTime,
    teamMemberName: string
  ) => {
    setSelectedBlockedTime(blockedTime);
    setSelectedSlot({
      time: blockedTime.start_time.substring(0, 5),
      teamMemberId: blockedTime.team_member_id,
      teamMemberName,
    });
    setShowBlockedTimeModal(true);
  };

  const handleAppointmentClick = async (
    appointment: AppointmentWithBooking
  ) => {
    if (justInteracted) return;

    setIsLoadingBooking(true);
    setIsEditModalOpen(true);

    try {
      const result = await getBookingByAppointmentId(appointment.id);

      if (result.success && result.data) {
        setSelectedBooking(result.data);
      } else {
        console.error('Failed to load booking:', result.error);
        setIsEditModalOpen(false);
        alert('Failed to load booking details. Please try again.');
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      setIsEditModalOpen(false);
      alert('An error occurred while loading booking details.');
    } finally {
      setIsLoadingBooking(false);
    }
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedBooking(null);
    onRefresh();
  };
  // ============================================
  // CURRENT TIME INDICATOR HELPERS
  // ============================================

  /**
   * Check if current time indicator should be shown
   * Only show if viewing today
   */
  const shouldShowCurrentTime = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return currentDate === todayStr;
  }, [currentDate]);

  /**
   * Calculate position of current time indicator
   */
  const getCurrentTimePosition = useMemo(() => {
    if (!shouldShowCurrentTime) return null;

    // Get local time
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Calculate top position (20px per 15min slot)
    const top = (totalMinutes / 15) * 20;

    return { top, time: `${hours}:${String(minutes).padStart(2, '0')}` };
  }, [currentTime, shouldShowCurrentTime]);

  /**
   * Format current time for display (12-hour format)
   */
  const formatCurrentTime = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min}${period}`;
  };

  // Auto-scroll to current time when viewing today (MOVED AFTER useMemo declarations)
  useEffect(() => {
    if (shouldShowCurrentTime && getCurrentTimePosition) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        // Scroll window to show current time indicator
        const indicatorPosition = getCurrentTimePosition.top;

        // Get the calendar element's offset from top of page
        const calendarElement = document.querySelector(
          '.bg-white.rounded-lg.border'
        );
        if (calendarElement) {
          const calendarTop =
            calendarElement.getBoundingClientRect().top + window.scrollY;
          const targetScroll =
            calendarTop + indicatorPosition - window.innerHeight / 2 + 200;

          // Smooth scroll to show the current time indicator
          window.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth',
          });
        }
      }, 100);
    }
  }, [shouldShowCurrentTime, getCurrentTimePosition, currentDate]); // Fixed dependencies

  // ============================================
  // NEW: INTERACTION HANDLERS
  // ============================================

  /**
   * Handle resize from top (change start time)
   */
  const handleResizeTopStart = (appointmentId: string, startY: number) => {
    const appointment = appointmentsByMember
      .flatMap((m) => m.appointments)
      .find((a) => a.id === appointmentId);

    if (!appointment) return;

    setInteractionState({
      mode: 'resize-top',
      appointmentId,
      startY,
      originalStartTime: appointment.start_time,
      originalEndTime: appointment.end_time,
      originalDuration: appointment.duration_minutes,
      currentStartTime: appointment.start_time,
      currentEndTime: appointment.end_time,
      currentDuration: appointment.duration_minutes,
    });
  };

  /**
   * Handle resize from bottom (change end time)
   */
  const handleResizeBottomStart = (appointmentId: string, startY: number) => {
    const appointment = appointmentsByMember
      .flatMap((m) => m.appointments)
      .find((a) => a.id === appointmentId);

    if (!appointment) return;

    setInteractionState({
      mode: 'resize-bottom',
      appointmentId,
      startY,
      originalStartTime: appointment.start_time,
      originalEndTime: appointment.end_time,
      originalDuration: appointment.duration_minutes,
      currentStartTime: appointment.start_time,
      currentEndTime: appointment.end_time,
      currentDuration: appointment.duration_minutes,
    });
  };

  /**
   * Handle drag start (move appointment)
   */
  const handleDragStart = (appointmentId: string, startY: number) => {
    const appointment = appointmentsByMember
      .flatMap((m) => m.appointments)
      .find((a) => a.id === appointmentId);

    if (!appointment) return;

    setInteractionState({
      mode: 'drag',
      appointmentId,
      startY,
      originalStartTime: appointment.start_time,
      originalEndTime: appointment.end_time,
      originalDuration: appointment.duration_minutes,
      currentStartTime: appointment.start_time,
      currentEndTime: appointment.end_time,
      currentDuration: appointment.duration_minutes,
    });
  };

  /**
   * Handle interaction move (resize or drag)
   */
  const handleInteractionMove = (clientY: number) => {
    if (!interactionState) return;

    const deltaY = clientY - interactionState.startY;
    const deltaMinutes = Math.round((deltaY / 20) * 15); // 20px = 15min
    const snappedDelta = Math.round(deltaMinutes / 5) * 5; // Snap to 5min intervals

    let newStartTime: string;
    let newEndTime: string;
    let newDuration: number;

    switch (interactionState.mode) {
      case 'resize-top':
        // Change start time, keep end time fixed
        newStartTime = addMinutesToTime(
          interactionState.originalStartTime,
          snappedDelta
        );
        newEndTime = interactionState.originalEndTime;

        // Calculate new duration
        const startMinutes = timeToMinutes(newStartTime);
        const endMinutes = timeToMinutes(newEndTime);
        newDuration = Math.max(5, endMinutes - startMinutes); // Min 5 min

        // Adjust start time if duration would be too small
        if (newDuration < 5) {
          newStartTime = addMinutesToTime(newEndTime, -5);
          newDuration = 5;
        }
        break;

      case 'resize-bottom':
        // Keep start time fixed, change end time
        newStartTime = interactionState.originalStartTime;
        newDuration = Math.max(
          5,
          interactionState.originalDuration + snappedDelta
        );
        newEndTime = addMinutesToTime(newStartTime, newDuration);
        break;

      case 'drag':
        // Move both start and end time, keep duration same
        newStartTime = addMinutesToTime(
          interactionState.originalStartTime,
          snappedDelta
        );
        newEndTime = addMinutesToTime(
          interactionState.originalEndTime,
          snappedDelta
        );
        newDuration = interactionState.originalDuration; // Duration unchanged!
        break;

      default:
        return;
    }

    setInteractionState({
      ...interactionState,
      currentStartTime: newStartTime,
      currentEndTime: newEndTime,
      currentDuration: newDuration,
    });
  };

  /**
   * Handle interaction end (save changes)
   */
  const handleInteractionEnd = async () => {
    if (!interactionState) return;

    const appointment = appointmentsByMember
      .flatMap((m) => m.appointments)
      .find((a) => a.id === interactionState.appointmentId);

    if (!appointment) {
      setInteractionState(null);
      return;
    }

    // Check if anything actually changed
    const startChanged =
      interactionState.currentStartTime !== interactionState.originalStartTime;
    const endChanged =
      interactionState.currentEndTime !== interactionState.originalEndTime;
    const durationChanged =
      interactionState.currentDuration !== interactionState.originalDuration;

    if (!startChanged && !durationChanged && !endChanged) {
      setInteractionState(null);
      return;
    }

    // Store the values we need before clearing state
    const appointmentId = interactionState.appointmentId;
    const newStartTime = interactionState.currentStartTime;
    const newEndTime = interactionState.currentEndTime;
    const newDuration = interactionState.currentDuration;
    const mode = interactionState.mode;

    // Clear interaction state immediately
    setInteractionState(null);

    // Set flag to prevent onClick from firing
    setJustInteracted(true);
    setTimeout(() => setJustInteracted(false), 100); // Clear after 100ms

    // Update local state immediately (optimistic update that persists!)
    setUpdatedAppointments((prev) => {
      const updated = new Map(prev);
      updated.set(appointmentId, {
        start_time: newStartTime,
        end_time: newEndTime,
        duration_minutes: newDuration,
      });
      return updated;
    });

    // Show loading state
    setIsSaving(true);

    try {
      // Import the server actions
      const { resizeAppointment, moveAppointment } = await import(
        '@/app/actions/calendar-appointments'
      );

      let result;

      if (mode === 'drag') {
        // Use move appointment action
        result = await moveAppointment({
          appointmentId,
          bookingId: appointment.booking.id,
          newStartTime,
          newEndTime,
        });
      } else {
        // Use resize appointment action
        result = await resizeAppointment({
          appointmentId,
          bookingId: appointment.booking.id,
          newStartTime,
          newEndTime,
          newDuration,
        });
      }

      if (!result.success) {
        // Error: revert the local update
        setUpdatedAppointments((prev) => {
          const updated = new Map(prev);
          updated.delete(appointmentId);
          return updated;
        });
        alert(result.error || 'Failed to update appointment');
      }
      // ✅ Success: local state already updated, no refresh needed!
    } catch (error) {
      console.error('Error updating appointment:', error);
      // Error: revert the local update
      setUpdatedAppointments((prev) => {
        const updated = new Map(prev);
        updated.delete(appointmentId);
        return updated;
      });
      alert('An unexpected error occurred');
    } finally {
      // Hide loading state
      setIsSaving(false);
    }
  };

  // Calculate dynamic column width based on number of team members
  const getColumnWidth = (memberCount: number): string => {
    if (memberCount === 1) return '100%';
    if (memberCount === 2) return '50%';
    if (memberCount === 3) return '33.333%';
    if (memberCount === 4) return '25%';
    if (memberCount === 5) return '20%';
    return '200px'; // Fixed width for 6+ members, allows horizontal scroll
  };

  const columnWidth = getColumnWidth(appointmentsByMember.length);
  const useFixedWidth = appointmentsByMember.length >= 6;

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {appointmentsByMember.length === 0 ? (
          // Empty state
          <div className="p-8 text-center">
            <p className="text-gray-500">
              No team members assigned to this venue
            </p>
          </div>
        ) : (
          <div className={useFixedWidth ? 'overflow-x-auto' : ''}>
            <div
              style={{
                minWidth: useFixedWidth
                  ? `${appointmentsByMember.length * 200}px`
                  : '100%',
              }}
            >
              {/* Team Member Headers */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                {/* Empty space for time labels column */}
                <div className="flex-shrink-0 w-16" />

                {/* Team Member Headers */}
                {appointmentsByMember.map(({ member }) => (
                  <div
                    key={member.id}
                    className="border-r border-gray-200 p-4"
                    style={{
                      width: useFixedWidth ? '200px' : columnWidth,
                      minWidth: useFixedWidth ? '200px' : 'auto',
                    }}
                  >
                    {/* Uniform layout with consistent sizing */}
                    <div className="flex flex-col items-center gap-3">
                      {/* Photo Container - Fixed Size */}
                      <div className="flex-shrink-0">
                        {member.photo_url ? (
                          <Image
                            src={member.photo_url}
                            alt={`${member.first_name} ${member.last_name}`}
                            width={56}
                            height={56}
                            className="rounded-full object-cover"
                            style={{ width: '56px', height: '56px' }}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                            <span className="text-base font-semibold text-white">
                              {member.first_name[0]}
                              {member.last_name[0]}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Text Container - Centered */}
                      <div className="text-center w-full">
                        <p className="text-sm font-semibold text-gray-900 truncate px-2">
                          {member.first_name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Calendar Grid - Time slots with columns for each member */}
              <div className="flex">
                {/* Time Labels Column */}
                <div className="flex-shrink-0 w-16 border-r border-gray-200 bg-gray-50">
                  {timeSlots.map((time) => {
                    const isHourMark = time.endsWith(':00');
                    const showLabel = hourLabels.includes(time);

                    return (
                      <div
                        key={time}
                        className={`h-5 flex items-center justify-end pr-2 text-xs ${
                          showLabel
                            ? 'text-gray-600 font-medium'
                            : 'text-transparent'
                        } ${isHourMark ? 'border-t-2 border-t-gray-300' : ''}`}
                      >
                        {showLabel ? formatTimeLabel(time) : '·'}
                      </div>
                    );
                  })}
                </div>

                {/* Team Member Columns */}
                {appointmentsByMember.map(({ member, appointments }) => {
                  const memberName = `${member.first_name} ${member.last_name}`;
                  const memberBlockedTimes =
                    blockedTimesByMember.get(member.id) || [];

                  // Get pre-calculated layouts for this member
                  const appointmentLayouts =
                    allAppointmentLayouts.get(member.id) || new Map();

                  return (
                    <div
                      key={member.id}
                      className="border-r border-gray-200 relative"
                      style={{
                        width: useFixedWidth ? '200px' : columnWidth,
                        minWidth: useFixedWidth ? '200px' : 'auto',
                      }}
                    >
                      {/* Time Slots Grid */}
                      <div>
                        {timeSlots.map((time) => {
                          // Get shifts for this team member on current date
                          const memberShifts = getShiftsForMemberAndDate(
                            member.id,
                            currentDate,
                            shifts
                          );

                          // Check if this time slot is within team member's shift
                          const hasShift = isTimeInShift(time, memberShifts);

                          // Check if this time slot is blocked
                          const isBlocked = isTimeBlocked(
                            time,
                            memberBlockedTimes
                          );

                          // Check if time slot has an appointment
                          const hasAppointment = appointments.some((apt) => {
                            const aptStart = apt.start_time.substring(0, 5);
                            const aptEnd = apt.end_time.substring(0, 5);
                            return time >= aptStart && time < aptEnd;
                          });

                          // Determine if slot is clickable (not booked, not blocked)
                          const isClickable = !hasAppointment && !isBlocked;

                          // Determine background color based on state
                          let bgColorClass = '';
                          let cursorClass = '';
                          let titleText = '';

                          if (!hasShift) {
                            // No shift = light gray, clickable
                            bgColorClass = 'bg-gray-100 hover:bg-purple-100';
                            cursorClass = 'cursor-pointer';
                            titleText = formatTime12Hour(time);
                          } else if (isBlocked) {
                            // Has shift but blocked = dark gray, not clickable
                            bgColorClass = 'bg-gray-400';
                            cursorClass = 'cursor-not-allowed';
                            titleText = 'Time blocked';
                          } else if (hasAppointment) {
                            // Has shift with appointment = white, not clickable (stylist is working)
                            bgColorClass = 'bg-white';
                            cursorClass = 'cursor-not-allowed';
                            titleText = 'Time slot booked';
                          } else {
                            // Has shift, available = white, clickable
                            bgColorClass = 'bg-white hover:bg-purple-100';
                            cursorClass = 'cursor-pointer';
                            titleText = formatTime12Hour(time);
                          }

                          return (
                            <div
                              key={time}
                              className={`h-5 border-t border-gray-100 transition-colors ${bgColorClass} ${cursorClass} relative group`}
                              onClick={() => {
                                if (isClickable) {
                                  handleSlotClick(time, member.id, memberName);
                                }
                              }}
                              title={titleText}
                            >
                              {isClickable && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  <span className="text-xs font-medium text-purple-700">
                                    {formatTime12Hour(time)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Appointments and Blocked Times Overlay */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ height: `${timeSlots.length * 20}px` }}
                      >
                        {/* Current Time Indicator (only on first column) */}
                        {shouldShowCurrentTime &&
                          getCurrentTimePosition &&
                          member.id === appointmentsByMember[0]?.member.id && (
                            <>
                              {/* Time Badge - positioned in left margin */}
                              <div
                                className="absolute z-50"
                                style={{
                                  top: `${getCurrentTimePosition.top}px`,
                                  left: '-64px', // Position in the time labels column
                                  transform: 'translateY(-50%)',
                                }}
                              >
                                <div className="bg-white text-red-600 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                                  {formatCurrentTime(
                                    getCurrentTimePosition.time
                                  )}
                                </div>
                              </div>
                            </>
                          )}

                        {/* Red Line across all columns */}
                        {shouldShowCurrentTime && getCurrentTimePosition && (
                          <div
                            className="absolute left-0 right-0 h-0.5 bg-red-600 z-50 pointer-events-none"
                            style={{
                              top: `${getCurrentTimePosition.top}px`,
                            }}
                          />
                        )}

                        {/* Appointments */}
                        {appointments.map((appointment) => {
                          const isInteracting =
                            interactionState?.appointmentId === appointment.id;

                          // Use interaction state values if actively interacting
                          const displayStartTime = isInteracting
                            ? interactionState.currentStartTime
                            : appointment.start_time;

                          const displayEndTime = isInteracting
                            ? interactionState.currentEndTime
                            : appointment.end_time;

                          const displayDuration = isInteracting
                            ? interactionState.currentDuration
                            : appointment.duration_minutes;

                          const { top, height } = getStyle(
                            displayStartTime,
                            displayEndTime
                          );

                          const layout = appointmentLayouts.get(
                            appointment.id
                          ) || {
                            width: '100%',
                            left: '0%',
                            zIndex: 0,
                          };

                          return (
                            <div
                              key={appointment.id}
                              className="absolute px-1 group pointer-events-none"
                              style={{
                                top: `${top}px`,
                                height: `${height * 0.99}px`,
                                width: layout.width,
                                left: layout.left,
                                zIndex: isInteracting ? 100 : layout.zIndex,
                              }}
                            >
                              {/* Hover trigger area - covers full width including gap */}
                              <div className="absolute inset-0 pointer-events-auto" />

                              {/* Card that shrinks on hover */}
                              <div className="relative h-full w-full group-hover:w-[95%] transition-all duration-200 pointer-events-none">
                                <div className="h-full w-full pointer-events-auto relative hover:z-[100]">
                                  <AppointmentCard
                                    appointment={{
                                      ...appointment,
                                      start_time: displayStartTime,
                                      end_time: displayEndTime,
                                      duration_minutes: displayDuration,
                                    }}
                                    booking={appointment.booking}
                                    interactionMode={
                                      isInteracting
                                        ? interactionState.mode
                                        : null
                                    }
                                    onResizeTopStart={handleResizeTopStart}
                                    onResizeBottomStart={
                                      handleResizeBottomStart
                                    }
                                    onDragStart={handleDragStart}
                                    onInteractionMove={handleInteractionMove}
                                    onInteractionEnd={handleInteractionEnd}
                                    onClick={() =>
                                      handleAppointmentClick(appointment)
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {/* Blocked Times */}
                        {memberBlockedTimes.map((blockedTime) => {
                          const { top, height } = getStyle(
                            blockedTime.start_time,
                            blockedTime.end_time
                          );
                          return (
                            <div
                              key={blockedTime.id}
                              className="absolute inset-x-0 pointer-events-auto cursor-pointer px-1"
                              style={{
                                top: `${top}px`,
                                height: `${height * 0.99}px`,
                              }}
                              onClick={() =>
                                handleBlockedTimeClick(blockedTime, memberName)
                              }
                            >
                              <div className="h-full rounded-md border-2 border-dashed border-gray-400 bg-gray-100/80 px-2 py-1.5 hover:bg-gray-200/80 transition-colors flex flex-col overflow-hidden">
                                <div className="text-xs text-gray-600 font-medium flex items-center gap-1 leading-tight">
                                  <span>🚫</span>
                                  <span>Blocked</span>
                                </div>
                                {blockedTime.reason && (
                                  <div className="text-xs text-gray-500 mt-0.5 truncate leading-tight">
                                    {blockedTime.reason}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showActionsModal && selectedSlot && (
        <TimeSlotActionsModal
          isOpen={showActionsModal}
          onClose={() => {
            setShowActionsModal(false);
            setSelectedSlot(null);
          }}
          timeSlot={selectedSlot.time}
          date={currentDate}
          teamMemberId={selectedSlot.teamMemberId}
          teamMemberName={selectedSlot.teamMemberName}
          venueId={venueId}
          venueName=""
          onSuccess={onRefresh}
        />
      )}

      {showBlockedTimeModal && selectedSlot && selectedBlockedTime && (
        <BlockedTimeModal
          isOpen={showBlockedTimeModal}
          onClose={() => {
            setShowBlockedTimeModal(false);
            setSelectedBlockedTime(null);
            setSelectedSlot(null);
          }}
          teamMemberId={selectedSlot.teamMemberId}
          teamMemberName={selectedSlot.teamMemberName}
          venueId={venueId}
          venueName=""
          date={currentDate}
          defaultStartTime={selectedSlot.time}
          existingBlockedTime={selectedBlockedTime}
          onSuccess={onRefresh}
        />
      )}
      {isEditModalOpen && (
        <>
          {isLoadingBooking ? (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
              <div className="bg-white rounded-lg p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading booking...</p>
              </div>
            </div>
          ) : selectedBooking ? (
            <EditAppointmentModal
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
                setSelectedBooking(null);
              }}
              booking={selectedBooking}
              onSuccess={handleEditSuccess}
            />
          ) : null}
        </>
      )}
      {/* Loading Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
            {/* Spinning loader */}
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
            </div>

            {/* Loading text */}
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">
                Saving changes...
              </p>
              <p className="text-sm text-gray-500 mt-1">Please wait</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
