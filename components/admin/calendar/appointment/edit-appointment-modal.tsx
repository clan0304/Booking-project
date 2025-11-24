// components/admin/calendar/appointment/edit-booking-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Heart,
  Plus,
} from 'lucide-react';
import {
  updateCalendarAppointment,
  deleteCalendarAppointment,
  addAppointmentToBooking,
} from '@/app/actions/calendar-appointments';
import { getAvailableServices } from '@/app/actions/services';
import { getTeamMembersByVenue } from '@/app/actions/team-venue-assignments';
import type { BookingGroupWithAppointments } from '@/types/calendar';
import Image from 'next/image';

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingGroupWithAppointments;
  onSuccess: () => void;
}

interface Service {
  id: string;
  name: string;
  base_duration: number;
  base_price: number | null;
  service_categories: {
    name: string;
    color: string;
  } | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

interface TeamMemberAssignment {
  id: string;
  is_active: boolean;
  users:
    | {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        photo_url: string | null;
      }
    | {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        photo_url: string | null;
      }[];
}

interface EditingAppointment {
  id: string;
  serviceId: string;
  serviceName: string;
  teamMemberId: string;
  startTime: string;
  duration: number;
  price: number;
}

export function EditAppointmentModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: EditAppointmentModalProps) {
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
  const [showServicePicker, setShowServicePicker] = useState<string | null>(
    null
  );
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

  // Load team members for the venue
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

  // Initialize editing state from booking appointments
  useEffect(() => {
    if (isOpen && booking.appointments) {
      const editMap = new Map<string, EditingAppointment>();

      booking.appointments.forEach((appointment) => {
        editMap.set(appointment.id, {
          id: appointment.id,
          serviceId: appointment.service_id,
          serviceName: appointment.service_name,
          teamMemberId: appointment.team_member_id,
          startTime: appointment.start_time.substring(0, 5), // HH:MM
          duration: appointment.duration_minutes,
          price: appointment.price,
        });
      });

      setEditingAppointments(editMap);
      setBookingNotes(booking.notes || '');
      setInternalNotes(booking.internal_notes || '');
      setError('');
      setExpandedAppointmentId(null);
    }
  }, [isOpen, booking]);

  // Load services for a specific team member
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

  // Toggle appointment expansion
  const toggleAppointment = (appointmentId: string): void => {
    if (expandedAppointmentId === appointmentId) {
      setExpandedAppointmentId(null);
    } else {
      setExpandedAppointmentId(appointmentId);

      // Load services for this appointment's team member if not loaded
      const appointment = editingAppointments.get(appointmentId);
      if (appointment && !availableServices.has(appointment.teamMemberId)) {
        loadServicesForTeamMember(appointment.teamMemberId);
      }
    }
  };

  // Update appointment field
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

  // Handle team member change
  const handleTeamMemberChange = async (
    appointmentId: string,
    newTeamMemberId: string
  ): Promise<void> => {
    const appointment = editingAppointments.get(appointmentId);
    if (!appointment) return;

    // Update team member
    updateAppointmentField(appointmentId, 'teamMemberId', newTeamMemberId);
    setShowTeamMemberDropdown(null);

    // Load services for new team member
    if (!availableServices.has(newTeamMemberId)) {
      await loadServicesForTeamMember(newTeamMemberId);
    }

    // Get the service from the new team member's available services
    const services = availableServices.get(newTeamMemberId);
    if (services) {
      const matchingService = services.find(
        (s) => s.id === appointment.serviceId
      );

      if (matchingService) {
        // Update to new team member's rate
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

  // Handle service selection
  const handleServiceSelect = async (
    appointmentIdOrAdd: string,
    service: Service
  ): Promise<void> => {
    // Check if we're adding a new appointment or editing existing
    if (appointmentIdOrAdd === 'add-new') {
      // Adding new appointment to booking
      setIsSubmitting(true);
      setError('');

      try {
        // Calculate start time (after last appointment)
        const appointments = Array.from(editingAppointments.values());
        let suggestedStartTime = '09:00'; // Default

        if (appointments.length > 0) {
          // Find the latest end time
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

        // Create new appointment
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
          // Add to editing state
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
      // Editing existing appointment
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
      setShowServicePicker(null);
    }
  };

  // Helper functions for time conversion
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Delete appointment
  const handleDeleteAppointment = async (
    appointmentId: string
  ): Promise<void> => {
    // Prevent deleting last appointment
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
        // Remove from editing state
        setEditingAppointments((prev) => {
          const newMap = new Map(prev);
          newMap.delete(appointmentId);
          return newMap;
        });

        // If it was expanded, close it
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

  // Save all changes
  const handleSaveAll = async (): Promise<void> => {
    setIsSubmitting(true);
    setError('');

    try {
      // Update each modified appointment
      for (const [appointmentId, editedAppt] of editingAppointments) {
        const originalAppt = booking.appointments.find(
          (a) => a.id === appointmentId
        );

        if (!originalAppt) continue;

        // Check if anything changed
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

  // Delete entire booking
  const handleDeleteBooking = async (): Promise<void> => {
    const confirmed = confirm(
      'Are you sure you want to delete this entire booking? This action cannot be undone.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError('');

    try {
      // Delete all appointments (which will cascade delete the booking group)
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

  // Helper functions
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
        const timeStr = `${hour.toString().padStart(2, '0')}:${min
          .toString()
          .padStart(2, '0')}`;
        slots.push(timeStr);
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

  const calculateTotal = (): { duration: number; price: number } => {
    let totalDuration = 0;
    let totalPrice = 0;

    editingAppointments.forEach((appt) => {
      totalDuration += appt.duration;
      totalPrice += appt.price;
    });

    return { duration: totalDuration, price: totalPrice };
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

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  };

  if (!isOpen) return null;

  const total = calculateTotal();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white z-[61] overflow-y-auto">
        <div className="min-h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors mb-6"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="font-medium">Back</span>
            </button>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Edit booking
            </h1>

            {/* Booking Info */}
            <div className="space-y-1 text-gray-600">
              <div className="font-medium text-gray-900">{getClientName()}</div>
              <div className="text-sm">{formatDate(booking.booking_date)}</div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Services Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Services
              </h2>

              <div className="space-y-3">
                {Array.from(editingAppointments.values()).map((appointment) => {
                  const isExpanded = expandedAppointmentId === appointment.id;
                  const teamMember = getTeamMember(appointment.teamMemberId);
                  const service = getService(
                    appointment.teamMemberId,
                    appointment.serviceId
                  );
                  const categoryColor =
                    service?.service_categories?.color || '#EC4899';

                  return (
                    <div
                      key={appointment.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Collapsed View */}
                      <button
                        onClick={() => toggleAppointment(appointment.id)}
                        className="w-full p-4 border-l-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left flex items-center justify-between"
                        style={{ borderLeftColor: categoryColor }}
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-base">
                            {appointment.serviceName}, {appointment.duration}min
                          </div>
                          <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                            {formatTime(appointment.startTime)} •{' '}
                            {teamMember && (
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3 text-red-500 fill-red-500" />
                                {teamMember.first_name} {teamMember.last_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            A$ {appointment.price.toFixed(2)}
                          </span>
                          <ChevronRight
                            className={`h-5 w-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div className="p-4 bg-white border-t border-gray-200 space-y-4">
                          {/* Service Selection */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                              Service
                            </label>
                            <button
                              onClick={() => {
                                setShowServicePicker(appointment.id);
                                setServicePickerTeamMemberId(
                                  appointment.teamMemberId
                                );
                              }}
                              className="w-full p-3 border-l-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left flex items-center justify-between"
                              style={{ borderLeftColor: categoryColor }}
                            >
                              <span className="font-medium text-gray-900">
                                {appointment.serviceName},{' '}
                                {appointment.duration}min
                              </span>
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </button>
                          </div>

                          {/* Team Member */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                              Team member
                            </label>
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                              </div>

                              <div className="flex-1 relative">
                                {teamMembersLoading ? (
                                  <div className="w-full px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <span className="text-gray-500">
                                      Loading...
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() =>
                                        setShowTeamMemberDropdown(
                                          showTeamMemberDropdown ===
                                            appointment.id
                                            ? null
                                            : appointment.id
                                        )
                                      }
                                      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                                    >
                                      {teamMember?.photo_url ? (
                                        <Image
                                          src={teamMember.photo_url}
                                          alt={teamMember.first_name}
                                          width={32}
                                          height={32}
                                          className="rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                          <span className="text-sm font-medium text-purple-600">
                                            {teamMember?.first_name[0]}
                                          </span>
                                        </div>
                                      )}
                                      <span className="flex-1 text-left font-medium text-gray-900">
                                        {teamMember?.first_name}{' '}
                                        {teamMember?.last_name}
                                      </span>
                                      <ChevronDown className="h-5 w-5 text-gray-400" />
                                    </button>

                                    {showTeamMemberDropdown ===
                                      appointment.id && (
                                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                                        {availableTeamMembers.map((member) => (
                                          <button
                                            key={member.id}
                                            onClick={() =>
                                              handleTeamMemberChange(
                                                appointment.id,
                                                member.id
                                              )
                                            }
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                                          >
                                            {member.photo_url ? (
                                              <Image
                                                src={member.photo_url}
                                                alt={member.first_name}
                                                width={32}
                                                height={32}
                                                className="rounded-full object-cover"
                                              />
                                            ) : (
                                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                                <span className="text-sm font-medium text-purple-600">
                                                  {member.first_name[0]}
                                                </span>
                                              </div>
                                            )}
                                            <span className="font-medium text-gray-900">
                                              {member.first_name}{' '}
                                              {member.last_name}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Price & Duration */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Service price
                              </label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                                  AUD
                                </span>
                                <input
                                  type="number"
                                  value={appointment.price}
                                  onChange={(e) =>
                                    updateAppointmentField(
                                      appointment.id,
                                      'price',
                                      parseFloat(e.target.value)
                                    )
                                  }
                                  className="w-full pl-14 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Duration
                              </label>
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setShowDurationDropdown(
                                      showDurationDropdown === appointment.id
                                        ? null
                                        : appointment.id
                                    )
                                  }
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-left text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-between"
                                >
                                  <span>{appointment.duration}min</span>
                                  <ChevronDown className="h-5 w-5 text-gray-400" />
                                </button>

                                {showDurationDropdown === appointment.id && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                                    {generateDurationOptions().map((dur) => (
                                      <button
                                        key={dur}
                                        onClick={() => {
                                          updateAppointmentField(
                                            appointment.id,
                                            'duration',
                                            dur
                                          );
                                          setShowDurationDropdown(null);
                                        }}
                                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                                          dur === appointment.duration
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'text-gray-900'
                                        }`}
                                      >
                                        {dur}min
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Start Time */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                              Start time
                            </label>
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setShowTimeDropdown(
                                    showTimeDropdown === appointment.id
                                      ? null
                                      : appointment.id
                                  )
                                }
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-left text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-between"
                              >
                                <span>{formatTime(appointment.startTime)}</span>
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                              </button>

                              {showTimeDropdown === appointment.id && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                                  {generateTimeSlots().map((time) => (
                                    <button
                                      key={time}
                                      onClick={() => {
                                        updateAppointmentField(
                                          appointment.id,
                                          'startTime',
                                          time
                                        );
                                        setShowTimeDropdown(null);
                                      }}
                                      className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                                        time === appointment.startTime
                                          ? 'bg-blue-50 text-blue-600'
                                          : 'text-gray-900'
                                      }`}
                                    >
                                      {formatTime(time)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Delete Service Button */}
                          <button
                            onClick={() =>
                              handleDeleteAppointment(appointment.id)
                            }
                            disabled={editingAppointments.size <= 1}
                            className="w-full px-4 py-3 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove service
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Service Button */}
              <button
                onClick={() => {
                  // Open service picker for adding new appointment
                  // We'll use the first team member from existing appointments as default
                  const firstAppointment = Array.from(
                    editingAppointments.values()
                  )[0];
                  if (firstAppointment) {
                    setServicePickerTeamMemberId(firstAppointment.teamMemberId);
                    setShowServicePicker('add-new'); // Special ID for adding

                    // Load services for this team member if not loaded
                    if (!availableServices.has(firstAppointment.teamMemberId)) {
                      loadServicesForTeamMember(firstAppointment.teamMemberId);
                    }
                  }
                }}
                disabled={editingAppointments.size === 0}
                className="mt-4 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors flex items-center justify-center gap-2 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-5 w-5" />
                Add service
              </button>
            </div>

            {/* Booking Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Booking notes
              </label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Notes visible to client..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Internal Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Internal notes
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Internal notes (staff only)..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
            {/* Total */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl font-bold text-gray-900">Total</span>
              <div className="text-right">
                <div className="text-sm text-gray-500">{total.duration}min</div>
                <div className="text-xl font-bold text-gray-900">
                  A$ {total.price.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteBooking}
                disabled={isDeleting || isSubmitting}
                className="flex-shrink-0 w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-5 w-5 text-red-600" />
              </button>

              <button
                onClick={handleSaveAll}
                disabled={isSubmitting || isDeleting}
                className="flex-1 px-6 py-3 bg-black text-white rounded-full font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Service Picker Modal */}
      {showServicePicker && (
        <div className="fixed inset-0 bg-white z-[62] overflow-y-auto">
          <div className="p-6">
            <button
              onClick={() => setShowServicePicker(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors mb-6"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="font-medium">Back</span>
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Select service
            </h2>

            {servicesLoading.has(servicePickerTeamMemberId) ? (
              <div className="text-center py-12 text-gray-500">
                Loading services...
              </div>
            ) : (
              <div className="space-y-3">
                {(availableServices.get(servicePickerTeamMemberId) || []).map(
                  (service) => (
                    <button
                      key={service.id}
                      onClick={() =>
                        handleServiceSelect(showServicePicker, service)
                      }
                      className="w-full p-4 border-l-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      style={{
                        borderLeftColor:
                          service.service_categories?.color || '#EC4899',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 text-lg">
                            {service.name}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {service.base_duration}min
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            A$ {(service.base_price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
