// components/admin/calendar/appointment/edit-appointment-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Search, Trash2, AlertCircle } from 'lucide-react';
import {
  updateCalendarAppointment,
  deleteCalendarAppointment,
} from '@/app/actions/calendar-appointments';
import { getAvailableServices } from '@/app/actions/services';
import type { AppointmentWithBooking } from '@/types/calendar';
import Image from 'next/image';

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentWithBooking;
  onSuccess: () => void;
}

// ✅ FIXED: Use the actual AvailableService type structure
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

interface ServicesByCategory {
  categoryName: string;
  categoryColor: string | null;
  services: Service[];
  serviceCount: number;
}

export function EditAppointmentModal({
  isOpen,
  onClose,
  appointment,
  onSuccess,
}: EditAppointmentModalProps) {
  // Service selection state
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Form state
  const [selectedStartTime, setSelectedStartTime] = useState(
    appointment.start_time.substring(0, 5)
  ); // HH:MM
  const [manualDuration, setManualDuration] = useState<number | null>(null);
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const [bookingNotes, setBookingNotes] = useState(
    appointment.booking.notes || ''
  );
  const [internalNotes, setInternalNotes] = useState(
    appointment.booking.internal_notes || ''
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  // Load available services
  useEffect(() => {
    const loadServices = async () => {
      setServicesLoading(true);
      try {
        const result = await getAvailableServices(
          appointment.booking.venue_id,
          appointment.team_member_id
        );

        if (result.success && result.services) {
          // ✅ FIXED: Type assertion to Service[]
          setAvailableServices(result.services as Service[]);

          // Find and select current service
          const currentService = result.services.find(
            (s) => s.id === appointment.service_id
          );
          if (currentService) {
            setSelectedService(currentService as Service);
          }
        }
      } catch (err) {
        console.error('Error loading services:', err);
        setError('Failed to load services');
      } finally {
        setServicesLoading(false);
      }
    };

    if (isOpen) {
      loadServices();
    }
  }, [
    isOpen,
    appointment.booking.venue_id,
    appointment.team_member_id,
    appointment.service_id,
  ]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedStartTime(appointment.start_time.substring(0, 5));
      setManualDuration(null);
      setManualPrice(null);
      setBookingNotes(appointment.booking.notes || '');
      setInternalNotes(appointment.booking.internal_notes || '');
      setServiceSearchQuery('');
      setError('');
    }
  }, [isOpen, appointment]);

  // ✅ FIXED: Helper functions to get duration and price with proper null handling
  const getServiceDuration = (service: Service | null): number => {
    if (!service) return appointment.duration_minutes;
    return service.base_duration;
  };

  const getServicePrice = (service: Service | null): number => {
    if (!service) return appointment.price;
    return service.base_price || 0;
  };

  const getServiceCategoryName = (service: Service | null): string => {
    if (!service?.service_categories) return 'Other';
    return service.service_categories.name;
  };

  const getServiceCategoryColor = (service: Service | null): string | null => {
    if (!service?.service_categories) return null;
    return service.service_categories.color;
  };

  // Calculate effective duration and price
  const duration = manualDuration ?? getServiceDuration(selectedService);
  const price = manualPrice ?? getServicePrice(selectedService);

  // Group services by category
  const servicesByCategory: ServicesByCategory[] = availableServices.reduce(
    (acc: ServicesByCategory[], service) => {
      const categoryName = getServiceCategoryName(service);
      const categoryColor = getServiceCategoryColor(service);

      let category = acc.find((c) => c.categoryName === categoryName);
      if (!category) {
        category = {
          categoryName,
          categoryColor,
          services: [],
          serviceCount: 0,
        };
        acc.push(category);
      }

      category.services.push(service);
      return acc;
    },
    []
  );

  servicesByCategory.forEach((category) => {
    category.serviceCount = category.services.length;
  });

  // Filter by search query
  const filteredCategories = servicesByCategory
    .map((category) => ({
      ...category,
      services: category.services.filter((service) =>
        service.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.services.length > 0);

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setManualPrice(null);
    setManualDuration(null);
    setServiceSearchQuery('');
  };

  const handleSubmit = async () => {
    if (!selectedService) {
      setError('Please select a service');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const hasChanges =
        selectedService.id !== appointment.service_id ||
        selectedStartTime !== appointment.start_time.substring(0, 5) ||
        duration !== appointment.duration_minutes ||
        price !== appointment.price ||
        bookingNotes !== (appointment.booking.notes || '') ||
        internalNotes !== (appointment.booking.internal_notes || '');

      if (!hasChanges) {
        onClose();
        return;
      }

      const result = await updateCalendarAppointment({
        appointmentId: appointment.id,
        bookingId: appointment.booking.id,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        startTime: selectedStartTime,
        duration: duration,
        price: price,
        bookingNotes: bookingNotes || undefined,
        internalNotes: internalNotes || undefined,
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to update appointment');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = confirm(
      'Are you sure you want to delete this appointment? This action cannot be undone.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError('');

    try {
      const result = await deleteCalendarAppointment(
        appointment.id,
        appointment.booking.id
      );

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to delete appointment');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 15) {
        if (hour === 23 && min === 45) {
          // Include 11:45pm but stop there
          const timeStr = `${hour.toString().padStart(2, '0')}:${min
            .toString()
            .padStart(2, '0')}`;
          slots.push(timeStr);
          break;
        }
        const timeStr = `${hour.toString().padStart(2, '0')}:${min
          .toString()
          .padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  const formatTime = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min}${period}`;
  };

  const getClientDisplay = () => {
    const booking = appointment.booking;
    if (!booking.client_id) return 'Walk-in';
    return `${booking.guest_first_name} ${booking.guest_last_name || ''}`;
  };

  const getClientPhoto = () => {
    return null;
  };

  const getClientInitials = () => {
    const booking = appointment.booking;
    return `${booking.guest_first_name[0]}${
      booking.guest_last_name?.[0] || ''
    }`;
  };

  const getTeamMemberName = () => {
    if (appointment.team_member) {
      return `${appointment.team_member.first_name} ${appointment.team_member.last_name}`;
    }
    return 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
        onClick={onClose}
      />

      {/* Right-side Modal */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-[61] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Edit Appointment
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {getTeamMemberName()} ·{' '}
                {formatDate(appointment.booking.booking_date)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Service Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              Service
            </label>

            {selectedService ? (
              <div
                className="flex items-center justify-between p-4 bg-purple-50 border-2 border-purple-600 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors"
                onClick={() => setSelectedService(null)}
              >
                <div className="flex items-center gap-3">
                  {getServiceCategoryColor(selectedService) && (
                    <div
                      className="w-1 h-12 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          getServiceCategoryColor(selectedService)!,
                      }}
                    />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {selectedService.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {getServiceCategoryName(selectedService)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    A${getServicePrice(selectedService).toFixed(0)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {getServiceDuration(selectedService)} min
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={serviceSearchQuery}
                    onChange={(e) => setServiceSearchQuery(e.target.value)}
                    placeholder="Search services..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-4">
                  {servicesLoading ? (
                    <p className="text-center text-gray-500 py-4">
                      Loading services...
                    </p>
                  ) : filteredCategories.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">
                      No services found
                    </p>
                  ) : (
                    filteredCategories.map((category) => (
                      <div key={category.categoryName}>
                        <div className="flex items-center gap-2 mb-2">
                          {category.categoryColor && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: category.categoryColor,
                              }}
                            />
                          )}
                          <h3 className="font-semibold text-gray-900">
                            {category.categoryName}
                          </h3>
                          <span className="text-xs text-gray-500">
                            ({category.serviceCount})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {category.services.map((service) => (
                            <button
                              key={service.id}
                              onClick={() => handleServiceClick(service)}
                              className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-all text-left"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {service.name}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="font-semibold text-gray-900">
                                  A${getServicePrice(service).toFixed(0)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {getServiceDuration(service)} min
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Client Info (Read-only) */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              Client
            </label>
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              {getClientPhoto() ? (
                <Image
                  src={getClientPhoto()!}
                  alt={getClientDisplay()}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-purple-600">
                    {getClientInitials()}
                  </span>
                </div>
              )}
              <div>
                <div className="font-medium text-gray-900">
                  {getClientDisplay()}
                </div>
                <div className="text-sm text-gray-600">
                  {appointment.booking.guest_email ||
                    appointment.booking.guest_phone ||
                    'No contact info'}
                </div>
              </div>
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              Start Time
            </label>
            <select
              value={selectedStartTime}
              onChange={(e) => setSelectedStartTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {generateTimeSlots().map((time) => (
                <option key={time} value={time}>
                  {formatTime(time)}
                </option>
              ))}
            </select>
          </div>

          {/* Duration Override */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={manualDuration ?? duration}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setManualDuration(isNaN(val) ? null : val);
              }}
              min="15"
              step="15"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {manualDuration !== null && (
              <button
                onClick={() => setManualDuration(null)}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Reset to default ({getServiceDuration(selectedService)} min)
              </button>
            )}
          </div>

          {/* Price Override */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              Price (A$)
            </label>
            <input
              type="number"
              value={manualPrice ?? price}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setManualPrice(isNaN(val) ? null : val);
              }}
              min="0"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {manualPrice !== null && (
              <button
                onClick={() => setManualPrice(null)}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Reset to default (A$
                {getServicePrice(selectedService).toFixed(2)})
              </button>
            )}
          </div>

          {/* Booking Notes */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              Booking Notes
              <span className="text-sm font-normal text-gray-600 ml-2">
                (Visible to client)
              </span>
            </label>
            <textarea
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
              rows={3}
              placeholder="Any special requests or notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Internal Notes */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">
              Internal Notes
              <span className="text-sm font-normal text-gray-600 ml-2">
                (Staff only)
              </span>
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              placeholder="Private notes for staff..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Delete Button */}
            <button
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
                className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isDeleting || !selectedService}
                className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
