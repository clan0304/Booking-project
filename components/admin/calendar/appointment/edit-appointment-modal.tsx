// components/admin/calendar/appointment/edit-appointment-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  updateCalendarAppointment,
  deleteCalendarAppointment,
  addAppointmentToBooking,
} from '@/app/actions/calendar-appointments';
import { getAvailableServices } from '@/app/actions/services';
import { getTeamMembersByVenue } from '@/app/actions/team-venue-assignments';
import { ViewMode } from './edit-appointment-view-mode';
import { EditMode } from './edit-appointment-edit-mode';
import { SingleEditMode } from './edit-appointment-single-mode';
import { PaymentMode } from './edit-appointment-payment-mode';
import type {
  EditAppointmentModalProps,
  ModalStep,
  BookingStatus,
  Service,
  TeamMember,
  TeamMemberAssignment,
  EditingAppointment,
} from './edit-appointment-types';

// =====================================================
// PENDING APPOINTMENT TYPE (for new additions)
// =====================================================
interface PendingAppointment {
  tempId: string;
  serviceId: string;
  serviceName: string;
  teamMemberId: string;
  startTime: string;
  duration: number;
  price: number;
  categoryColor?: string;
}

export function EditAppointmentModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
  initialStep = 'view',
  allowEdit = true,
}: EditAppointmentModalProps) {
  // =====================================================
  // STATE
  // =====================================================

  // Step management
  const [currentStep, setCurrentStep] = useState<ModalStep>(initialStep);
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>(
    booking.status as BookingStatus
  );
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Team members data
  const [availableTeamMembers, setAvailableTeamMembers] = useState<
    TeamMember[]
  >([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(true);

  // Services data per team member
  const [availableServices, setAvailableServices] = useState<
    Map<string, Service[]>
  >(new Map());
  const [servicesLoading, setServicesLoading] = useState<Set<string>>(
    new Set()
  );

  // Editing state for each appointment
  const [editingAppointments, setEditingAppointments] = useState<
    Map<string, EditingAppointment>
  >(new Map());
  const [expandedAppointmentId, setExpandedAppointmentId] = useState<
    string | null
  >(null);

  // ✅ NEW: Track which single appointment is being edited
  const [editingAppointmentId, setEditingAppointmentId] = useState<
    string | null
  >(null);

  // ✅ NEW: Pending deletions (local until save)
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(
    new Set()
  );

  // ✅ NEW: Pending additions (local until save)
  const [pendingAdditions, setPendingAdditions] = useState<
    Map<string, PendingAppointment>
  >(new Map());

  // Service picker state
  const [showServicePicker, setShowServicePicker] = useState<
    string | 'add-new' | null
  >(null);
  const [servicePickerTeamMemberId, setServicePickerTeamMemberId] =
    useState<string>('');

  // Dropdowns state
  const [showTeamMemberDropdown, setShowTeamMemberDropdown] = useState<
    string | null
  >(null);
  const [showTimeDropdown, setShowTimeDropdown] = useState<string | null>(null);
  const [showDurationDropdown, setShowDurationDropdown] = useState<
    string | null
  >(null);

  // Form state
  const [bookingNotes, setBookingNotes] = useState(booking.notes || '');
  const [internalNotes, setInternalNotes] = useState(
    booking.internal_notes || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  // ✅ NEW: Delete booking confirmation modal
  const [showDeleteBookingConfirm, setShowDeleteBookingConfirm] =
    useState(false);

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(initialStep);
      setError('');
    }
  }, [isOpen, initialStep]);

  useEffect(() => {
    const loadTeamMembers = async () => {
      setTeamMembersLoading(true);
      try {
        const result = await getTeamMembersByVenue(booking.venue_id);
        if (result.success && result.data) {
          const members: TeamMember[] = (
            result.data as TeamMemberAssignment[]
          ).map((assignment) => {
            const user = Array.isArray(assignment.users)
              ? assignment.users[0]
              : assignment.users;
            return {
              id: user.id,
              first_name: user.first_name,
              last_name: user.last_name,
              photo_url: user.photo_url,
            };
          });
          setAvailableTeamMembers(members);
        }
      } catch (err) {
        console.error('Error loading team members:', err);
        setError('Failed to load team members');
      } finally {
        setTeamMembersLoading(false);
      }
    };

    if (isOpen) {
      loadTeamMembers();
    }
  }, [isOpen, booking.venue_id]);

  useEffect(() => {
    if (isOpen && booking.appointments) {
      const editMap = new Map<string, EditingAppointment>();
      booking.appointments.forEach((appointment) => {
        editMap.set(appointment.id, {
          id: appointment.id,
          serviceId: appointment.service_id,
          serviceName: appointment.service_name,
          teamMemberId: appointment.team_member_id,
          startTime: appointment.start_time.substring(0, 5),
          duration: appointment.duration_minutes,
          price: appointment.price,
          categoryColor: appointment.category_color || undefined,
        });
      });
      setEditingAppointments(editMap);
      setBookingNotes(booking.notes || '');
      setInternalNotes(booking.internal_notes || '');
      setError('');
      setExpandedAppointmentId(null);

      // ✅ Reset pending changes
      setPendingDeletions(new Set());
      setPendingAdditions(new Map());

      // ✅ NEW: Load services for all team members to get category colors
      const teamMemberIds = new Set<string>();
      booking.appointments.forEach((appt) => {
        teamMemberIds.add(appt.team_member_id);
      });

      // Load services for each team member
      teamMemberIds.forEach(async (teamMemberId) => {
        try {
          const result = await getAvailableServices(
            booking.venue_id,
            teamMemberId
          );
          if (result.success && result.services) {
            setAvailableServices((prev) => {
              const newMap = new Map(prev);
              newMap.set(teamMemberId, result.services as Service[]);
              return newMap;
            });
          }
        } catch (err) {
          console.error('Error loading services for team member:', err);
        }
      });
    }
  }, [isOpen, booking]);

  // ✅ NEW: Update category colors when services are loaded
  useEffect(() => {
    if (availableServices.size === 0 || editingAppointments.size === 0) return;

    // Check if any appointments are missing category colors
    const appointmentsMissingColors = Array.from(
      editingAppointments.values()
    ).filter((appt) => !appt.categoryColor);

    if (appointmentsMissingColors.length === 0) return;

    let hasUpdates = false;
    const updatedAppointments = new Map(editingAppointments);

    appointmentsMissingColors.forEach((appt) => {
      // Find the service in loaded services
      const services = availableServices.get(appt.teamMemberId);
      if (services) {
        const service = services.find((s) => s.id === appt.serviceId);
        if (service?.service_categories?.color) {
          updatedAppointments.set(appt.id, {
            ...appt,
            categoryColor: service.service_categories.color,
          });
          hasUpdates = true;
        }
      }
    });

    if (hasUpdates) {
      setEditingAppointments(updatedAppointments);
    }
    // Only depend on availableServices changes, not editingAppointments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableServices]);

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  // ✅ Get count of visible appointments (existing - deleted + added)
  const getVisibleAppointmentCount = (): number => {
    const existingNotDeleted = Array.from(editingAppointments.keys()).filter(
      (id) => !pendingDeletions.has(id)
    ).length;
    return existingNotDeleted + pendingAdditions.size;
  };

  // ✅ Check if booking would be empty after save
  const wouldBeEmpty = (): boolean => {
    return getVisibleAppointmentCount() === 0;
  };

  // ✅ Check if there are any unsaved changes
  const hasUnsavedChanges = (): boolean => {
    // Check for pending deletions
    if (pendingDeletions.size > 0) return true;

    // Check for pending additions
    if (pendingAdditions.size > 0) return true;

    // Check for edits to existing appointments
    for (const [appointmentId, editedAppt] of editingAppointments) {
      const originalAppt = booking.appointments.find(
        (a) => a.id === appointmentId
      );
      if (!originalAppt) continue;

      const hasChanges =
        editedAppt.serviceId !== originalAppt.service_id ||
        editedAppt.teamMemberId !== originalAppt.team_member_id ||
        editedAppt.startTime !== originalAppt.start_time.substring(0, 5) ||
        editedAppt.duration !== originalAppt.duration_minutes ||
        editedAppt.price !== originalAppt.price;

      if (hasChanges) return true;
    }

    // Check for notes changes
    if (bookingNotes !== (booking.notes || '')) return true;
    if (internalNotes !== (booking.internal_notes || '')) return true;

    return false;
  };

  // =====================================================
  // HANDLERS
  // =====================================================

  const loadServicesForTeamMember = async (
    teamMemberId: string
  ): Promise<void> => {
    setServicesLoading((prev) => new Set(prev).add(teamMemberId));
    try {
      const result = await getAvailableServices(booking.venue_id, teamMemberId);
      if (result.success && result.services) {
        // Services are already in correct format from getAvailableServices
        // Just cast to our Service type (they match)
        setAvailableServices((prev) => {
          const newMap = new Map(prev);
          newMap.set(teamMemberId, result.services as Service[]);
          return newMap;
        });
      }
    } catch (err) {
      console.error('Error loading services:', err);
    } finally {
      setServicesLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(teamMemberId);
        return newSet;
      });
    }
  };

  const toggleAppointment = (id: string) => {
    setExpandedAppointmentId(expandedAppointmentId === id ? null : id);
  };

  const updateAppointmentField = <K extends keyof EditingAppointment>(
    id: string,
    field: K,
    value: EditingAppointment[K]
  ) => {
    // ✅ Check if it's a pending addition
    if (pendingAdditions.has(id)) {
      setPendingAdditions((prev) => {
        const newMap = new Map(prev);
        const pending = newMap.get(id);
        if (pending) {
          const updated = { ...pending, [field]: value };
          newMap.set(id, updated);
        }
        return newMap;
      });
    } else {
      setEditingAppointments((prev) => {
        const newMap = new Map(prev);
        const appt = newMap.get(id);
        if (appt) {
          newMap.set(id, { ...appt, [field]: value });
        }
        return newMap;
      });
    }
  };

  const handleTeamMemberChange = async (
    appointmentId: string,
    teamMemberId: string
  ): Promise<void> => {
    if (!availableServices.has(teamMemberId)) {
      await loadServicesForTeamMember(teamMemberId);
    }

    updateAppointmentField(appointmentId, 'teamMemberId', teamMemberId);

    // Get current appointment data
    const currentAppt = pendingAdditions.has(appointmentId)
      ? pendingAdditions.get(appointmentId)
      : editingAppointments.get(appointmentId);

    if (currentAppt) {
      const services = availableServices.get(teamMemberId) || [];
      const matchingService = services.find(
        (s) => s.id === currentAppt.serviceId
      );

      if (matchingService) {
        updateAppointmentField(
          appointmentId,
          'price',
          matchingService.base_price || 0
        );
        updateAppointmentField(
          appointmentId,
          'duration',
          matchingService.base_duration
        );
      }
    }

    setShowTeamMemberDropdown(null);
  };

  // ✅ MODIFIED: Delete appointment locally (no API call until save)
  const handleDeleteAppointment = async (
    appointmentId: string
  ): Promise<void> => {
    const visibleCount = getVisibleAppointmentCount();

    // If this is the last visible appointment, show delete booking confirm
    if (visibleCount <= 1) {
      setShowDeleteBookingConfirm(true);
      return;
    }

    // ✅ Check if it's a pending addition (just remove from state)
    if (pendingAdditions.has(appointmentId)) {
      setPendingAdditions((prev) => {
        const newMap = new Map(prev);
        newMap.delete(appointmentId);
        return newMap;
      });
    } else {
      // ✅ Mark existing appointment for deletion (local only)
      setPendingDeletions((prev) => new Set(prev).add(appointmentId));
    }

    // Clear expanded state if this was expanded
    if (expandedAppointmentId === appointmentId) {
      setExpandedAppointmentId(null);
    }
  };

  // ✅ MODIFIED: Save all changes at once
  const handleSaveAll = async (): Promise<void> => {
    // Check if booking would be empty
    if (wouldBeEmpty()) {
      setShowDeleteBookingConfirm(true);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 1. Delete appointments marked for deletion
      for (const appointmentId of pendingDeletions) {
        const result = await deleteCalendarAppointment(
          appointmentId,
          booking.id
        );
        if (!result.success) {
          setError(result.error || 'Failed to delete appointment');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Create new appointments (pending additions)
      for (const [, pending] of pendingAdditions) {
        const result = await addAppointmentToBooking({
          bookingId: booking.id,
          serviceId: pending.serviceId,
          serviceName: pending.serviceName,
          teamMemberId: pending.teamMemberId,
          startTime: pending.startTime,
          duration: pending.duration,
          price: pending.price,
        });
        if (!result.success) {
          setError(result.error || 'Failed to add appointment');
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Update edited existing appointments
      for (const [appointmentId, editedAppt] of editingAppointments) {
        // Skip deleted appointments
        if (pendingDeletions.has(appointmentId)) continue;

        const originalAppt = booking.appointments.find(
          (a) => a.id === appointmentId
        );
        if (!originalAppt) continue;

        const hasChanges =
          editedAppt.serviceId !== originalAppt.service_id ||
          editedAppt.teamMemberId !== originalAppt.team_member_id ||
          editedAppt.startTime !== originalAppt.start_time.substring(0, 5) ||
          editedAppt.duration !== originalAppt.duration_minutes ||
          editedAppt.price !== originalAppt.price;

        if (hasChanges) {
          const result = await updateCalendarAppointment({
            appointmentId: appointmentId,
            bookingId: booking.id,
            serviceId: editedAppt.serviceId,
            serviceName: editedAppt.serviceName,
            teamMemberId: editedAppt.teamMemberId,
            startTime: editedAppt.startTime,
            duration: editedAppt.duration,
            price: editedAppt.price,
            bookingNotes: bookingNotes,
            internalNotes: internalNotes,
          });

          if (!result.success) {
            setError(result.error || 'Failed to update appointment');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 4. Update notes if changed (and no other updates handled it)
      const notesChanged =
        bookingNotes !== (booking.notes || '') ||
        internalNotes !== (booking.internal_notes || '');

      const hasOtherUpdates =
        pendingDeletions.size > 0 ||
        pendingAdditions.size > 0 ||
        Array.from(editingAppointments.entries()).some(([id, edited]) => {
          if (pendingDeletions.has(id)) return false;
          const orig = booking.appointments.find((a) => a.id === id);
          if (!orig) return false;
          return (
            edited.serviceId !== orig.service_id ||
            edited.teamMemberId !== orig.team_member_id ||
            edited.startTime !== orig.start_time.substring(0, 5) ||
            edited.duration !== orig.duration_minutes ||
            edited.price !== orig.price
          );
        });

      if (notesChanged && !hasOtherUpdates) {
        // Find first non-deleted appointment to update notes
        const firstNonDeleted = Array.from(editingAppointments.entries()).find(
          ([id]) => !pendingDeletions.has(id)
        );
        if (firstNonDeleted) {
          await updateCalendarAppointment({
            appointmentId: firstNonDeleted[0],
            bookingId: booking.id,
            bookingNotes: bookingNotes,
            internalNotes: internalNotes,
          });
        }
      }

      // ✅ Clear pending states immediately (UI updates)
      setPendingDeletions(new Set());
      setPendingAdditions(new Map());

      // ✅ Call onSuccess to refresh parent data
      // Parent will pass new booking prop, triggering useEffect to sync state
      onSuccess();

      // ✅ DON'T close modal - stay in View Mode
      // User can close manually or continue with Checkout
      setCurrentStep('view');
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ MODIFIED: Show confirmation instead of browser confirm
  const handleDeleteBooking = async (): Promise<void> => {
    setShowDeleteBookingConfirm(true);
  };

  // ✅ NEW: Confirm delete booking
  const confirmDeleteBooking = async (): Promise<void> => {
    setShowDeleteBookingConfirm(false);
    setIsDeleting(true);
    setError('');

    try {
      // Delete all existing appointments (not pending additions)
      for (const appointmentId of editingAppointments.keys()) {
        const result = await deleteCalendarAppointment(
          appointmentId,
          booking.id
        );
        if (!result.success) {
          setError(result.error || 'Failed to delete booking');
          setIsDeleting(false);
          return;
        }
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShowServicePicker = (appointmentId: string | 'add-new') => {
    if (appointmentId === 'add-new') {
      // ✅ Use first visible appointment's team member
      const firstExisting = Array.from(editingAppointments.values()).find(
        (appt) => !pendingDeletions.has(appt.id)
      );
      const firstPending = Array.from(pendingAdditions.values())[0];
      const firstAppt = firstExisting || firstPending;

      if (firstAppt) {
        setServicePickerTeamMemberId(firstAppt.teamMemberId);
        if (!availableServices.has(firstAppt.teamMemberId)) {
          loadServicesForTeamMember(firstAppt.teamMemberId);
        }
      }
    } else {
      // ✅ FIXED: Also load services when editing existing appointment
      const appointment = pendingAdditions.has(appointmentId)
        ? pendingAdditions.get(appointmentId)
        : editingAppointments.get(appointmentId);
      if (appointment) {
        setServicePickerTeamMemberId(appointment.teamMemberId);
        // Load services if not already loaded
        if (!availableServices.has(appointment.teamMemberId)) {
          loadServicesForTeamMember(appointment.teamMemberId);
        }
      }
    }
    setShowServicePicker(appointmentId);
  };

  const handleStatusChange = (status: BookingStatus) => {
    setBookingStatus(status);
    setShowStatusDropdown(false);
  };

  // ✅ UPDATED: Checkout saves to DB first, then goes to payment
  const handleCheckout = async (): Promise<void> => {
    // If there are unsaved changes, save them first
    if (hasUnsavedChanges()) {
      // Check if booking would be empty
      if (wouldBeEmpty()) {
        setShowDeleteBookingConfirm(true);
        return;
      }

      setIsSubmitting(true);
      setError('');

      try {
        // 1. Delete appointments marked for deletion
        for (const appointmentId of pendingDeletions) {
          const result = await deleteCalendarAppointment(
            appointmentId,
            booking.id
          );
          if (!result.success) {
            setError(result.error || 'Failed to delete appointment');
            setIsSubmitting(false);
            return;
          }
        }

        // 2. Create new appointments (pending additions)
        for (const [, pending] of pendingAdditions) {
          const result = await addAppointmentToBooking({
            bookingId: booking.id,
            serviceId: pending.serviceId,
            serviceName: pending.serviceName,
            teamMemberId: pending.teamMemberId,
            startTime: pending.startTime,
            duration: pending.duration,
            price: pending.price,
          });
          if (!result.success) {
            setError(result.error || 'Failed to add appointment');
            setIsSubmitting(false);
            return;
          }
        }

        // 3. Update edited existing appointments
        for (const [appointmentId, editedAppt] of editingAppointments) {
          if (pendingDeletions.has(appointmentId)) continue;

          const originalAppt = booking.appointments.find(
            (a) => a.id === appointmentId
          );
          if (!originalAppt) continue;

          const hasChanges =
            editedAppt.serviceId !== originalAppt.service_id ||
            editedAppt.teamMemberId !== originalAppt.team_member_id ||
            editedAppt.startTime !== originalAppt.start_time.substring(0, 5) ||
            editedAppt.duration !== originalAppt.duration_minutes ||
            editedAppt.price !== originalAppt.price;

          if (hasChanges) {
            const result = await updateCalendarAppointment({
              appointmentId: appointmentId,
              bookingId: booking.id,
              serviceId: editedAppt.serviceId,
              serviceName: editedAppt.serviceName,
              teamMemberId: editedAppt.teamMemberId,
              startTime: editedAppt.startTime,
              duration: editedAppt.duration,
              price: editedAppt.price,
              bookingNotes: bookingNotes,
              internalNotes: internalNotes,
            });

            if (!result.success) {
              setError(result.error || 'Failed to update appointment');
              setIsSubmitting(false);
              return;
            }
          }
        }

        // 4. Update notes if changed
        const notesChanged =
          bookingNotes !== (booking.notes || '') ||
          internalNotes !== (booking.internal_notes || '');

        if (notesChanged) {
          const firstNonDeleted = Array.from(
            editingAppointments.entries()
          ).find(([id]) => !pendingDeletions.has(id));
          if (firstNonDeleted) {
            await updateCalendarAppointment({
              appointmentId: firstNonDeleted[0],
              bookingId: booking.id,
              bookingNotes: bookingNotes,
              internalNotes: internalNotes,
            });
          }
        }

        // Clear pending states
        setPendingDeletions(new Set());
        setPendingAdditions(new Map());

        // Refresh parent data
        onSuccess();
      } catch (err) {
        setError('An unexpected error occurred');
        console.error(err);
        setIsSubmitting(false);
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    // Go to payment
    setCurrentStep('payment');
  };

  const handleToggleEdit = () => {
    setCurrentStep('edit');
  };

  // ✅ NEW: Handle editing a specific appointment
  const handleEditAppointment = (appointmentId: string) => {
    setEditingAppointmentId(appointmentId);
    setCurrentStep('edit-single');
  };

  // =====================================================
  // SERVICE SELECTION HANDLER
  // =====================================================

  const handleSelectService = async (service: Service) => {
    const appointmentIdOrAdd = showServicePicker;

    if (appointmentIdOrAdd === 'add-new') {
      // ✅ MODIFIED: Add locally instead of API call
      const tempId = `pending-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Calculate suggested start time (after last visible appointment)
      let suggestedStartTime = '09:00';

      // Get all visible appointments
      const visibleAppointments: Array<{
        startTime: string;
        duration: number;
      }> = [];

      editingAppointments.forEach((appt, id) => {
        if (!pendingDeletions.has(id)) {
          visibleAppointments.push({
            startTime: appt.startTime,
            duration: appt.duration,
          });
        }
      });

      pendingAdditions.forEach((pending) => {
        visibleAppointments.push({
          startTime: pending.startTime,
          duration: pending.duration,
        });
      });

      if (visibleAppointments.length > 0) {
        let latestEnd = 0;
        visibleAppointments.forEach((appt) => {
          const endMinutes = timeToMinutes(appt.startTime) + appt.duration;
          if (endMinutes > latestEnd) {
            latestEnd = endMinutes;
          }
        });
        suggestedStartTime = minutesToTime(latestEnd);
      }

      // ✅ Add to pending additions (local only)
      const newPending: PendingAppointment = {
        tempId,
        serviceId: service.id,
        serviceName: service.name,
        teamMemberId: servicePickerTeamMemberId,
        startTime: suggestedStartTime,
        duration: service.base_duration,
        price: service.base_price || 0,
        categoryColor: service.service_categories?.color || undefined,
      };

      setPendingAdditions((prev) => {
        const newMap = new Map(prev);
        newMap.set(tempId, newPending);
        return newMap;
      });

      setShowServicePicker(null);
    } else if (appointmentIdOrAdd) {
      // Updating existing appointment's service
      updateAppointmentField(appointmentIdOrAdd, 'serviceId', service.id);
      updateAppointmentField(appointmentIdOrAdd, 'serviceName', service.name);
      updateAppointmentField(
        appointmentIdOrAdd,
        'price',
        service.base_price || 0
      );
      updateAppointmentField(
        appointmentIdOrAdd,
        'duration',
        service.base_duration
      );
      updateAppointmentField(
        appointmentIdOrAdd,
        'categoryColor',
        service.service_categories?.color || undefined
      );
      setShowServicePicker(null);
    }
  };

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const getTeamMember = (teamMemberId: string): TeamMember | undefined => {
    return availableTeamMembers.find((m) => m.id === teamMemberId);
  };

  const getService = (
    teamMemberId: string,
    serviceId: string
  ): Service | undefined => {
    const services = availableServices.get(teamMemberId);
    return services?.find((s) => s.id === serviceId);
  };

  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 15) {
        slots.push(
          `${hour.toString().padStart(2, '0')}:${min
            .toString()
            .padStart(2, '0')}`
        );
      }
    }
    return slots;
  };

  const generateDurationOptions = (): number[] => {
    const options: number[] = [];
    for (let i = 15; i <= 240; i += 15) {
      options.push(i);
    }
    return options;
  };

  const formatTime = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min}${period}`;
  };

  const getDurationDisplay = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPriceDisplay = (price: number): string => {
    return price === 0 ? 'Free' : `A$${price.toFixed(0)}`;
  };

  const getClientName = (): string => {
    if (booking.client) {
      return `${booking.client.first_name} ${
        booking.client.last_name || ''
      }`.trim();
    }
    return `${booking.guest_first_name || ''} ${
      booking.guest_last_name || ''
    }`.trim();
  };

  const getClientInitials = (): string => {
    const name = getClientName();
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // ✅ MODIFIED: Calculate total from visible appointments
  const getTotalPrice = (): number => {
    let total = 0;

    // Add existing appointments (not deleted)
    editingAppointments.forEach((appt, id) => {
      if (!pendingDeletions.has(id)) {
        total += appt.price || 0;
      }
    });

    // Add pending additions
    pendingAdditions.forEach((pending) => {
      total += pending.price || 0;
    });

    return total;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      confirmed: 'Confirmed',
      cancelled: 'Cancelled',
      completed: 'Completed',
      no_show: 'No Show',
    };
    return labels[status] || status;
  };

  // ✅ NEW: Get visible appointments map (for passing to child components)
  const getVisibleAppointments = (): Map<string, EditingAppointment> => {
    const visible = new Map<string, EditingAppointment>();

    // Add existing appointments (not deleted)
    editingAppointments.forEach((appt, id) => {
      if (!pendingDeletions.has(id)) {
        visible.set(id, appt);
      }
    });

    // Add pending additions as EditingAppointment
    pendingAdditions.forEach((pending, tempId) => {
      visible.set(tempId, {
        id: tempId,
        serviceId: pending.serviceId,
        serviceName: pending.serviceName,
        teamMemberId: pending.teamMemberId,
        startTime: pending.startTime,
        duration: pending.duration,
        price: pending.price,
        categoryColor: pending.categoryColor,
      });
    });

    return visible;
  };

  // =====================================================
  // SERVICE PICKER RENDER
  // =====================================================

  const renderServicePicker = () => {
    const services = availableServices.get(servicePickerTeamMemberId) || [];

    // Group services by category
    const groupedServices = services.reduce((acc, service) => {
      const categoryName = service.service_categories?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(service);
      return acc;
    }, {} as Record<string, Service[]>);

    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-[61]"
          onClick={() => setShowServicePicker(null)}
        />
        <div className="absolute inset-0 bg-white z-[62] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <button
              onClick={() => setShowServicePicker(null)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">Select Service</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {servicesLoading.has(servicePickerTeamMemberId) ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedServices).map(
                  ([categoryName, categoryServices]) => (
                    <div key={categoryName}>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">
                        {categoryName}
                      </h3>
                      <div className="space-y-2">
                        {categoryServices.map((service) => (
                          <button
                            key={service.id}
                            onClick={() => handleSelectService(service)}
                            className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors flex items-center gap-3"
                          >
                            <div
                              className="w-1 h-12 rounded-full"
                              style={{
                                backgroundColor:
                                  service.service_categories?.color ||
                                  '#8B5CF6',
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">
                                {service.name}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {service.base_duration} min
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">
                                A$ {service.base_price?.toFixed(0) || 0}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  if (!isOpen) return null;

  // ✅ Get visible appointments for child components
  const visibleAppointments = getVisibleAppointments();

  const renderContent = () => {
    switch (currentStep) {
      case 'view':
        return (
          <ViewMode
            booking={booking}
            editingAppointments={visibleAppointments}
            availableTeamMembers={availableTeamMembers}
            availableServices={availableServices}
            bookingStatus={bookingStatus}
            showStatusDropdown={showStatusDropdown}
            showMoreMenu={showMoreMenu}
            bookingNotes={bookingNotes}
            allowEdit={allowEdit}
            hasUnsavedChanges={hasUnsavedChanges()}
            isSaving={isSubmitting}
            onStatusChange={handleStatusChange}
            onToggleStatusDropdown={() =>
              setShowStatusDropdown(!showStatusDropdown)
            }
            onToggleMoreMenu={() => setShowMoreMenu(!showMoreMenu)}
            onCheckout={handleCheckout}
            onSave={handleSaveAll}
            onToggleEdit={handleToggleEdit}
            onEditAppointment={handleEditAppointment}
            onDeleteBooking={handleDeleteBooking}
            onDeleteAppointment={handleDeleteAppointment}
            onClose={onClose}
            formatDate={formatDate}
            formatTime={formatTime}
            getPriceDisplay={getPriceDisplay}
            getClientName={getClientName}
            getClientInitials={getClientInitials}
            getTotalPrice={getTotalPrice}
            getStatusLabel={getStatusLabel}
          />
        );

      case 'edit':
        return (
          <EditMode
            booking={booking}
            editingAppointments={visibleAppointments}
            expandedAppointmentId={expandedAppointmentId}
            availableTeamMembers={availableTeamMembers}
            teamMembersLoading={teamMembersLoading}
            availableServices={availableServices}
            servicesLoading={servicesLoading}
            showTeamMemberDropdown={showTeamMemberDropdown}
            showTimeDropdown={showTimeDropdown}
            showDurationDropdown={showDurationDropdown}
            bookingNotes={bookingNotes}
            internalNotes={internalNotes}
            isSubmitting={isSubmitting}
            isDeleting={isDeleting}
            onToggleAppointment={toggleAppointment}
            onUpdateAppointmentField={updateAppointmentField}
            onTeamMemberChange={handleTeamMemberChange}
            onDeleteAppointment={handleDeleteAppointment}
            onSaveAll={handleSaveAll}
            onDeleteBooking={handleDeleteBooking}
            onShowServicePicker={handleShowServicePicker}
            onBack={() => setCurrentStep('view')}
            onClose={onClose}
            setShowTeamMemberDropdown={setShowTeamMemberDropdown}
            setShowTimeDropdown={setShowTimeDropdown}
            setShowDurationDropdown={setShowDurationDropdown}
            setBookingNotes={setBookingNotes}
            setInternalNotes={setInternalNotes}
            getTeamMember={getTeamMember}
            getService={getService}
            formatTime={formatTime}
            getDurationDisplay={getDurationDisplay}
            generateTimeSlots={generateTimeSlots}
            generateDurationOptions={generateDurationOptions}
          />
        );

      case 'edit-single':
        // Get the appointment being edited
        const singleAppointment = editingAppointmentId
          ? visibleAppointments.get(editingAppointmentId)
          : undefined;

        if (!singleAppointment || !editingAppointmentId) {
          // Fallback to view if no appointment selected
          setCurrentStep('view');
          return null;
        }

        return (
          <SingleEditMode
            appointment={singleAppointment}
            appointmentId={editingAppointmentId}
            teamMember={getTeamMember(singleAppointment.teamMemberId)}
            availableTeamMembers={availableTeamMembers}
            availableServices={availableServices}
            teamMembersLoading={teamMembersLoading}
            showTeamMemberDropdown={showTeamMemberDropdown}
            showTimeDropdown={showTimeDropdown}
            showDurationDropdown={showDurationDropdown}
            isSaving={false} // Never saving in single edit - just applying locally
            canDelete={visibleAppointments.size > 1}
            onUpdateAppointmentField={updateAppointmentField}
            onTeamMemberChange={handleTeamMemberChange}
            onDeleteAppointment={async (id) => {
              await handleDeleteAppointment(id);
              setCurrentStep('view');
            }}
            onShowServicePicker={(id) => handleShowServicePicker(id)}
            onSave={() => {
              // ✅ FIXED: Don't save to DB - just go back to view mode
              // Changes are already applied locally via onUpdateAppointmentField
              // User will click "Save" in View Mode to actually save to DB
              setEditingAppointmentId(null);
              setCurrentStep('view');
            }}
            onBack={() => {
              setEditingAppointmentId(null);
              setCurrentStep('view');
            }}
            onClose={onClose}
            setShowTeamMemberDropdown={setShowTeamMemberDropdown}
            setShowTimeDropdown={setShowTimeDropdown}
            setShowDurationDropdown={setShowDurationDropdown}
            formatTime={formatTime}
            getDurationDisplay={getDurationDisplay}
            generateTimeSlots={generateTimeSlots}
            generateDurationOptions={generateDurationOptions}
          />
        );

      case 'payment':
        return (
          <PaymentMode
            booking={booking}
            editingAppointments={visibleAppointments}
            totalPrice={getTotalPrice()}
            onBack={() => setCurrentStep('view')}
            onClose={onClose}
            getPriceDisplay={getPriceDisplay}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal - Wider and more responsive */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] md:w-[600px] lg:w-[750px] xl:w-[900px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Content */}
        {renderContent()}

        {/* Service Picker */}
        {showServicePicker && renderServicePicker()}
      </div>

      {/* ✅ Delete Booking Confirmation Modal */}
      {showDeleteBookingConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[70]">
          <div className="w-full max-w-sm mx-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Booking?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {wouldBeEmpty()
                ? 'This booking has no services. Delete the entire booking?'
                : 'Are you sure you want to delete this entire booking? This action cannot be undone.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteBookingConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteBooking}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
