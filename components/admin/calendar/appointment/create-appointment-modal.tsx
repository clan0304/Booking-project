// components/admin/calendar/appointment/create-appointment-modal.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  User,
  UserPlus,
  Plus,
  ChevronDown,
  Trash2,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { AddClientModal } from '@/components/admin/clients';
import {
  createCalendarAppointment,
  searchClientsForBooking,
  getRecentClients,
  getBookingById,
} from '@/app/actions/calendar-appointments';
import { getAvailableServices } from '@/app/actions/services';
import { getTeamMembersByVenue } from '@/app/actions/team-venue-assignments';
import type { ClientSelectionType, SelectedService, ClientInfo } from './types';
import Image from 'next/image';
import {
  ProductPicker,
  ProductQuantityEditor,
  type SelectedProduct,
} from './product-picker';
import { PaymentMode } from './edit-appointment-payment-mode';
import type { BookingGroupWithAppointments } from '@/types/calendar';
import type { EditingAppointment } from './edit-appointment-types';

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

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

// A service added to the booking with its specific settings
interface AddedService {
  id: string; // Unique ID for this added service instance
  serviceId: string;
  serviceName: string;
  categoryColor: string | null;
  startTime: string; // HH:MM
  duration: number;
  price: number;
  teamMemberId: string;
  teamMemberName: string;
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
  // =====================================================
  // VIEW STATE
  // =====================================================
  const [currentView, setCurrentView] = useState<
    'main' | 'service-picker' | 'payment'
  >('main');

  // Saved booking for payment mode
  const [savedBooking, setSavedBooking] =
    useState<BookingGroupWithAppointments | null>(null);

