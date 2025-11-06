// components/admin/calendar/appointment/create-appointment-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Search, User, UserPlus } from 'lucide-react';
import { AddClientModal } from '@/components/admin/clients';
import {
  createCalendarAppointment,
  searchClientsForBooking,
  getRecentClients,
} from '@/app/actions/calendar-appointments';
import { getAvailableServices } from '@/app/actions/services';
import type { ClientSelectionType, SelectedService, ClientInfo } from './types';
import Image from 'next/image';

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  venueId: string;
  venueName: string;
  teamMemberId: string;
  teamMemberName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  onSuccess: () => void;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  category_name: string | null;
  category_color: string | null;
  price: number;
}

interface ServicesByCategory {
  categoryName: string;
  categoryColor: string | null;
  services: Service[];
  serviceCount: number;
}

export function CreateAppointmentModal({
  isOpen,
  onClose,
  venueId,

  teamMemberId,
  teamMemberName,
  date,
  startTime: initialStartTime,
  onSuccess,
}: CreateAppointmentModalProps) {
  // Service selection state
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Client selection state
  const [selectedClient, setSelectedClient] =
    useState<ClientSelectionType>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClientInfo[]>([]);
  const [recentClients, setRecentClients] = useState<ClientInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Appointment details state
  const [selectedStartTime, setSelectedStartTime] = useState(initialStartTime);
  const [manualPrice, setManualPrice] = useState<number | null>(null);
  const [manualDuration, setManualDuration] = useState<number | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedService(null);
      setSelectedClient(null);
      setBookingNotes('');
      setInternalNotes('');
      setManualPrice(null);
      setManualDuration(null);
      setError('');
      setServiceSearchQuery('');
      setClientSearchQuery('');
      setShowClientSearch(false);
    }
  }, [isOpen]);

  // Load services when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadServices = async () => {
        setServicesLoading(true);
        try {
          const result = await getAvailableServices(venueId, teamMemberId);
          if (result.success && result.services) {
            const transformedServices: Service[] = result.services.map(
              (service) => ({
                id: service.id,
                name: service.name,
                duration_minutes: service.base_duration,
                category_name: service.service_categories?.name || null,
                category_color: service.service_categories?.color || null,
                price: service.base_price || 0,
              })
            );
            setAvailableServices(transformedServices);
          }
        } catch (err) {
          console.error('Error loading services:', err);
        }
        setServicesLoading(false);
      };
      loadServices();
    }
  }, [isOpen, venueId, teamMemberId]);

  // Load recent clients when showing client search
  useEffect(() => {
    if (showClientSearch && recentClients.length === 0) {
      const loadRecentClients = async () => {
        const result = await getRecentClients(venueId, 10);
        if (result.success && result.data) {
          setRecentClients(result.data);
        }
      };
      loadRecentClients();
    }
  }, [showClientSearch, venueId, recentClients.length]);

  // Search clients as user types
  useEffect(() => {
    if (!clientSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const searchClients = async () => {
      setIsSearching(true);
      const result = await searchClientsForBooking(clientSearchQuery);
      if (result.success && result.data) {
        setSearchResults(result.data);
      }
      setIsSearching(false);
    };

    const timer = setTimeout(searchClients, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery]);

  // Calculate totals
  const duration = manualDuration || selectedService?.duration_minutes || 0;
  const price =
    manualPrice !== null ? manualPrice : selectedService?.price || 0;

  // Group services by category
  const servicesByCategory: ServicesByCategory[] = availableServices.reduce(
    (acc: ServicesByCategory[], service) => {
      const categoryName = service.category_name || 'Other';
      const categoryColor = service.category_color;

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

  // Handler functions
  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setManualPrice(null);
    setManualDuration(null);
  };

  const handleClientClick = (client: ClientInfo) => {
    setSelectedClient({ type: 'existing', client });
    setShowClientSearch(false);
    setClientSearchQuery('');
  };

  const handleWalkIn = () => {
    setSelectedClient({ type: 'walkin' });
    setShowClientSearch(false);
  };

  const handleAddClientSuccess = () => {
    setShowAddClientModal(false);
    setShowClientSearch(false);
    const loadRecentClients = async () => {
      const result = await getRecentClients(venueId, 10);
      if (result.success && result.data) {
        setRecentClients(result.data);
      }
    };
    loadRecentClients();
  };

  const handleSubmit = async () => {
    if (!selectedService) {
      setError('Please select a service');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const finalService: SelectedService = {
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        duration: duration,
        price: price,
        categoryColor: selectedService.category_color || undefined,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestData: any = {
        venueId,
        bookingDate: date,
        teamMemberId,
        startTime: selectedStartTime,
        services: [finalService],
        bookingNotes: bookingNotes || undefined,
        internalNotes: internalNotes || undefined,
      };

      if (selectedClient?.type === 'walkin') {
        requestData.walkIn = true;
      } else if (selectedClient?.type === 'existing') {
        requestData.clientId = selectedClient.client.id;
      } else if (selectedClient?.type === 'new') {
        requestData.newClient = selectedClient.data;
      } else {
        requestData.walkIn = true;
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

  const getPriceDisplay = (price: number) => {
    return price === 0 ? 'Free' : `A$ ${price.toFixed(0)}`;
  };

  const getClientDisplay = () => {
    if (!selectedClient) return null;
    if (selectedClient.type === 'walkin') return 'Walk-in';
    if (selectedClient.type === 'existing') {
      const client = selectedClient.client;
      return `${client.first_name} ${client.last_name || ''}`;
    }
    if (selectedClient.type === 'new') {
      const data = selectedClient.data;
      return `${data.firstName} ${data.lastName || ''} (New)`;
    }
    return null;
  };

  const getClientPhoto = () => {
    if (selectedClient?.type === 'existing') {
      return selectedClient.client.photo_url;
    }
    return null;
  };

  const getClientInitials = () => {
    if (selectedClient?.type === 'existing') {
      const client = selectedClient.client;
      return `${client.first_name[0]}${client.last_name?.[0] || ''}`;
    }
    if (selectedClient?.type === 'new') {
      const data = selectedClient.data;
      return `${data.firstName[0]}${data.lastName?.[0] || ''}`;
    }
    return 'WI';
  };

  const getGradientColors = (name: string): string => {
    const colors = [
      '#8B5CF6, #EC4899',
      '#3B82F6, #8B5CF6',
      '#10B981, #3B82F6',
      '#F59E0B, #EF4444',
      '#EC4899, #EF4444',
      '#6366F1, #8B5CF6',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const displayClients = clientSearchQuery.trim()
    ? searchResults
    : recentClients;
  const showNoResults =
    clientSearchQuery.trim() && !isSearching && searchResults.length === 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Right-side Slide-in Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Add appointment
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {teamMemberName} • {formatDate(date)} •{' '}
                {formatTime(selectedStartTime)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Main Content - Two Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR - Client Section */}
          <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
            {/* Client Display/Selection */}
            <div className="p-6">
              {!showClientSearch && !selectedClient && (
                <button
                  onClick={() => setShowClientSearch(true)}
                  className="w-full flex flex-col items-center gap-3 p-6 bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 transition-all"
                >
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                    <UserPlus className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">
                      Add client
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Or leave empty
                      <br />
                      for walk-ins
                    </div>
                  </div>
                </button>
              )}

              {!showClientSearch && selectedClient && (
                <div className="text-center">
                  {/* Client Avatar */}
                  <div className="flex justify-center mb-3">
                    {getClientPhoto() ? (
                      <div className="relative w-16 h-16 rounded-full overflow-hidden">
                        <Image
                          src={getClientPhoto()!}
                          alt="Client"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold bg-purple-500">
                        {getClientInitials()}
                      </div>
                    )}
                  </div>

                  {/* Client Name */}
                  <div className="font-semibold text-gray-900 mb-1">
                    {getClientDisplay()}
                  </div>

                  {/* Change Button */}
                  <button
                    onClick={() => {
                      setSelectedClient(null);
                      setShowClientSearch(true);
                    }}
                    className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Client Search View */}
              {showClientSearch && (
                <div className="space-y-3">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      placeholder="Search client"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                  </div>

                  {/* Client Options */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {/* Add New */}
                    <button
                      onClick={() => {
                        setShowAddClientModal(true);
                        setShowClientSearch(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <UserPlus className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Add new
                        </div>
                        <div className="text-xs text-gray-500">
                          Create profile
                        </div>
                      </div>
                    </button>

                    {/* Walk-in */}
                    <button
                      onClick={handleWalkIn}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Walk-in
                        </div>
                        <div className="text-xs text-gray-500">
                          No info needed
                        </div>
                      </div>
                    </button>

                    {/* Client List */}
                    {isSearching ? (
                      <div className="text-center py-4 text-sm text-gray-500">
                        Searching...
                      </div>
                    ) : showNoResults ? (
                      <div className="text-center py-4 text-sm text-gray-500">
                        No clients found
                      </div>
                    ) : (
                      displayClients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => handleClientClick(client)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors text-left"
                        >
                          {client.photo_url ? (
                            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                              <Image
                                src={client.photo_url}
                                alt={client.first_name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                              style={{
                                background: `linear-gradient(135deg, ${getGradientColors(
                                  client.first_name
                                )})`,
                              }}
                            >
                              {client.first_name[0]}
                              {client.last_name?.[0] || ''}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {client.first_name} {client.last_name || ''}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {client.email ||
                                client.phone_number ||
                                'No contact'}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT MAIN AREA - Service Selection */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Service Title & Search */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Select a service
                </h3>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={serviceSearchQuery}
                    onChange={(e) => setServiceSearchQuery(e.target.value)}
                    placeholder="Search by service name"
                    className="w-full pl-12 pr-4 py-3 border-2 border-purple-500 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Services by Category */}
              <div className="space-y-6">
                {servicesLoading ? (
                  <div className="text-center py-12 text-gray-500">
                    Loading services...
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No services found matching &quot;{serviceSearchQuery}&quot;
                  </div>
                ) : (
                  filteredCategories.map((category) => (
                    <div key={category.categoryName}>
                      {/* Category Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-lg font-bold text-gray-900">
                          {category.categoryName}
                        </h4>
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                          {category.serviceCount}
                        </span>
                      </div>

                      {/* Services in Category */}
                      <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
                        {category.services.map((service, index) => (
                          <button
                            key={service.id}
                            onClick={() => handleServiceClick(service)}
                            className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${
                              index !== 0 ? 'border-t border-gray-200' : ''
                            } ${
                              selectedService?.id === service.id
                                ? 'bg-purple-50 border-l-4 border-l-purple-600'
                                : ''
                            }`}
                          >
                            {/* Color Bar */}
                            <div
                              className="w-1 h-10 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  category.categoryColor || '#E5E7EB',
                              }}
                            />

                            {/* Service Info */}
                            <div className="flex-1 text-left">
                              <div className="font-semibold text-gray-900 mb-0.5">
                                {service.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {service.duration_minutes}min
                              </div>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <div className="font-medium text-gray-900">
                                {getPriceDisplay(service.price)}
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

            {/* Selected Service Details (Bottom of right column) */}
            {selectedService && (
              <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {/* Start Time */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Start time
                    </label>
                    <select
                      value={selectedStartTime}
                      onChange={(e) => setSelectedStartTime(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-purple-500"
                    >
                      {generateTimeSlots().map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <input
                      type="number"
                      value={manualDuration || ''}
                      onChange={(e) =>
                        setManualDuration(
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      placeholder={`${selectedService.duration_minutes}`}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-purple-500"
                      min="5"
                      step="5"
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Price
                    </label>
                    <input
                      type="number"
                      value={manualPrice !== null ? manualPrice : ''}
                      onChange={(e) =>
                        setManualPrice(
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder={`${selectedService.price.toFixed(2)}`}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-purple-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Notes Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Booking notes
                    </label>
                    <textarea
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Client visible..."
                      rows={2}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Internal notes
                    </label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Staff only..."
                      rows={2}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedService ? (
                <>
                  <span className="font-semibold text-gray-900">
                    A${price.toFixed(2)}
                  </span>
                  {' • '}
                  {duration} min
                </>
              ) : (
                <span className="text-gray-400">
                  Select a service to continue
                </span>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedService}
              className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create appointment'}
            </button>
          </div>
        </div>
      </div>

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={showAddClientModal}
        onClose={handleAddClientSuccess}
      />
    </>
  );
}
