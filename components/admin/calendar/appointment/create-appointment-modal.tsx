// components/admin/calendar/appointment/create-appointment-modal.tsx
'use client';

import { useState } from 'react';
import { X, User } from 'lucide-react';
import { ClientSelection } from './client-selection';
import { ServiceSelection } from './service-selection';
import { createCalendarAppointment } from '@/app/actions/calendar-appointments';
import type { ClientSelectionType, SelectedService } from './types';

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Pre-filled from calendar
  venueId: string;
  venueName: string;
  teamMemberId: string;
  teamMemberName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM

  onSuccess: () => void;
}

// FIXED: Proper type instead of 'any'
interface AppointmentRequestData {
  venueId: string;
  bookingDate: string;
  teamMemberId: string;
  startTime: string;
  services: SelectedService[];
  bookingNotes?: string;
  internalNotes?: string;
  // Client info (one of these will be set)
  walkIn?: boolean;
  clientId?: string;
  newClient?: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    birthday?: string;
  };
}

export function CreateAppointmentModal({
  isOpen,
  onClose,
  venueId,
  venueName,
  teamMemberId,
  teamMemberName,
  date,
  startTime,
  onSuccess,
}: CreateAppointmentModalProps) {
  // State
  const [clientSelectionOpen, setClientSelectionOpen] = useState(false);
  const [selectedClient, setSelectedClient] =
    useState<ClientSelectionType>(null);
  const [services, setServices] = useState<SelectedService[]>([]);
  const [bookingNotes, setBookingNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

    setIsSubmitting(true);
    setError('');

    try {
      // FIXED: Build request data with proper type
      const requestData: AppointmentRequestData = {
        venueId,
        bookingDate: date,
        teamMemberId,
        startTime,
        services,
        bookingNotes: bookingNotes || undefined,
        internalNotes: internalNotes || undefined,
      };

      // Add client info based on selection type
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
                    {formatDate(date)} at {startTime}
                  </p>
                  <p className="text-xs text-gray-500">
                    {teamMemberName} • {venueName}
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
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
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
                    className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition-all"
                  >
                    <User className="h-5 w-5 text-gray-400" />
                    <div className="text-left">
                      <div className="font-medium text-gray-900">
                        Add client
                      </div>
                      <div className="text-xs text-gray-500">
                        Or leave empty for walk-ins
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div>
                      {selectedClient.type === 'walkin' && (
                        <p className="font-medium">Walk-In</p>
                      )}
                      {selectedClient.type === 'existing' && (
                        <>
                          <p className="font-medium">
                            {selectedClient.client.first_name}{' '}
                            {selectedClient.client.last_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {selectedClient.client.email ||
                              selectedClient.client.phone_number ||
                              'No contact info'}
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
                  teamMemberId={teamMemberId}
                  services={services}
                  onServicesChange={setServices}
                />
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
                  rows={3}
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

            {/* Footer */}
            <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={
                  isSubmitting || !selectedClient || services.length === 0
                }
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Appointment'}
              </button>
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