  // =====================================================
  // SERVICES STATE
  // =====================================================
  const [addedServices, setAddedServices] = useState<AddedService[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

  // =====================================================
  // TEAM MEMBERS STATE
  // =====================================================
  const [availableTeamMembers, setAvailableTeamMembers] = useState<
    TeamMember[]
  >([]);

  // =====================================================
  // CLIENT STATE
  // =====================================================
  const [selectedClient, setSelectedClient] =
    useState<ClientSelectionType>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClientInfo[]>([]);
  const [recentClients, setRecentClients] = useState<ClientInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // =====================================================
  // BOOKING STATE
  // Only internal notes for admin-created bookings
  // Client notes (booking.notes) only come from online bookings
  // =====================================================
  const [internalNotes, setInternalNotes] = useState('');

  // =====================================================
  // SUBMISSION STATE
  // =====================================================
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // =====================================================
  // DROPDOWN STATE
  // =====================================================
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(
    null
  );

  // =====================================================
  // PRODUCTS STATE
  // =====================================================
  const [addedProducts, setAddedProducts] = useState<SelectedProduct[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // =====================================================
  // EFFECTS
  // =====================================================

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAddedServices([]);
      setAddedProducts([]); // Reset products
      setSelectedClient(null);
      setInternalNotes('');
      setError('');
      setServiceSearchQuery('');
      setClientSearchQuery('');
      setShowClientSearch(false);
      setCurrentView('main');
      setExpandedServiceId(null);
      setAvailableTeamMembers([]);
      setShowProductPicker(false);
      setSavedBooking(null); // Reset saved booking
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

  // Load team members for venue when modal opens
  useEffect(() => {
    if (isOpen && venueId) {
      const loadTeamMembers = async () => {
        try {
          const result = await getTeamMembersByVenue(venueId);
          if (result.success && result.data) {
            // Transform the nested data structure
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const members = result.data.map((assignment: any) => {
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
        }
      };
      loadTeamMembers();
    }
  }, [isOpen, venueId]);

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

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  // Calculate total price and duration
  const totalPrice = useMemo(() => {
    const servicesTotal = addedServices.reduce((sum, s) => sum + s.price, 0);
    const productsTotal = addedProducts.reduce(
      (sum, p) => sum + p.unitPrice * p.quantity,
      0
    );
    return servicesTotal + productsTotal;
  }, [addedServices, addedProducts]);

  const totalDuration = useMemo(() => {
    return addedServices.reduce((sum, s) => sum + s.duration, 0);
  }, [addedServices]);

  // Check if we have anything to save
  const hasItems = addedServices.length > 0 || addedProducts.length > 0;

  // Get the next available start time (after the last service ends)
  const getNextStartTime = (): string => {
    if (addedServices.length === 0) {
      return initialStartTime;
    }

    const lastService = addedServices[addedServices.length - 1];
    return addMinutesToTime(lastService.startTime, lastService.duration);
  };

  // Get the booking start time (first service's start time)
  const bookingStartTime = useMemo(() => {
    if (addedServices.length === 0) return initialStartTime;
    return addedServices[0].startTime;
  }, [addedServices, initialStartTime]);

  // Group services by category for the picker
  const servicesByCategory: ServicesByCategory[] = useMemo(() => {
    const grouped = availableServices.reduce(
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

    grouped.forEach((category) => {
      category.serviceCount = category.services.length;
    });

    return grouped;
  }, [availableServices]);

  // Filter by search query
  const filteredCategories = useMemo(() => {
    return servicesByCategory
      .map((category) => ({
        ...category,
        services: category.services.filter((service) =>
          service.name.toLowerCase().includes(serviceSearchQuery.toLowerCase())
        ),
      }))
      .filter((category) => category.services.length > 0);
  }, [servicesByCategory, serviceSearchQuery]);

  // Get client alert note if client is selected and has one
  const clientAlertNote = useMemo(() => {
    if (selectedClient?.type === 'existing') {
      return selectedClient.client.alert_note;
    }
    return null;
  }, [selectedClient]);

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  const addMinutesToTime = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(
      2,
      '0'
    )}`;
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

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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

  const getPriceDisplay = (price: number): string => {
    return price === 0 ? 'Free' : `A$${price.toFixed(0)}`;
  };

  const getDurationDisplay = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const getClientDisplay = (): string | null => {
    if (!selectedClient) return null;
    if (selectedClient.type === 'walkin') return 'Walk-in';
    if (selectedClient.type === 'existing') {
      const client = selectedClient.client;
      return `${client.first_name} ${client.last_name || ''}`.trim();
    }
    if (selectedClient.type === 'new') {
      const data = selectedClient.data;
      return `${data.firstName} ${data.lastName || ''} (New)`.trim();
    }
    return null;
  };

  const getClientPhoto = (): string | null => {
    if (selectedClient?.type === 'existing') {
      return selectedClient.client.photo_url;
    }
    return null;
  };

  const getClientInitials = (): string => {
    if (selectedClient?.type === 'existing') {
      const client = selectedClient.client;
      return `${client.first_name[0]}${
        client.last_name?.[0] || ''
      }`.toUpperCase();
    }
    if (selectedClient?.type === 'new') {
      const data = selectedClient.data;
      return `${data.firstName[0]}${data.lastName?.[0] || ''}`.toUpperCase();
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

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleAddService = (service: Service) => {
    const newService: AddedService = {
      id: `${service.id}-${Date.now()}`, // Unique instance ID
      serviceId: service.id,
      serviceName: service.name,
      categoryColor: service.category_color,
      startTime: getNextStartTime(),
      duration: service.duration_minutes,
      price: service.price,
      teamMemberId: teamMemberId,
      teamMemberName: teamMemberName,
    };

    setAddedServices((prev) => [...prev, newService]);
    setCurrentView('main');
    setServiceSearchQuery('');
  };

  const handleRemoveService = (serviceInstanceId: string) => {
    setAddedServices((prev) => {
      const filtered = prev.filter((s) => s.id !== serviceInstanceId);
      // Recalculate times for remaining services
      return recalculateServiceTimes(filtered);
    });
    setExpandedServiceId(null);
  };

  const handleUpdateService = (
    serviceInstanceId: string,
    field: keyof AddedService,
    value: string | number
  ) => {
    setAddedServices((prev) => {
      const updated = prev.map((s) =>
        s.id === serviceInstanceId ? { ...s, [field]: value } : s
      );

      // If duration changed, recalculate subsequent service times
      if (field === 'duration') {
        return recalculateServiceTimes(updated);
      }

      return updated;
    });
  };

  // =====================================================
  // PRODUCT HANDLERS
  // =====================================================
  const handleAddProduct = (product: SelectedProduct) => {
    // Check if product already exists, if so increase quantity
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

  const handleTeamMemberChange = (
    serviceInstanceId: string,
    newTeamMemberId: string
  ) => {
    const selectedMember = availableTeamMembers.find(
      (m) => m.id === newTeamMemberId
    );
    if (selectedMember) {
      setAddedServices((prev) =>
        prev.map((s) =>
          s.id === serviceInstanceId
            ? {
                ...s,
                teamMemberId: selectedMember.id,
                teamMemberName: `${selectedMember.first_name} ${selectedMember.last_name}`,
              }
            : s
        )
      );
    }
  };

  const recalculateServiceTimes = (
    services: AddedService[]
  ): AddedService[] => {
    if (services.length === 0) return services;

    return services.map((service, index) => {
      if (index === 0) return service;

      const prevService = services[index - 1];
      const newStartTime = addMinutesToTime(
        prevService.startTime,
        prevService.duration
      );

      return { ...service, startTime: newStartTime };
    });
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

  const handleAddClientSuccess = (client?: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string;
    phone_number: string | null;
    photo_url: string | null;
    alert_note?: string | null;
  }) => {
    setShowAddClientModal(false);
    setShowClientSearch(false);

    // If client data provided, auto-select the new client
    if (client) {
      setSelectedClient({
        type: 'existing',
        client: {
          id: client.id,
          first_name: client.first_name,
          last_name: client.last_name,
          email: client.email,
          phone_number: client.phone_number,
          photo_url: client.photo_url,
          alert_note: client.alert_note,
        },
      });
    }

    // Also refresh recent clients list
    const loadRecentClients = async () => {
      const result = await getRecentClients(venueId, 10);
      if (result.success && result.data) {
        setRecentClients(result.data);
      }
    };
    loadRecentClients();
  };

  const handleSubmit = async (goToCheckout: boolean = false) => {
    if (addedServices.length === 0 && addedProducts.length === 0) {
      setError('Please add at least one service or product');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      // Group services by team member for creating separate appointments
      const services: SelectedService[] = addedServices.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        duration: s.duration,
        price: s.price,
        categoryColor: s.categoryColor || undefined,
        teamMemberId: s.teamMemberId, // Include team member per service
        startTime: s.startTime, // Include start time per service
      }));

      // Build products array
      const products = addedProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestData: any = {
        venueId,
        bookingDate: date,
        teamMemberId, // Default team member (from clicked slot)
        startTime: bookingStartTime,
        services,
        products, // Include products
        // No bookingNotes - client notes only come from online bookings
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
        if (goToCheckout && result.bookingId) {
          // Checkout flow: fetch booking and switch to payment mode
          try {
            const bookingResult = await getBookingById(result.bookingId);
            if (bookingResult.success && bookingResult.data) {
              setSavedBooking(bookingResult.data);
              setCurrentView('payment');
            } else {
              setError('Failed to load booking for checkout');
            }
          } catch (fetchError) {
            console.error('Error fetching booking:', fetchError);
            setError('Failed to load booking for checkout');
          }
        } else {
          // Normal save flow
          onSuccess();
          onClose();
        }
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

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const displayClients = clientSearchQuery.trim()
    ? searchResults
    : recentClients;
  const showNoResults =
    clientSearchQuery.trim() && !isSearching && searchResults.length === 0;

  if (!isOpen) return null;

  // =====================================================
  // PAYMENT VIEW
  // =====================================================

  if (currentView === 'payment' && savedBooking) {
    // Create editingAppointments map from booking appointments
    const editingAppointments = new Map<string, EditingAppointment>();
    savedBooking.appointments?.forEach((apt) => {
      editingAppointments.set(apt.id, {
        id: apt.id,
        serviceId: apt.service_id,
        serviceName: apt.service_name,
        teamMemberId: apt.team_member_id,
        startTime: apt.start_time.substring(0, 5),
        duration: apt.duration_minutes,
        price: apt.price,
        categoryColor: undefined,
      });
    });

    // Calculate total price (services + products)
    const servicesTotal = Array.from(editingAppointments.values()).reduce(
      (sum, apt) => sum + apt.price,
      0
    );
    const productsTotal = addedProducts.reduce(
      (sum, p) => sum + p.unitPrice * p.quantity,
      0
    );
    const paymentTotalPrice = servicesTotal + productsTotal;

    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-50"
          onClick={() => {
            onSuccess();
            onClose();
          }}
        />
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] md:w-[600px] lg:w-[750px] xl:w-[900px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
          <PaymentMode
            booking={savedBooking}
            editingAppointments={editingAppointments}
            addedProducts={addedProducts}
            totalPrice={paymentTotalPrice}
            onBack={() => {
              // Go back to main view (but booking is already saved)
              setCurrentView('main');
            }}
            onClose={() => {
              onSuccess(); // Refresh calendar
              onClose();
            }}
            onSuccess={() => {
              setAddedProducts([]);
              setSavedBooking(null);
              onSuccess();
              onClose();
            }}
          />
        </div>
      </>
    );
  }

  // =====================================================
  // SERVICE PICKER VIEW
  // =====================================================

  if (currentView === 'service-picker') {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setCurrentView('main')}
        />
        <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setCurrentView('main');
                  setServiceSearchQuery('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-bold text-gray-900">Add service</h2>
            </div>
          </div>

          {/* Search */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)}
                placeholder="Search by service name"
                className="w-full pl-12 pr-4 py-3 border-2 border-purple-500 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-600"
                autoFocus
              />
            </div>
          </div>

          {/* Services List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {servicesLoading ? (
              <div className="text-center py-12 text-gray-500">
                Loading services...
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No services found
              </div>
            ) : (
              filteredCategories.map((category) => (
                <div key={category.categoryName}>
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-lg font-bold text-gray-900">
                      {category.categoryName}
                    </h4>
                    <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                      {category.serviceCount}
                    </span>
                  </div>

                  <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
                    {category.services.map((service, index) => (
                      <button
                        key={service.id}
                        onClick={() => handleAddService(service)}
                        className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-purple-50 transition-colors ${
                          index !== 0 ? 'border-t border-gray-200' : ''
                        }`}
                      >
                        <div
                          className="w-1 h-10 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              category.categoryColor || '#E5E7EB',
                          }}
                        />
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-gray-900 mb-0.5">
                            {service.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {service.duration_minutes}min
                          </div>
                        </div>
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
      </>
    );
  }

  // =====================================================
  // MAIN VIEW
  // =====================================================

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Add appointment
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {teamMemberName} • {formatDate(date)}
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

        {/* Client Alert Banner - Shows when client has alert_note */}
        {clientAlertNote && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Client Alert
                </p>
                <p className="text-sm text-amber-700 mt-1">{clientAlertNote}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR - Client Section */}
          <div className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col">
            <div className="p-4">
              {!showClientSearch && !selectedClient && (
                <button
                  onClick={() => setShowClientSearch(true)}
                  className="w-full flex flex-col items-center gap-2 p-4 bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 transition-all"
                >
                  <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center">
                    <UserPlus className="w-7 h-7 text-purple-600" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 text-sm">
                      Add client
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Or leave empty for walk-ins
                    </div>
                  </div>
                </button>
              )}

              {!showClientSearch && selectedClient && (
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    {getClientPhoto() ? (
                      <div className="relative w-14 h-14 rounded-full overflow-hidden">
                        <Image
                          src={getClientPhoto()!}
                          alt="Client"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                        style={{
                          background: `linear-gradient(135deg, ${getGradientColors(
                            getClientDisplay() || 'W'
                          )})`,
                        }}
                      >
                        {getClientInitials()}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mb-1">
                    {getClientDisplay()}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedClient(null);
                      setShowClientSearch(true);
                    }}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                  >
                    Change
                  </button>
                </div>
              )}

              {showClientSearch && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      placeholder="Search client"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    <button
                      onClick={() => {
                        setShowAddClientModal(true);
                        setShowClientSearch(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <UserPlus className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-xs">
                        <div className="font-medium text-gray-900">Add new</div>
                      </div>
                    </button>

                    <button
                      onClick={handleWalkIn}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="text-xs">
                        <div className="font-medium text-gray-900">Walk-in</div>
                      </div>
                    </button>

                    {isSearching ? (
                      <div className="text-center py-3 text-xs text-gray-500">
                        Searching...
                      </div>
                    ) : showNoResults ? (
                      <div className="text-center py-3 text-xs text-gray-500">
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
                            <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                              <Image
                                src={client.photo_url}
                                alt={client.first_name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
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
                            <div className="text-xs font-medium text-gray-900 truncate">
                              {client.first_name} {client.last_name || ''}
                            </div>
                            {/* Alert indicator for clients with alert_note */}
                            {client.alert_note && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                <span className="text-[10px] text-amber-600">
                                  Has alert
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT MAIN AREA - Date/Time & Services */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Date/Time Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-gray-900">
                  {formatDate(date)}
                </h3>
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {formatTime(bookingStartTime)} • Doesn&apos;t repeat
              </p>
            </div>

            {/* Services & Products Section */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Services Section */}
              <h4 className="text-lg font-bold text-gray-900 mb-4">Services</h4>

              {/* Added Services List */}
              <div className="space-y-3">
                {addedServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-gray-50 rounded-xl overflow-hidden"
                  >
                    {/* Service Row */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() =>
                        setExpandedServiceId(
                          expandedServiceId === service.id ? null : service.id
                        )
                      }
                    >
                      {/* Color Bar */}
                      <div
                        className="w-1 self-stretch rounded flex-shrink-0"
                        style={{
                          backgroundColor: service.categoryColor || '#E5E7EB',
                        }}
                      />

                      {/* Service Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">
                          {service.serviceName}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatTime(service.startTime)} •{' '}
                          {getDurationDisplay(service.duration)} •{' '}
                          {service.teamMemberName}
                        </p>
                      </div>

                      {/* Price */}
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">
                          {getPriceDisplay(service.price)}
                        </p>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveService(service.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Expanded Edit Section */}
                    {expandedServiceId === service.id && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-200 space-y-3">
                        {/* Team Member Selector */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Team member
                          </label>
                          <select
                            value={service.teamMemberId}
                            onChange={(e) =>
                              handleTeamMemberChange(service.id, e.target.value)
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-purple-500"
                          >
                            {availableTeamMembers.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.first_name} {member.last_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Time, Duration, Price Row */}
                        <div className="grid grid-cols-3 gap-3">
                          {/* Start Time */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Start time
                            </label>
                            <select
                              value={service.startTime}
                              onChange={(e) =>
                                handleUpdateService(
                                  service.id,
                                  'startTime',
                                  e.target.value
                                )
                              }
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
                              value={service.duration}
                              onChange={(e) =>
                                handleUpdateService(
                                  service.id,
                                  'duration',
                                  parseInt(e.target.value) || 0
                                )
                              }
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
                              value={service.price}
                              onChange={(e) =>
                                handleUpdateService(
                                  service.id,
                                  'price',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-purple-500"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Service Button */}
                <button
                  onClick={() => setCurrentView('service-picker')}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors w-fit"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Add service
                  </span>
                </button>
              </div>

              {/* Products Section */}
              <div className="mt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">
                  Products
                </h4>

                {/* Added Products List */}
                <div className="space-y-2 mb-3">
                  {addedProducts.map((product) => (
                    <ProductQuantityEditor
                      key={product.id}
                      product={product}
                      onUpdateQuantity={handleUpdateProductQuantity}
                      onRemove={handleRemoveProduct}
                    />
                  ))}
                </div>

                {/* Add Product Button */}
                <button
                  onClick={() => setShowProductPicker(true)}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors w-fit"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Add product
                  </span>
                </button>
              </div>

              {/* Notes Section - Only Internal Notes for admin-created bookings */}
              {hasItems && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Internal notes
                    </label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Staff only..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
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
            {/* Total */}
            <div>
              <span className="text-sm text-gray-600">Total</span>
              <span className="ml-2 text-lg font-bold text-gray-900">
                {hasItems ? `A$${totalPrice.toFixed(0)}` : 'A$0'}
              </span>
              {totalDuration > 0 && (
                <span className="ml-2 text-sm text-gray-500">
                  • {getDurationDisplay(totalDuration)}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {/* More Options Button */}
              <button className="p-3 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="6" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="18" r="2" />
                </svg>
              </button>

              {/* Checkout Button */}
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting || !hasItems}
                className="px-6 py-3 border border-gray-300 rounded-full font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Checkout'}
              </button>

              {/* Save Button */}
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || !hasItems}
                className="px-8 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
        onSuccess={handleAddClientSuccess}
      />

      {/* Product Picker */}
      {showProductPicker && (
        <ProductPicker
          venueId={venueId}
          onSelectProduct={handleAddProduct}
          onClose={() => setShowProductPicker(false)}
          existingProducts={addedProducts}
        />
      )}
    </>
  );
}
