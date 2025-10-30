// components/admin/calendar/appointment/create-appointment-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, User, AlertCircle, ChevronDown } from 'lucide-react';
import { ClientSelection } from './client-selection';
import { ServiceSelection } from './service-selection';
import { createCalendarAppointment } from '@/app/actions/calendar-appointments';
import { checkAvailability } from '@/app/actions/bookings';
import type { ClientSelectionType, SelectedService } from './types';

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Pre-filled from calendar (but now editable!)
  venueId: string;
  venueName: string;
  teamMemberId: string;
  teamMemberName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM

  onSuccess: () => void;
}

export function CreateAppointmentModal({
  isOpen,
  onClose,
  venueId,
  venueName,
  teamMemberId: initialTeamMemberId,
  teamMemberName: initialTeamMemberName,
  date,
  startTime: initialStartTime,
  onSuccess,
}: CreateAppointmentModalProps) {
  // ✅ Editable fields
  const [selectedTeamMemberId] = useState(initialTeamMemberId); // TODO: Make editable when team member selection is implemented
  const [selectedTeamMemberName] = useState(initialTeamMemberName);
  const [selectedStartTime, setSelectedStartTime] = useState(initialStartTime);
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const [manualDuration, setManualDuration] = useState<number | null>(null);

  // Existing state
  const [clientSelectionOpen, setClientSelectionOpen] = useState(false);
  const [selectedClient, setSelectedClient] =
    useState<ClientSelectionType>(null);
  const [services, setServices] = useState<SelectedService[]>([]);
  const [bookingNotes, setBookingNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ✅ Availability checking
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    available: boolean;
    message: string;
  } | null>(null);

  // ✅ Time dropdown state
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  // Calculate total duration and price
  const totalDuration =
    manualDuration || services.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice =
    manualPrice || services.reduce((sum, s) => sum + s.price, 0);

  // Generate time slots (15-min intervals from 8 AM to 8 PM)
  const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let min = 0; min < 60; min += 15) {
        if (hour === 20 && min > 0) break; // Stop at 8:00 PM
        const timeStr = `${hour.toString().padStart(2, '0')}:${min
          .toString()
          .padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // ✅ Check availability when time changes
  useEffect(() => {
    const checkSlotAvailability = async () => {
      if (!selectedTeamMemberId || !selectedStartTime || totalDuration === 0) {
        return;
      }

      try {
        // Calculate end time
        const [hours, minutes] = selectedStartTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + totalDuration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const endTime = `${endHours.toString().padStart(2, '0')}:${endMins
          .toString()
          .padStart(2, '0')}`;

        const result = await checkAvailability(
          selectedTeamMemberId,
          date,
          selectedStartTime,
          endTime
        );

        if (result.success && result.available !== undefined) {
          if (result.available) {
            setAvailabilityStatus({
              available: true,
              message: 'Time slot available',
            });
          } else {
            setAvailabilityStatus({
              available: false,
              message: `Not available at ${formatTime12Hour(
                selectedStartTime
              )}`,
            });
          }
        }
      } catch (err) {
        console.error('Error checking availability:', err);
      }
    };

    checkSlotAvailability();
  }, [selectedTeamMemberId, selectedStartTime, totalDuration, date]);

  // Handlers
  const handleClientSelect = (client: ClientSelectionType) => {
    setSelectedClient(client);
    setClientSelectionOpen(false);
  };

  const handleSave = async () => {
    // Validate
    if (!selectedClient) {
      setError('Please select a client or choose walk-in');
      return;
    }

    if (services.length === 0) {
      setError('Please add at least one service');
      return;
    }

    if (availabilityStatus && !availabilityStatus.available) {
      setError('Selected time slot is not available');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Build services with manual overrides
      const finalServices = services.map((service, index) => ({
        ...service,
        duration:
          manualDuration && index === 0 ? manualDuration : service.duration,
        price: manualPrice && index === 0 ? manualPrice : service.price,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestData: any = {
        venueId,
        bookingDate: date,
        teamMemberId: selectedTeamMemberId,
        startTime: selectedStartTime,
        services: finalServices,
        bookingNotes: bookingNotes || undefined,
        internalNotes: internalNotes || undefined,
      };

      // Add client info
      if (selectedClient.type === 'walkin') {
        requestData.walkIn = true;
      } else if (selectedClient.type === 'existing') {
        requestData.clientId = selectedClient.client.id;
      } else if (selectedClient.type === 'new') {
        requestData.newClient = selectedClient.data;
      }

      const result = await createCalendarAppointment(requestData);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to create appointment');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time to 12-hour format
  const formatTime12Hour = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min}${period}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Add Appointment
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDate(date)} • {venueName}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Client Selection */}
              <div>
                <label className="text-sm font-medium text-gray-900 block mb-2">
                  Client
                </label>
                {!selectedClient ? (
                  <button
                    onClick={() => setClientSelectionOpen(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-600 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <User className="w-5 h-5" />
                    <span>Add client or walk-in</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      {selectedClient.type === 'walkin' && (
                        <>
                          <p className="font-medium">Walk-in</p>
                          <p className="text-sm text-gray-600">
                            No client info
                          </p>
                        </>
                      )}
                      {selectedClient.type === 'existing' && (
                        <>
                          <p className="font-medium">
                            {selectedClient.client.first_name}{' '}
                            {selectedClient.client.last_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {selectedClient.client.email ||
                              selectedClient.client.phone_number}
                          </p>
                        </>
                      )}
                      {selectedClient.type === 'new' && (
                        <>
                          <p className="font-medium">
                            {selectedClient.data.firstName}{' '}
                            {selectedClient.data.lastName}
                          </p>
                          <p className="text-sm text-gray-600">New Client</p>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedClient(null)}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Service Selection */}
              <div>
                <label className="text-sm font-medium text-gray-900 block mb-2">
                  Services
                </label>
                <ServiceSelection
                  venueId={venueId}
                  teamMemberId={selectedTeamMemberId}
                  services={services}
                  onServicesChange={setServices}
                />
              </div>

              {/* Team Member (Read-only for now) */}
              <div>
                <label className="text-sm font-medium text-gray-900 block mb-2">
                  Team member
                </label>
                <div className="px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">
                    {selectedTeamMemberName}
                  </span>
                </div>
                {availabilityStatus && !availabilityStatus.available && (
                  <div className="mt-2 flex items-start gap-2 text-orange-600">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">
                      {selectedTeamMemberName} isn&apos;t scheduled to work at
                      this time
                    </p>
                  </div>
                )}
              </div>

              {/* Time and Duration Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Start Time */}
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-2">
                    Start time
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                      className={`w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between transition-colors ${
                        availabilityStatus && !availabilityStatus.available
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <span className="text-gray-900">
                        {formatTime12Hour(selectedStartTime)}
                      </span>
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </button>

                    {/* Time Dropdown */}
                    {showTimeDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {timeSlots.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => {
                              setSelectedStartTime(time);
                              setShowTimeDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                              time === selectedStartTime
                                ? 'bg-purple-50 text-purple-600 font-medium'
                                : ''
                            }`}
                          >
                            {formatTime12Hour(time)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Availability Status */}
                  {availabilityStatus && !availabilityStatus.available && (
                    <div className="mt-2 flex items-start gap-2 text-orange-600">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{availabilityStatus.message}</p>
                    </div>
                  )}
                </div>

                {/* Duration */}
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-2">
                    Duration
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={manualDuration || totalDuration}
                      onChange={(e) =>
                        setManualDuration(parseInt(e.target.value) || null)
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Minutes"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      min
                    </span>
                  </div>
                </div>
              </div>

              {/* Price and Discount Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Service Price */}
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-2">
                    Service price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      AUD
                    </span>
                    <input
                      type="number"
                      value={manualPrice !== null ? manualPrice : totalPrice}
                      onChange={(e) =>
                        setManualPrice(parseFloat(e.target.value) || null)
                      }
                      className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Discount (placeholder) */}
                <div>
                  <label className="text-sm font-medium text-gray-900 block mb-2">
                    Discount
                  </label>
                  <select
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    disabled
                  >
                    <option>No discount</option>
                  </select>
                </div>
              </div>

              {/* Booking Notes */}
              <div>
                <label className="text-sm font-medium text-gray-900 block mb-2">
                  Booking notes (optional)
                </label>
                <textarea
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="Any notes for this booking..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="text-sm font-medium text-gray-900 block mb-2">
                  Internal notes (staff only)
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Private notes for staff..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Footer with Total and Actions */}
            <div className="flex-shrink-0 border-t border-gray-200">
              {/* Total Summary */}
              <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    {totalDuration}min
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    A${' '}
                    {(manualPrice !== null ? manualPrice : totalPrice).toFixed(
                      2
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    isSubmitting ||
                    !selectedClient ||
                    services.length === 0 ||
                    availabilityStatus?.available === false
                  }
                  className="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Selection Slide-in */}
      {clientSelectionOpen && (
        <ClientSelection
          isOpen={clientSelectionOpen}
          venueId={venueId}
          onSelect={handleClientSelect}
          onClose={() => setClientSelectionOpen(false)}
        />
      )}
    </>
  );
}

// Helper function
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
