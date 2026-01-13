// components/admin/calendar/appointment/edit-appointment-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import {
  updateCalendarAppointment,
  deleteCalendarAppointment,
  addAppointmentToBooking,
  updateBookingStatus,
} from '@/app/actions/calendar-appointments';
import { SaleDetailsModal } from './sale-details-modal';
import { getAvailableServices } from '@/app/actions/services';
import { getTeamMembersByVenue } from '@/app/actions/team-venue-assignments';
import { ViewMode } from './edit-appointment-view-mode';
import { EditMode } from './edit-appointment-edit-mode';
import { SingleEditMode } from './edit-appointment-single-mode';
import { PaymentMode } from './edit-appointment-payment-mode';
import {
  ProductPicker,
  ProductQuantityEditor,
  type SelectedProduct,
} from './product-picker';
import { RebookOverlay } from '../rebook-overlay';
import type {
  RebookService,
  RebookClient,
  RebookData,
} from '../rebook-overlay';
import { createRebooking } from '@/app/actions/rebook';
import type {
  EditAppointmentModalProps,
  ModalStep,
  BookingStatus,
  Service,
  TeamMember,
  TeamMemberAssignment,
  EditingAppointment,
} from './edit-appointment-types';

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
  onSelectBooking,
}: EditAppointmentModalProps) {
  // Step management
  const [currentStep, setCurrentStep] = useState<ModalStep>(initialStep);
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>(
    booking.status as BookingStatus
  );
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showRebookOverlay, setShowRebookOverlay] = useState(false);

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
  const [editingAppointmentId, setEditingAppointmentId] = useState<
    string | null
  >(null);

  // Pending changes
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(
    new Set()
  );
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
  // bookingNotes = client notes from online booking (read-only in edit)
  // internalNotes = staff-only notes (editable)
  const [bookingNotes, setBookingNotes] = useState(booking.notes || '');
  const [internalNotes, setInternalNotes] = useState(
    booking.internal_notes || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteBookingConfirm, setShowDeleteBookingConfirm] =
    useState(false);

  // Products state
  const [addedProducts, setAddedProducts] = useState<SelectedProduct[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Get client alert note from booking.client
  const clientAlertNote = booking.client?.alert_note || null;

  // Effects
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(initialStep);
      setError('');
      setAddedProducts([]); // Reset products when modal opens
      setShowProductPicker(false);
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
      setPendingDeletions(new Set());
      setPendingAdditions(new Map());
      setAddedProducts([]);

      const teamMemberIds = new Set<string>();
      booking.appointments.forEach((appt) => {
        teamMemberIds.add(appt.team_member_id);
      });

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

  useEffect(() => {
    if (availableServices.size === 0 || editingAppointments.size === 0) return;

    const appointmentsMissingColors = Array.from(
      editingAppointments.values()
    ).filter((appt) => !appt.categoryColor);

    if (appointmentsMissingColors.length === 0) return;

    let hasUpdates = false;
    const updatedAppointments = new Map(editingAppointments);

    appointmentsMissingColors.forEach((appt) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableServices]);

  // Computed values
  const getVisibleAppointmentCount = (): number => {
    const existingNotDeleted = Array.from(editingAppointments.keys()).filter(
      (id) => !pendingDeletions.has(id)
    ).length;
    return existingNotDeleted + pendingAdditions.size;
  };

  const handleViewSale = () => {
    setShowSaleModal(true);
  };

  const wouldBeEmpty = (): boolean => {
    return getVisibleAppointmentCount() === 0 && addedProducts.length === 0;
  };

  const hasUnsavedChanges = (): boolean => {
    if (pendingDeletions.size > 0) return true;
    if (pendingAdditions.size > 0) return true;
    if (addedProducts.length > 0) return true;

    // Check if status has changed
    if (bookingStatus !== booking.status) return true;

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

    // Only check internal notes for changes (booking notes are read-only)
    if (internalNotes !== (booking.internal_notes || '')) return true;

    return false;
  };

  // Product handlers
  const handleAddProduct = (product: SelectedProduct) => {
    const existing = addedProducts.find(
      (p) => p.productId === product.productId
    );
    if (existing) {
      setAddedProducts((prev) =>
        prev.map((p) =>
          p.productId === product.productId
            ? { ...p, quantity: Math.min(p.quantity + 1, p.maxQuantity) }
            : p
        )
      );
    } else {
      setAddedProducts((prev) => [...prev, product]);
    }
  };

  const handleUpdateProductQuantity = (productId: string, quantity: number) => {
    setAddedProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, quantity } : p))
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setAddedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Service handlers
  const loadServicesForTeamMember = async (
    teamMemberId: string
  ): Promise<void> => {
    setServicesLoading((prev) => new Set(prev).add(teamMemberId));
    try {
      const result = await getAvailableServices(booking.venue_id, teamMemberId);
      if (result.success && result.services) {
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

  const handleDeleteAppointment = async (
    appointmentId: string
  ): Promise<void> => {
    // Always allow soft deletion - actual deletion happens on Save
    if (pendingAdditions.has(appointmentId)) {
      // Remove from pending additions (not yet saved to DB)
      setPendingAdditions((prev) => {
        const newMap = new Map(prev);
        newMap.delete(appointmentId);
        return newMap;
      });
    } else {
      // Add to pending deletions (will be deleted on Save)
      setPendingDeletions((prev) => new Set(prev).add(appointmentId));
    }

    if (expandedAppointmentId === appointmentId) {
      setExpandedAppointmentId(null);
    }
  };

  const handleSaveAll = async (): Promise<void> => {
    if (wouldBeEmpty()) {
      setShowDeleteBookingConfirm(true);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // IMPORTANT: Add new appointments FIRST, then delete old ones
      // This prevents the booking_group from being deleted when all original appointments are removed
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

      // Now safe to delete old appointments
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
            // Don't send bookingNotes - it's read-only from online bookings
            internalNotes: internalNotes,
          });

          if (!result.success) {
            setError(result.error || 'Failed to update appointment');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Only check internal notes for changes
      const notesChanged = internalNotes !== (booking.internal_notes || '');

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
        const firstNonDeleted = Array.from(editingAppointments.entries()).find(
          ([id]) => !pendingDeletions.has(id)
        );
        if (firstNonDeleted) {
          await updateCalendarAppointment({
            appointmentId: firstNonDeleted[0],
            bookingId: booking.id,
            internalNotes: internalNotes,
          });
        }
      }

      // Save status change if changed
      if (bookingStatus !== booking.status) {
        const statusResult = await updateBookingStatus(
          booking.id,
          bookingStatus
        );
        if (!statusResult.success) {
          setError(statusResult.error || 'Failed to update booking status');
          setIsSubmitting(false);
          return;
        }
      }

      setPendingDeletions(new Set());
      setPendingAdditions(new Map());
      onSuccess();
      setCurrentStep('view');
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBooking = async (): Promise<void> => {
    setShowDeleteBookingConfirm(true);
  };

  const confirmDeleteBooking = async (): Promise<void> => {
    setShowDeleteBookingConfirm(false);
    setIsDeleting(true);
    setError('');

    try {
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
      } else {
        // Fallback: use the original booking's first appointment's team member
        const originalTeamMemberId = booking.appointments[0]?.team_member_id;
        if (originalTeamMemberId) {
          setServicePickerTeamMemberId(originalTeamMemberId);
          if (!availableServices.has(originalTeamMemberId)) {
            loadServicesForTeamMember(originalTeamMemberId);
          }
        }
      }
    } else {
      const appointment = pendingAdditions.has(appointmentId)
        ? pendingAdditions.get(appointmentId)
        : editingAppointments.get(appointmentId);
      if (appointment) {
        setServicePickerTeamMemberId(appointment.teamMemberId);
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

  const handleCheckout = async (): Promise<void> => {
    const hasServiceChanges =
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
      }) ||
      internalNotes !== (booking.internal_notes || '');

    if (hasServiceChanges) {
      if (getVisibleAppointmentCount() === 0 && addedProducts.length === 0) {
        setShowDeleteBookingConfirm(true);
        return;
      }

      setIsSubmitting(true);
      setError('');

      try {
        // IMPORTANT: Add new appointments FIRST, then delete old ones
        // This prevents the booking_group from being deleted when all original appointments are removed
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

        // Now safe to delete old appointments
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
              internalNotes: internalNotes,
            });

            if (!result.success) {
              setError(result.error || 'Failed to update appointment');
              setIsSubmitting(false);
              return;
            }
          }
        }

        const notesChanged = internalNotes !== (booking.internal_notes || '');

        if (notesChanged) {
          const firstNonDeleted = Array.from(
            editingAppointments.entries()
          ).find(([id]) => !pendingDeletions.has(id));
          if (firstNonDeleted) {
            await updateCalendarAppointment({
              appointmentId: firstNonDeleted[0],
              bookingId: booking.id,
              internalNotes: internalNotes,
            });
          }
        }

        setPendingDeletions(new Set());
        setPendingAdditions(new Map());
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

    setCurrentStep('payment');
  };

  const handleToggleEdit = () => {
    setCurrentStep('edit');
  };

  const handleEditAppointment = (appointmentId: string) => {
    setEditingAppointmentId(appointmentId);
    setCurrentStep('edit-single');
  };

  // Rebook handlers
  const handleRebook = () => {
    setShowMoreMenu(false);
    setShowRebookOverlay(true);
  };

  const handleRebookConfirm = async (data: {
    teamMemberId: string;
    teamMemberName: string;
    date: string;
    startTime: string;
    services: RebookService[];
    client: RebookClient;
  }) => {
    const result = await createRebooking({
      venueId: booking.venue_id,
      teamMemberId: data.teamMemberId,
      date: data.date,
      startTime: data.startTime,
      services: data.services,
      client: data.client,
    });

    if (result.success) {
      setShowRebookOverlay(false);
      onSuccess();
      onClose();
    } else {
      console.error('Rebook failed:', result.error);
      setError(result.error || 'Failed to create rebooking');
    }
  };

  const getRebookData = (): RebookData => {
    const services: RebookService[] = Array.from(editingAppointments.values())
      .filter((appt) => !pendingDeletions.has(appt.id))
      .map((appt) => ({
        serviceId: appt.serviceId,
        serviceName: appt.serviceName,
        duration: appt.duration,
        price: appt.price,
        categoryColor: appt.categoryColor,
      }));

    const client: RebookClient = {
      clientId: booking.client_id,
      firstName: booking.guest_first_name || '',
      lastName: booking.guest_last_name,
      email: booking.guest_email,
      phone: booking.guest_phone,
    };

    return {
      client,
      services,
      originalBookingId: booking.id,
      venueId: booking.venue_id,
    };
  };

  // Service selection handler
  const handleSelectService = async (service: Service) => {
    const appointmentIdOrAdd = showServicePicker;

    if (appointmentIdOrAdd === 'add-new') {
      const tempId = `pending-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Default to original booking's first appointment start time
      const originalStartTime =
        booking.appointments[0]?.start_time?.substring(0, 5) || '09:00';
      let suggestedStartTime = originalStartTime;

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
        // If there are visible appointments, calculate end time of the latest one
        let latestEnd = 0;
        visibleAppointments.forEach((appt) => {
          const endMinutes = timeToMinutes(appt.startTime) + appt.duration;
          if (endMinutes > latestEnd) {
            latestEnd = endMinutes;
          }
        });
        suggestedStartTime = minutesToTime(latestEnd);
      }
      // If no visible appointments, suggestedStartTime stays as originalStartTime

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

  // Helper functions
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

  const getTotalPrice = (): number => {
    let total = 0;

    editingAppointments.forEach((appt, id) => {
      if (!pendingDeletions.has(id)) {
        total += appt.price || 0;
      }
    });

    pendingAdditions.forEach((pending) => {
      total += pending.price || 0;
    });

    addedProducts.forEach((product) => {
      total += product.unitPrice * product.quantity;
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

  const getVisibleAppointments = (): Map<string, EditingAppointment> => {
    const visible = new Map<string, EditingAppointment>();

    editingAppointments.forEach((appt, id) => {
      if (!pendingDeletions.has(id)) {
        visible.set(id, appt);
      }
    });

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

  // Service picker render
  const renderServicePicker = () => {
    const services = availableServices.get(servicePickerTeamMemberId) || [];

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

  // Products section render
  const renderProductsSection = () => {
    // Don't show "Add product" button for terminal states (completed, cancelled, no_show)
    const isReadOnly =
      bookingStatus === 'completed' ||
      bookingStatus === 'cancelled' ||
      bookingStatus === 'no_show';
    const canEditProducts = allowEdit && !isReadOnly;

    return (
      <div className="mt-6 px-6">
        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Products
        </h4>

        {addedProducts.length > 0 && (
          <div className="space-y-2 mb-3">
            {addedProducts.map((product) => (
              <ProductQuantityEditor
                key={product.id}
                product={product}
                onUpdateQuantity={
                  canEditProducts ? handleUpdateProductQuantity : undefined
                }
                onRemove={canEditProducts ? handleRemoveProduct : undefined}
              />
            ))}
          </div>
        )}

        {canEditProducts && (
          <button
            onClick={() => setShowProductPicker(true)}
            className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors w-fit"
          >
            <Plus className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Add product
            </span>
          </button>
        )}
      </div>
    );
  };

  // Main render
  if (!isOpen) return null;

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
            internalNotes={internalNotes}
            clientAlertNote={clientAlertNote}
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
            onShowServicePicker={() => handleShowServicePicker('add-new')}
            onEditAppointment={handleEditAppointment}
            onDeleteBooking={handleDeleteBooking}
            onDeleteAppointment={handleDeleteAppointment}
            onRebook={handleRebook}
            onClose={onClose}
            onInternalNotesChange={setInternalNotes}
            formatDate={formatDate}
            formatTime={formatTime}
            getPriceDisplay={getPriceDisplay}
            getClientName={getClientName}
            getClientInitials={getClientInitials}
            getTotalPrice={getTotalPrice}
            getStatusLabel={getStatusLabel}
            onViewSale={handleViewSale}
            productsSection={renderProductsSection()}
            onSelectBooking={onSelectBooking}
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
            clientAlertNote={clientAlertNote}
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
        const singleAppointment = editingAppointmentId
          ? visibleAppointments.get(editingAppointmentId)
          : undefined;

        if (!singleAppointment || !editingAppointmentId) {
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
            isSaving={false}
            canDelete={true} // Always allow soft deletion
            onUpdateAppointmentField={updateAppointmentField}
            onTeamMemberChange={handleTeamMemberChange}
            onDeleteAppointment={async (id) => {
              await handleDeleteAppointment(id);
              setCurrentStep('view');
            }}
            onShowServicePicker={(id) => handleShowServicePicker(id)}
            onSave={() => {
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
            addedProducts={addedProducts}
            totalPrice={getTotalPrice()}
            onBack={() => setCurrentStep('view')}
            onClose={onClose}
            onSuccess={() => {
              setAddedProducts([]);
              onSuccess();
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] md:w-[600px] lg:w-[750px] xl:w-[900px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {renderContent()}

        {showServicePicker && renderServicePicker()}
      </div>

      {showDeleteBookingConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[70]">
          <div className="w-full max-w-sm mx-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Booking?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {wouldBeEmpty()
                ? 'This booking has no services or products. Delete the entire booking?'
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

      <SaleDetailsModal
        isOpen={showSaleModal}
        onClose={() => setShowSaleModal(false)}
        booking={booking}
      />

      {showRebookOverlay && (
        <RebookOverlay
          isOpen={showRebookOverlay}
          onClose={() => setShowRebookOverlay(false)}
          rebookData={getRebookData()}
          onConfirm={handleRebookConfirm}
        />
      )}

      {showProductPicker && (
        <ProductPicker
          venueId={booking.venue_id}
          onSelectProduct={handleAddProduct}
          onClose={() => setShowProductPicker(false)}
          existingProducts={addedProducts}
        />
      )}
    </>
  );
}
