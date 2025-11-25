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
    }
  }, [isOpen, booking]);

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
        setAvailableServices((prev) => {
          const newMap = new Map(prev);
          newMap.set(teamMemberId, result.services as Service[]);
          return newMap;
        });
      } else {
        setError(result.error || 'Failed to load services for team member');
      }
    } catch (err) {
      console.error('Error loading services:', err);
      setError('Failed to load services');
    } finally {
      setServicesLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(teamMemberId);
        return newSet;
      });
    }
  };

  const toggleAppointment = (appointmentId: string): void => {
    if (expandedAppointmentId === appointmentId) {
      setExpandedAppointmentId(null);
    } else {
      setExpandedAppointmentId(appointmentId);
      const appointment = editingAppointments.get(appointmentId);
      if (appointment && !availableServices.has(appointment.teamMemberId)) {
        loadServicesForTeamMember(appointment.teamMemberId);
      }
    }
  };

  const updateAppointmentField = <K extends keyof EditingAppointment>(
    appointmentId: string,
    field: K,
    value: EditingAppointment[K]
  ) => {
    setEditingAppointments((prev) => {
      const newMap = new Map(prev);
      const appointment = newMap.get(appointmentId);
      if (appointment) {
        newMap.set(appointmentId, { ...appointment, [field]: value });
      }
      return newMap;
    });
  };

  const handleTeamMemberChange = async (
    appointmentId: string,
    newTeamMemberId: string
  ): Promise<void> => {
    const appointment = editingAppointments.get(appointmentId);
    if (!appointment) return;

    updateAppointmentField(appointmentId, 'teamMemberId', newTeamMemberId);
    setShowTeamMemberDropdown(null);

    if (!availableServices.has(newTeamMemberId)) {
      await loadServicesForTeamMember(newTeamMemberId);
    }

    const services = availableServices.get(newTeamMemberId);
    if (services) {
      const matchingService = services.find(
        (s) => s.id === appointment.serviceId
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
      } else {
        setError('Selected service is not available for this team member');
      }
    }
  };

  const handleServiceSelect = async (
    appointmentIdOrAdd: string,
    service: Service
  ): Promise<void> => {
    if (appointmentIdOrAdd === 'add-new') {
      setIsSubmitting(true);
      setError('');
      try {
        const appointments = Array.from(editingAppointments.values());
        let suggestedStartTime = '09:00';
        if (appointments.length > 0) {
          const latestAppointment = appointments.reduce((latest, current) => {
            const currentEndMinutes =
              timeToMinutes(current.startTime) + current.duration;
            const latestEndMinutes =
              timeToMinutes(latest.startTime) + latest.duration;
            return currentEndMinutes > latestEndMinutes ? current : latest;
          });
          const latestEndMinutes =
            timeToMinutes(latestAppointment.startTime) +
            latestAppointment.duration;
          suggestedStartTime = minutesToTime(latestEndMinutes);
        }

        const result = await addAppointmentToBooking({
          bookingId: booking.id,
          serviceId: service.id,
          serviceName: service.name,
          teamMemberId: servicePickerTeamMemberId,
          startTime: suggestedStartTime,
          duration: service.base_duration,
          price: service.base_price || 0,
        });

        if (result.success && result.appointmentId) {
          setEditingAppointments((prev) => {
            const newMap = new Map(prev);
            newMap.set(result.appointmentId!, {
              id: result.appointmentId!,
              serviceId: service.id,
              serviceName: service.name,
              teamMemberId: servicePickerTeamMemberId,
              startTime: suggestedStartTime,
              duration: service.base_duration,
              price: service.base_price || 0,
              categoryColor: service.service_categories?.color || undefined,
            });
            return newMap;
          });
          setShowServicePicker(null);
        } else {
          setError(result.error || 'Failed to add service');
        }
      } catch (err) {
        console.error('Error adding service:', err);
        setError('An unexpected error occurred');
      } finally {
        setIsSubmitting(false);
      }
    } else {
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

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const handleDeleteAppointment = async (
    appointmentId: string
  ): Promise<void> => {
    if (editingAppointments.size <= 1) {
      setError(
        'Cannot delete the last service. Delete the entire booking instead.'
      );
      return;
    }

    const confirmed = confirm(
      'Are you sure you want to remove this service from the booking?'
    );
    if (!confirmed) return;

    try {
      const result = await deleteCalendarAppointment(appointmentId, booking.id);
      if (result.success) {
        setEditingAppointments((prev) => {
          const newMap = new Map(prev);
          newMap.delete(appointmentId);
          return newMap;
        });
        if (expandedAppointmentId === appointmentId) {
          setExpandedAppointmentId(null);
        }
      } else {
        setError(result.error || 'Failed to delete appointment');
      }
    } catch (err) {
      console.error('Error deleting appointment:', err);
      setError('An unexpected error occurred');
    }
  };

  const handleSaveAll = async (): Promise<void> => {
    setIsSubmitting(true);
    setError('');
    try {
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
      onSuccess();
      onClose();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBooking = async (): Promise<void> => {
    const confirmed = confirm(
      'Are you sure you want to delete this entire booking? This action cannot be undone.'
    );
    if (!confirmed) return;

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
      const firstAppointment = Array.from(editingAppointments.values())[0];
      if (firstAppointment) {
        setServicePickerTeamMemberId(firstAppointment.teamMemberId);
        if (!availableServices.has(firstAppointment.teamMemberId)) {
          loadServicesForTeamMember(firstAppointment.teamMemberId);
        }
      }
    } else {
      const appointment = editingAppointments.get(appointmentId);
      if (appointment) {
        setServicePickerTeamMemberId(appointment.teamMemberId);
      }
    }
    setShowServicePicker(appointmentId);
  };

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

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
    const date = new Date(dateStr + 'T00:00:00Z');
    const dayName = date.toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    const day = date.getUTCDate();
    const month = date.toLocaleDateString('en-US', {
      month: 'short',
      timeZone: 'UTC',
    });
    return `${dayName} ${day} ${month}`;
  };

  const getPriceDisplay = (price: number) => {
    return price === 0 ? 'Free' : `A$ ${price.toFixed(0)}`;
  };

  const getClientName = (): string => {
    if (booking.client) {
      return `${booking.client.first_name} ${
        booking.client.last_name || ''
      }`.trim();
    }
    if (booking.guest_first_name) {
      return `${booking.guest_first_name} ${
        booking.guest_last_name || ''
      }`.trim();
    }
    return 'Walk-in';
  };

  const getClientInitials = (): string => {
    if (booking.client) {
      return `${booking.client.first_name[0]}${
        booking.client.last_name?.[0] || ''
      }`;
    }
    if (booking.guest_first_name) {
      return `${booking.guest_first_name[0]}${
        booking.guest_last_name?.[0] || ''
      }`;
    }
    return 'W';
  };

  const getTotalPrice = (): number => {
    return Array.from(editingAppointments.values()).reduce(
      (sum, apt) => sum + apt.price,
      0
    );
  };

  const getStatusLabel = (status: BookingStatus): string => {
    const labels: Record<BookingStatus, string> = {
      confirmed: 'Confirmed',
      pending: 'Pending',
      cancelled: 'Cancelled',
      completed: 'Completed',
      no_show: 'No-show',
    };
    return labels[status];
  };

  // Step navigation
  const handleCheckout = () => setCurrentStep('payment');
  const handleBackFromPayment = () => setCurrentStep('view');
  const handleToggleEdit = () => {
    setCurrentStep(currentStep === 'edit' ? 'view' : 'edit');
  };
  const handleStatusChange = (newStatus: BookingStatus) => {
    setBookingStatus(newStatus);
    setShowStatusDropdown(false);
    // TODO: Update status in database
  };

  // =====================================================
  // SERVICE PICKER MODAL
  // =====================================================

  const renderServicePicker = () => {
    if (!showServicePicker) return null;

    const teamMemberServices =
      availableServices.get(servicePickerTeamMemberId) || [];
    const isLoading = servicesLoading.has(servicePickerTeamMemberId);

    const servicesByCategory: Record<string, Service[]> = {};
    teamMemberServices.forEach((service) => {
      const categoryName = service.service_categories?.name || 'Uncategorized';
      if (!servicesByCategory[categoryName]) {
        servicesByCategory[categoryName] = [];
      }
      servicesByCategory[categoryName].push(service);
    });

    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-[62]"
          onClick={() => setShowServicePicker(null)}
        />
        <div className="fixed inset-0 z-[62] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <button
                onClick={() => setShowServicePicker(null)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <h3 className="text-lg font-semibold">Select Service</h3>
              <div className="w-20" />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
                </div>
              ) : teamMemberServices.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">
                    No services available for this team member
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(servicesByCategory).map(
                    ([categoryName, services]) => (
                      <div key={categoryName}>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 px-2">
                          {categoryName} ({services.length})
                        </h4>
                        <div className="space-y-2">
                          {services.map((service) => (
                            <button
                              key={service.id}
                              onClick={() =>
                                handleServiceSelect(showServicePicker!, service)
                              }
                              className="w-full p-4 border-l-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                              style={{
                                borderLeftColor:
                                  service.service_categories?.color ||
                                  '#A855F7',
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900">
                                    {service.name}
                                  </h5>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {service.base_duration} min
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-medium text-gray-900">
                                    A$ {service.base_price?.toFixed(0) || 0}
                                  </p>
                                </div>
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
        </div>
      </>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  if (!isOpen) return null;

  const renderContent = () => {
    switch (currentStep) {
      case 'view':
        return (
          <ViewMode
            booking={booking}
            editingAppointments={editingAppointments}
            availableTeamMembers={availableTeamMembers}
            bookingStatus={bookingStatus}
            showStatusDropdown={showStatusDropdown}
            showMoreMenu={showMoreMenu}
            bookingNotes={bookingNotes}
            allowEdit={allowEdit}
            onStatusChange={handleStatusChange}
            onToggleStatusDropdown={() =>
              setShowStatusDropdown(!showStatusDropdown)
            }
            onToggleMoreMenu={() => setShowMoreMenu(!showMoreMenu)}
            onCheckout={handleCheckout}
            onToggleEdit={handleToggleEdit}
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
            editingAppointments={editingAppointments}
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

      case 'payment':
        return (
          <PaymentMode
            booking={booking}
            editingAppointments={editingAppointments}
            totalPrice={getTotalPrice()}
            onBack={handleBackFromPayment}
            onClose={onClose}
            getPriceDisplay={getPriceDisplay}
          />
        );
    }
  };

  return (
    <>
      {/* Backdrop - semi-transparent so calendar is visible */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Right-side Slide-in Panel - Responsive width */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[600px] sm:min-w-[600px] lg:w-[700px] lg:min-w-[700px] xl:w-[800px] xl:max-w-[800px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Content */}
        {renderContent()}
      </div>

      {/* Service Picker Modal */}
      {renderServicePicker()}
    </>
  );
}
