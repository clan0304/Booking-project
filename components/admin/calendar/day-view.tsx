// components/admin/calendar/day-view.tsx
'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
  AppointmentWithBooking,
  AppointmentsByMember,
  BlockedTime,
} from '@/types/calendar';
import { EditAppointmentModal } from './appointment/edit-appointment-modal';
import Image from 'next/image';
import { getBookingByAppointmentId } from '@/app/actions/calendar-appointments';
import type { BookingGroupWithAppointments } from '@/types/calendar';
import { BookingHoldBlock } from './booking-hold-block';
import type { BookingHold } from './calendar-client';

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
  bookingHolds: BookingHold[];
  venueId: string;
  onRefresh: () => void;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const totalMinutes = timeToMinutes(time) + minutes;
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  return minutesToTime(clamped);
}

interface AppointmentLayout {
  width: string;
  left: string;
  zIndex: number;
}

function calculateAppointmentLayouts(
  appointments: AppointmentWithBooking[]
): Map<string, AppointmentLayout> {
  const layouts = new Map<string, AppointmentLayout>();

  if (appointments.length === 0) return layouts;

  const sorted = [...appointments].sort((a, b) => {
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });

  const groups: AppointmentWithBooking[][] = [];
  let currentGroup: AppointmentWithBooking[] = [];
  let groupEnd = 0;

  for (const appointment of sorted) {
    const start = timeToMinutes(appointment.start_time);
    const end = timeToMinutes(appointment.end_time);

    if (currentGroup.length === 0 || start < groupEnd) {
      currentGroup.push(appointment);
      groupEnd = Math.max(groupEnd, end);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [appointment];
      groupEnd = end;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  for (const group of groups) {
    const maxConcurrent = group.length;

    for (const appointment of group) {
      const position = group
        .sort(
          (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
        )
        .findIndex((a) => a.id === appointment.id);

      const widthPercent = 100 / maxConcurrent;
      const leftPercent = (position / maxConcurrent) * 100;

      layouts.set(appointment.id, {
        width: `${widthPercent - 0.5}%`,
        left: `${leftPercent}%`,
        zIndex: position,
      });
    }
  }

  return layouts;
}

// =====================================================
// INTERACTION STATE TYPE
// =====================================================
interface InteractionState {
  mode: 'resize-top' | 'resize-bottom' | 'drag';
  appointmentId: string;
  startY: number;
  startX: number;
  originalStartTime: string;
  originalEndTime: string;
  originalDuration: number;
  originalTeamMemberId: string;
  currentStartTime: string;
  currentEndTime: string;
  currentDuration: number;
  currentTeamMemberId: string | null;
}

interface LocalAppointmentUpdate {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  team_member_id?: string;
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
  bookingHolds,
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

  const [editModalInitialStep, setEditModalInitialStep] = useState<
    'view' | 'payment'
  >('view');

  // Loading state for save operation
  const [isSaving, setIsSaving] = useState(false);

  // Local state for updated appointments
  const [updatedAppointments, setUpdatedAppointments] = useState<
    Map<string, LocalAppointmentUpdate>
  >(new Map());

  // Interaction state for resize/drag
  const [interactionState, setInteractionState] =
    useState<InteractionState | null>(null);

  // Flag to prevent onClick after drag/resize
  const [justInteracted, setJustInteracted] = useState(false);

  // Current time for time indicator
  const [currentTime, setCurrentTime] = useState(new Date());

  // Ref to track column boundaries for horizontal drag
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Highlighted column during drag
  const [highlightedTeamMemberId, setHighlightedTeamMemberId] = useState<
    string | null
  >(null);

  // ✅ NEW: Floating card position for smooth Fresha-style drag
  const [floatingCardPosition, setFloatingCardPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Grouped hover state
  const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Generate time slots
  const timeSlots = useMemo((): string[] => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:15`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
      slots.push(`${hour.toString().padStart(2, '0')}:45`);
    }
    return slots;
  }, []);

  // Generate hour labels
  const hourLabels = useMemo((): string[] => {
    const labels: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      labels.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return labels;
  }, []);

  // Group appointments by team member
  const appointmentsByMember = useMemo((): AppointmentsByMember[] => {
    const appointmentsMap = new Map<string, AppointmentWithBooking[]>();

    bookings.forEach((booking) => {
      booking.appointments?.forEach((appointment) => {
        const localUpdate = updatedAppointments.get(appointment.id);
        const memberId =
          localUpdate?.team_member_id || appointment.team_member_id;

        if (!appointmentsMap.has(memberId)) {
          appointmentsMap.set(memberId, []);
        }

        const finalAppointment: AppointmentWithBooking = localUpdate
          ? {
              ...appointment,
              start_time: localUpdate.start_time,
              end_time: localUpdate.end_time,
              duration_minutes: localUpdate.duration_minutes,
              team_member_id:
                localUpdate.team_member_id || appointment.team_member_id,
              booking,
            }
          : {
              ...appointment,
              booking,
            };

        appointmentsMap.get(memberId)!.push(finalAppointment);
      });
    });

    const result: AppointmentsByMember[] = assignedTeamMembers.map(
      (member) => ({
        member,
        appointments: appointmentsMap.get(member.id) || [],
      })
    );

    appointmentsMap.forEach((appointments, memberId) => {
      const alreadyIncluded = result.some((r) => r.member.id === memberId);
      if (!alreadyIncluded && appointments.length > 0) {
        const firstAppt = appointments[0];
        if (firstAppt.team_member) {
          result.push({
            member: firstAppt.team_member,
            appointments,
          });
        }
      }
    });

    return result;
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

  // Group booking holds by team member
  const holdsByMember = useMemo(() => {
    const grouped = new Map<string, BookingHold[]>();

    bookingHolds.forEach((hold) => {
      if (hold.hold_date !== currentDate) return;

      const existing = grouped.get(hold.team_member_id) || [];
      existing.push(hold);
      grouped.set(hold.team_member_id, existing);
    });

    return grouped;
  }, [bookingHolds, currentDate]);

  // Calculate appointment layouts
  const allAppointmentLayouts = useMemo(() => {
    const layouts = new Map<string, Map<string, AppointmentLayout>>();

    appointmentsByMember.forEach(({ member, appointments }) => {
      layouts.set(member.id, calculateAppointmentLayouts(appointments));
    });

    return layouts;
  }, [appointmentsByMember]);

  // Format time for display
  const formatTime12Hour = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min}${period}`;
  };

  // Current time indicator
  const shouldShowCurrentTime = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return currentDate === todayStr;
  }, [currentDate]);

  const getCurrentTimePosition = useMemo(() => {
    if (!shouldShowCurrentTime) return null;

    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const top = (totalMinutes / 15) * 20;

    return {
      top,
      time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
        2,
        '0'
      )}`,
    };
  }, [shouldShowCurrentTime, currentTime]);

  // Auto-scroll to current time
  useEffect(() => {
    if (shouldShowCurrentTime && getCurrentTimePosition) {
      setTimeout(() => {
        const indicatorPosition = getCurrentTimePosition.top;
        const calendarElement = document.querySelector(
          '.bg-white.rounded-lg.border'
        );
        if (calendarElement) {
          const calendarTop =
            calendarElement.getBoundingClientRect().top + window.scrollY;
          const targetScroll =
            calendarTop + indicatorPosition - window.innerHeight / 2 + 200;

          window.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth',
          });
        }
      }, 100);
    }
  }, [shouldShowCurrentTime, getCurrentTimePosition, currentDate]);

  // Find team member from X position
  const findTeamMemberFromX = useCallback((clientX: number): string | null => {
    for (const [memberId, element] of columnRefs.current.entries()) {
      const rect = element.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return memberId;
      }
    }
    return null;
  }, []);

  // ============================================
  // INTERACTION HANDLERS
  // ============================================

  const handleResizeTopStart = (appointmentId: string, startY: number) => {
    const appointment = appointmentsByMember
      .flatMap((m) => m.appointments)
      .find((a) => a.id === appointmentId);

    if (!appointment) return;

    setInteractionState({
      mode: 'resize-top',
      appointmentId,
      startY,
      startX: 0,
      originalStartTime: appointment.start_time,
      originalEndTime: appointment.end_time,
      originalDuration: appointment.duration_minutes,
      originalTeamMemberId: appointment.team_member_id,
      currentStartTime: appointment.start_time,
      currentEndTime: appointment.end_time,
      currentDuration: appointment.duration_minutes,
      currentTeamMemberId: null,
    });
  };

  const handleResizeBottomStart = (appointmentId: string, startY: number) => {
    const appointment = appointmentsByMember
      .flatMap((m) => m.appointments)
      .find((a) => a.id === appointmentId);

    if (!appointment) return;

    setInteractionState({
      mode: 'resize-bottom',
      appointmentId,
      startY,
      startX: 0,
      originalStartTime: appointment.start_time,
      originalEndTime: appointment.end_time,
      originalDuration: appointment.duration_minutes,
      originalTeamMemberId: appointment.team_member_id,
      currentStartTime: appointment.start_time,
      currentEndTime: appointment.end_time,
      currentDuration: appointment.duration_minutes,
      currentTeamMemberId: null,
    });
  };

  const handleDragStart = (
    appointmentId: string,
    startY: number,
    startX: number,
    cardRect?: { top: number; left: number; width: number; height: number }
  ) => {
    const appointment = appointmentsByMember
      .flatMap((m) => m.appointments)
      .find((a) => a.id === appointmentId);

    if (!appointment) return;

    // ✅ Calculate offset from cursor to card top-left for smooth dragging
    if (cardRect) {
      dragOffsetRef.current = {
        x: startX - cardRect.left,
        y: startY - cardRect.top,
      };
      // Initialize floating position
      setFloatingCardPosition({
        x: cardRect.left,
        y: cardRect.top,
      });
    }

    setInteractionState({
      mode: 'drag',
      appointmentId,
      startY,
      startX,
      originalStartTime: appointment.start_time,
      originalEndTime: appointment.end_time,
      originalDuration: appointment.duration_minutes,
      originalTeamMemberId: appointment.team_member_id,
      currentStartTime: appointment.start_time,
      currentEndTime: appointment.end_time,
      currentDuration: appointment.duration_minutes,
      currentTeamMemberId: null,
    });
  };

  const handleInteractionMove = (clientY: number, clientX: number) => {
    if (!interactionState) return;

    const deltaY = clientY - interactionState.startY;
    const deltaMinutes = Math.round((deltaY / 20) * 15);
    const snappedDelta = Math.round(deltaMinutes / 5) * 5;

    let newStartTime: string;
    let newEndTime: string;
    let newDuration: number;
    let newTeamMemberId: string | null = interactionState.currentTeamMemberId;

    switch (interactionState.mode) {
      case 'resize-top':
        newStartTime = addMinutesToTime(
          interactionState.originalStartTime,
          snappedDelta
        );
        newEndTime = interactionState.originalEndTime;

        const startMinutes = timeToMinutes(newStartTime);
        const endMinutes = timeToMinutes(newEndTime);
        newDuration = Math.max(5, endMinutes - startMinutes);

        if (newDuration < 5) {
          newStartTime = addMinutesToTime(newEndTime, -5);
          newDuration = 5;
        }
        break;

      case 'resize-bottom':
        newStartTime = interactionState.originalStartTime;
        newDuration = Math.max(
          5,
          interactionState.originalDuration + snappedDelta
        );
        newEndTime = addMinutesToTime(newStartTime, newDuration);
        break;

      case 'drag':
        // ✅ Update floating card position to follow cursor exactly
        setFloatingCardPosition({
          x: clientX - dragOffsetRef.current.x,
          y: clientY - dragOffsetRef.current.y,
        });

        // Calculate snapped time for the drop preview
        newStartTime = addMinutesToTime(
          interactionState.originalStartTime,
          snappedDelta
        );
        newEndTime = addMinutesToTime(
          interactionState.originalEndTime,
          snappedDelta
        );
        newDuration = interactionState.originalDuration;

        // Detect which column the cursor is over
        const targetMemberId = findTeamMemberFromX(clientX);

        if (targetMemberId) {
          if (targetMemberId !== interactionState.originalTeamMemberId) {
            newTeamMemberId = targetMemberId;
            setHighlightedTeamMemberId(targetMemberId);
          } else {
            newTeamMemberId = null;
            setHighlightedTeamMemberId(null);
          }
        }
        break;

      default:
        return;
    }

    setInteractionState({
      ...interactionState,
      currentStartTime: newStartTime,
      currentEndTime: newEndTime,
      currentDuration: newDuration,
      currentTeamMemberId: newTeamMemberId,
    });
  };

  const handleInteractionEnd = async () => {
    if (!interactionState) return;

    setHighlightedTeamMemberId(null);
    setFloatingCardPosition(null); // ✅ Clear floating card

    const appointment = appointmentsByMember
      .flatMap((m) => m.appointments)
      .find((a) => a.id === interactionState.appointmentId);

    if (!appointment) {
      setInteractionState(null);
      return;
    }

    const startChanged =
      interactionState.currentStartTime !== interactionState.originalStartTime;
    const endChanged =
      interactionState.currentEndTime !== interactionState.originalEndTime;
    const durationChanged =
      interactionState.currentDuration !== interactionState.originalDuration;
    const teamMemberChanged =
      interactionState.currentTeamMemberId !== null &&
      interactionState.currentTeamMemberId !==
        interactionState.originalTeamMemberId;

    if (
      !startChanged &&
      !durationChanged &&
      !endChanged &&
      !teamMemberChanged
    ) {
      setInteractionState(null);
      return;
    }

    const appointmentId = interactionState.appointmentId;
    const newStartTime = interactionState.currentStartTime;
    const newEndTime = interactionState.currentEndTime;
    const newDuration = interactionState.currentDuration;
    const newTeamMemberId = interactionState.currentTeamMemberId;
    const mode = interactionState.mode;

    setInteractionState(null);

    setJustInteracted(true);
    setTimeout(() => setJustInteracted(false), 100);

    setUpdatedAppointments((prev) => {
      const updated = new Map(prev);
      const updateData: LocalAppointmentUpdate = {
        start_time: newStartTime,
        end_time: newEndTime,
        duration_minutes: newDuration,
      };
      if (newTeamMemberId) {
        updateData.team_member_id = newTeamMemberId;
      }
      updated.set(appointmentId, updateData);
      return updated;
    });

    setIsSaving(true);

    try {
      const { resizeAppointment, moveAppointment } = await import(
        '@/app/actions/calendar-appointments'
      );

      let result;

      if (mode === 'drag') {
        result = await moveAppointment({
          appointmentId,
          bookingId: appointment.booking.id,
          newStartTime,
          newEndTime,
          newTeamMemberId: newTeamMemberId || undefined,
        });
      } else {
        result = await resizeAppointment({
          appointmentId,
          bookingId: appointment.booking.id,
          newStartTime,
          newEndTime,
          newDuration,
        });
      }

      if (!result.success) {
        setUpdatedAppointments((prev) => {
          const updated = new Map(prev);
          updated.delete(appointmentId);
          return updated;
        });
        alert(result.error || 'Failed to update appointment');
      } else if (teamMemberChanged) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      setUpdatedAppointments((prev) => {
        const updated = new Map(prev);
        updated.delete(appointmentId);
        return updated;
      });
      alert('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  // Column width calculation
  const getColumnWidth = (memberCount: number): string => {
    if (memberCount === 1) return '100%';
    if (memberCount === 2) return '50%';
    if (memberCount === 3) return '33.333%';
    if (memberCount === 4) return '25%';
    if (memberCount === 5) return '20%';
    return '200px';
  };

  const columnWidth = getColumnWidth(appointmentsByMember.length);
  const useFixedWidth = appointmentsByMember.length >= 6;

  // Slot click handler
  const handleSlotClick = (
    time: string,
    teamMemberId: string,
    teamMemberName: string
  ) => {
    setSelectedSlot({ time, teamMemberId, teamMemberName });
    setShowActionsModal(true);
  };

  // Blocked time click handler
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

  // Handle checkout from create appointment modal (with products)
  // Appointment click handler
  const handleAppointmentClick = async (
    appointment: AppointmentWithBooking
  ) => {
    if (justInteracted) return;

    setIsLoadingBooking(true);
    setIsEditModalOpen(true);
    setEditModalInitialStep('view');

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
      console.error('Error fetching booking:', error);
      setIsEditModalOpen(false);
      alert('An unexpected error occurred');
    } finally {
      setIsLoadingBooking(false);
    }
  };

  // Get style for positioning
  const getStyle = (startTime: string, endTime: string) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const top = (startMinutes / 15) * 20;
    const height = ((endMinutes - startMinutes) / 15) * 20;
    return { top, height };
  };

  // Get hold style
  const getHoldStyle = (hold: BookingHold): { top: number; height: number } => {
    const [startHour, startMin] = hold.start_time.split(':').map(Number);
    const [endHour, endMin] = hold.end_time.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const top = (startMinutes / 15) * 20;
    const height = ((endMinutes - startMinutes) / 15) * 20;

    return { top, height: Math.max(height, 40) };
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {appointmentsByMember.length === 0 ? (
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
                <div className="flex-shrink-0 w-14" />

                {appointmentsByMember.map(({ member }) => (
                  <div
                    key={member.id}
                    className="border-r border-gray-200 py-3 px-2"
                    style={{
                      width: useFixedWidth ? '200px' : columnWidth,
                      minWidth: useFixedWidth ? '200px' : 'auto',
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {/* Photo - Smaller */}
                      <div className="flex-shrink-0">
                        {member.photo_url ? (
                          <Image
                            src={member.photo_url}
                            alt={`${member.first_name} ${member.last_name}`}
                            width={48}
                            height={48}
                            className="rounded-full object-cover"
                            style={{ width: '48px', height: '48px' }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                            <span className="text-sm font-semibold text-white">
                              {member.first_name[0]}
                              {member.last_name[0]}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <p className="text-sm font-semibold text-gray-900 truncate text-center w-full px-1">
                        {member.first_name} {member.last_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Time Grid */}
              <div className="flex">
                {/* Time Labels Column */}
                <div className="flex-shrink-0 w-14 border-r border-gray-200 bg-gray-50">
                  {timeSlots.map((time) => {
                    const isHourMark = time.endsWith(':00');
                    const showLabel = hourLabels.includes(time);
                    const hour = parseInt(time.split(':')[0]);
                    const isPM = hour >= 12;
                    const displayHour =
                      hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

                    return (
                      <div
                        key={time}
                        className={`h-5 flex items-start justify-end pr-2 ${
                          isHourMark ? 'border-t border-gray-200' : ''
                        }`}
                      >
                        {showLabel && (
                          <div className="flex flex-col items-end leading-none -mt-0.5">
                            <span className="text-xs font-medium text-gray-700">
                              {displayHour}:00
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {isPM ? 'pm' : 'am'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Team Member Columns */}
                {appointmentsByMember.map(({ member, appointments }) => {
                  const memberName = `${member.first_name} ${member.last_name}`;
                  const memberBlockedTimes =
                    blockedTimesByMember.get(member.id) || [];
                  const memberHolds = holdsByMember.get(member.id) || [];
                  const appointmentLayouts =
                    allAppointmentLayouts.get(member.id) || new Map();

                  return (
                    <div
                      key={member.id}
                      ref={(el) => {
                        if (el) {
                          columnRefs.current.set(member.id, el);
                        } else {
                          columnRefs.current.delete(member.id);
                        }
                      }}
                      className={`border-r border-gray-200 relative transition-colors ${
                        highlightedTeamMemberId === member.id
                          ? 'bg-purple-50'
                          : ''
                      }`}
                      style={{
                        width: useFixedWidth ? '200px' : columnWidth,
                        minWidth: useFixedWidth ? '200px' : 'auto',
                      }}
                    >
                      {/* Time Slots Background */}
                      <div className="relative">
                        {timeSlots.map((time) => {
                          const isHourMark = time.endsWith(':00');

                          const memberShifts = getShiftsForMemberAndDate(
                            member.id,
                            currentDate,
                            shifts
                          );
                          const inShift = isTimeInShift(time, memberShifts);
                          const isBlocked = isTimeBlocked(
                            time,
                            memberBlockedTimes
                          );

                          let bgColorClass = 'bg-gray-100';
                          let cursorClass = 'cursor-pointer';
                          let isClickable = true;
                          let titleText = formatTime12Hour(time);

                          if (isBlocked) {
                            // Blocked times are not clickable
                            bgColorClass = 'bg-gray-100';
                            cursorClass = 'cursor-not-allowed';
                            isClickable = false;
                            titleText = 'Time is blocked';
                          } else if (inShift) {
                            // Available working hours - full styling
                            bgColorClass =
                              'bg-white hover:bg-purple-50 active:bg-purple-100';
                          } else {
                            // Outside working hours but still clickable
                            bgColorClass =
                              'bg-gray-100 hover:bg-gray-200 active:bg-gray-300';
                            titleText = `${formatTime12Hour(
                              time
                            )} (Outside working hours)`;
                          }

                          return (
                            <div
                              key={time}
                              className={`h-5 border-t border-gray-100 transition-colors ${bgColorClass} ${cursorClass} relative group ${
                                isHourMark ? 'border-t-2 border-t-gray-300' : ''
                              }`}
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

                      {/* Appointments, Blocked Times, and Holds Overlay */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ height: `${timeSlots.length * 20}px` }}
                      >
                        {/* Current Time Indicator */}
                        {shouldShowCurrentTime &&
                          getCurrentTimePosition &&
                          member.id === appointmentsByMember[0]?.member.id && (
                            <div
                              className="absolute left-0 right-0 z-50 pointer-events-none"
                              style={{ top: `${getCurrentTimePosition.top}px` }}
                            >
                              <div className="relative">
                                <div className="absolute -left-4 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                                <div
                                  className="h-0.5 bg-red-500"
                                  style={{
                                    width: `calc(${
                                      appointmentsByMember.length * 100
                                    }% + 64px)`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                        {/* Ghost placeholder for appointment being dragged */}
                        {interactionState?.mode === 'drag' &&
                          interactionState?.originalTeamMemberId ===
                            member.id && (
                            <div
                              className="absolute px-1 pointer-events-none"
                              style={{
                                top: `${
                                  (timeToMinutes(
                                    interactionState.originalStartTime
                                  ) /
                                    15) *
                                  20
                                }px`,
                                height: `${
                                  ((timeToMinutes(
                                    interactionState.originalEndTime
                                  ) -
                                    timeToMinutes(
                                      interactionState.originalStartTime
                                    )) /
                                    15) *
                                  20 *
                                  0.99
                                }px`,
                                width: '100%',
                                left: '0%',
                              }}
                            >
                              <div className="h-full w-full rounded-lg border-2 border-dashed border-gray-400 bg-gray-200/50" />
                            </div>
                          )}

                        {/* Appointments */}
                        {appointments.map((appointment) => {
                          const isInteracting =
                            interactionState?.appointmentId === appointment.id;
                          const isDragging =
                            isInteracting && interactionState?.mode === 'drag';

                          // For non-dragging interactions (resize), use current values
                          // For dragging, show original position (floating card handles visual)
                          const displayStartTime =
                            isInteracting && !isDragging
                              ? interactionState.currentStartTime
                              : appointment.start_time;

                          const displayEndTime =
                            isInteracting && !isDragging
                              ? interactionState.currentEndTime
                              : appointment.end_time;

                          const displayDuration =
                            isInteracting && !isDragging
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
                              <div className="relative h-full w-[98%]">
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
                                    isGroupHovered={
                                      hoveredBookingId ===
                                      appointment.booking.id
                                    }
                                    onGroupHoverStart={() =>
                                      setHoveredBookingId(
                                        appointment.booking.id
                                      )
                                    }
                                    onGroupHoverEnd={() =>
                                      setHoveredBookingId(null)
                                    }
                                    isFloating={isDragging}
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

                        {/* Booking Holds */}
                        {memberHolds.map((hold) => {
                          const { top, height } = getHoldStyle(hold);
                          return (
                            <BookingHoldBlock
                              key={hold.id}
                              hold={hold}
                              topPosition={top}
                              height={height}
                            />
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

      {/* Loading Overlay */}
      {(isLoadingBooking || isSaving) && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 shadow-lg flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-700">
              {isSaving ? 'Saving...' : 'Loading...'}
            </span>
          </div>
        </div>
      )}

      {/* Time Slot Actions Modal */}
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

      {/* Blocked Time Modal */}
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

      {/* Edit Appointment Modal */}
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
                setEditModalInitialStep('view');
              }}
              booking={selectedBooking}
              initialStep={editModalInitialStep}
              onSuccess={() => {
                setIsEditModalOpen(false);
                setSelectedBooking(null);
                setEditModalInitialStep('view');
                setUpdatedAppointments(new Map());
                onRefresh();
              }}
            />
          ) : null}
        </>
      )}

      {/* ✅ Floating Card - follows cursor exactly during drag */}
      {interactionState?.mode === 'drag' &&
        floatingCardPosition &&
        (() => {
          // Find the appointment being dragged
          const draggedAppointment = bookings
            .flatMap(
              (b) => b.appointments?.map((a) => ({ ...a, booking: b })) || []
            )
            .find((a) => a.id === interactionState.appointmentId);

          if (!draggedAppointment) return null;

          const backgroundColor =
            draggedAppointment.booking.status === 'completed'
              ? '#9CA3AF'
              : draggedAppointment.category_color || '#4ECDC4';

          const clientName = `${draggedAppointment.booking.guest_first_name} ${
            draggedAppointment.booking.guest_last_name || ''
          }`.trim();

          // ✅ Use current (snapped) start time for real-time feedback
          const displayStartTime = interactionState.currentStartTime.substring(
            0,
            5
          );
          const displayEndTime = interactionState.currentEndTime.substring(
            0,
            5
          );

          // Format time for display (12-hour format)
          const formatTimeDisplay = (time: string): string => {
            const [hour, min] = time.split(':');
            const hourNum = parseInt(hour);
            const period = hourNum >= 12 ? 'pm' : 'am';
            const displayHour =
              hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
            return `${displayHour}:${min}${period}`;
          };

          const duration = interactionState.currentDuration;
          const height = (duration / 15) * 20;

          return (
            <div
              className="fixed pointer-events-none z-[1000]"
              style={{
                left: `${floatingCardPosition.x}px`,
                top: `${floatingCardPosition.y}px`,
                width: '180px',
                height: `${Math.max(height * 0.99, 40)}px`,
              }}
            >
              <div
                className="h-full w-full rounded-lg shadow-2xl ring-2 ring-purple-500 overflow-hidden"
                style={{ backgroundColor }}
              >
                <div className="h-full flex flex-col p-1.5 overflow-hidden">
                  {/* ✅ Show updated time range */}
                  <p className="text-xs text-white/90 truncate leading-tight">
                    {formatTimeDisplay(displayStartTime)} -{' '}
                    {formatTimeDisplay(displayEndTime)}
                  </p>
                  <p className="text-xs font-bold text-white truncate leading-tight mt-0.5">
                    {clientName || 'Walk-in'}
                  </p>
                  <p className="text-xs text-white/80 truncate leading-tight mt-0.5">
                    {draggedAppointment.service_name}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ✅ Drop Preview - shows where the appointment will land */}
      {interactionState?.mode === 'drag' &&
        (() => {
          const targetMemberId =
            interactionState.currentTeamMemberId ||
            interactionState.originalTeamMemberId;
          const targetColumn = columnRefs.current.get(targetMemberId);

          if (!targetColumn) return null;

          const columnRect = targetColumn.getBoundingClientRect();
          const duration = interactionState.currentDuration;
          const height = (duration / 15) * 20;
          const top =
            (timeToMinutes(interactionState.currentStartTime) / 15) * 20;

          return (
            <div
              className="fixed pointer-events-none z-[500]"
              style={{
                left: `${columnRect.left + 4}px`,
                top: `${columnRect.top + top}px`,
                width: `${columnRect.width - 8}px`,
                height: `${Math.max(height * 0.99, 40)}px`,
              }}
            >
              <div className="h-full w-full rounded-lg border-2 border-dashed border-purple-500 bg-purple-100/50" />
            </div>
          );
        })()}
    </>
  );
}
