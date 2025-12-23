// components/admin/calendar/rebook-confirm-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  ChevronDown,
  ChevronRight,
  Clock,
  Calendar,
  User,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { getAvailableServices } from '@/app/actions/services';
import { getTeamMembersByVenue } from '@/app/actions/team-venue-assignments';
import type { RebookService, RebookClient } from './rebook-overlay';

// =====================================================
// TYPES
// =====================================================

interface RebookConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isConfirming: boolean;

  // Booking details
  venueId: string;
  selectedDate: string;
  selectedTime: string;
  selectedTeamMemberId: string;
  selectedTeamMemberName: string;
  client: RebookClient;
  services: RebookService[];

  // Callbacks for editing
  onUpdateService: (index: number, updates: Partial<RebookService>) => void;
  onAddService: (service: RebookService) => void;
  onDeleteService: (index: number) => void;
  onUpdateTeamMember: (teamMemberId: string, teamMemberName: string) => void;
  onUpdateTime: (time: string) => void;
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

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime12Hour(time: string): string {
  const [hour, min] = time.split(':');
  const hourNum = parseInt(hour);
  const period = hourNum >= 12 ? 'pm' : 'am';
  const displayHour =
    hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
  return `${displayHour}:${min}${period}`;
}

function getDurationDisplay(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      slots.push(
        `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      );
    }
  }
  return slots;
}

function generateDurationOptions(): number[] {
  const options: number[] = [];
  for (let i = 15; i <= 240; i += 15) {
    options.push(i);
  }
  return options;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function RebookConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isConfirming,
  venueId,
  selectedDate,
  selectedTime,
  selectedTeamMemberId,
  selectedTeamMemberName,
  client,
  services,
  onUpdateService,
  onAddService,
  onDeleteService,
  onUpdateTeamMember,
  onUpdateTime,
}: RebookConfirmModalProps) {
  // State
  const [availableTeamMembers, setAvailableTeamMembers] = useState<
    TeamMember[]
  >([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(true);
  const [availableServices, setAvailableServices] = useState<
    Map<string, Service[]>
  >(new Map());
  const [servicesLoading, setServicesLoading] = useState<Set<string>>(
    new Set()
  );

  // Dropdowns state
  const [expandedServiceIndex, setExpandedServiceIndex] = useState<
    number | null
  >(null);
  const [showTeamMemberDropdown, setShowTeamMemberDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState<
    number | null
  >(null);

  // Service picker state
  const [showServicePicker, setShowServicePicker] = useState<
    number | 'add-new' | null
  >(null);

  // Delete confirmation state
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(
    null
  );

  // Load team members
  useEffect(() => {
    if (!isOpen) return;

    const loadTeamMembers = async () => {
      setTeamMembersLoading(true);
      try {
        const result = await getTeamMembersByVenue(venueId);
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
      } finally {
        setTeamMembersLoading(false);
      }
    };

    loadTeamMembers();
  }, [isOpen, venueId]);

  // Load services for selected team member
  useEffect(() => {
    if (!isOpen || !selectedTeamMemberId) return;

    const loadServices = async () => {
      if (availableServices.has(selectedTeamMemberId)) return;

      setServicesLoading((prev) => new Set(prev).add(selectedTeamMemberId));
      try {
        const result = await getAvailableServices(
          venueId,
          selectedTeamMemberId
        );
        if (result.success && result.services) {
          setAvailableServices((prev) => {
            const newMap = new Map(prev);
            newMap.set(selectedTeamMemberId, result.services as Service[]);
            return newMap;
          });
        }
      } catch (err) {
        console.error('Error loading services:', err);
      } finally {
        setServicesLoading((prev) => {
          const newSet = new Set(prev);
          newSet.delete(selectedTeamMemberId);
          return newSet;
        });
      }
    };

    loadServices();
  }, [isOpen, selectedTeamMemberId, venueId, availableServices]);

  // Computed values
  const clientName = `${client.firstName} ${client.lastName || ''}`.trim();
  const clientInitials = clientName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

  const selectedTeamMember = availableTeamMembers.find(
    (m) => m.id === selectedTeamMemberId
  );

  // Handler for selecting a service (edit or add new)
  const handleSelectService = (service: Service) => {
    if (showServicePicker === 'add-new') {
      // Add new service
      onAddService({
        serviceId: service.id,
        serviceName: service.name,
        duration: service.base_duration,
        price: service.base_price || 0,
        categoryColor: service.service_categories?.color || null,
      });
    } else if (typeof showServicePicker === 'number') {
      // Update existing service
      onUpdateService(showServicePicker, {
        serviceId: service.id,
        serviceName: service.name,
        duration: service.base_duration,
        price: service.base_price || 0,
        categoryColor: service.service_categories?.color || null,
      });
    }
    setShowServicePicker(null);
  };

  // Handler for delete service
  const handleDeleteService = (index: number) => {
    if (services.length <= 1) {
      // Can't delete the last service
      return;
    }
    onDeleteService(index);
    setDeleteConfirmIndex(null);
    setExpandedServiceIndex(null);
  };

  // Render service picker
  const renderServicePicker = () => {
    const servicesList = availableServices.get(selectedTeamMemberId) || [];

    // Group services by category
    const groupedServices = servicesList.reduce((acc, service) => {
      const categoryName = service.service_categories?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(service);
      return acc;
    }, {} as Record<string, Service[]>);

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {showServicePicker === 'add-new'
                ? 'Add Service'
                : 'Change Service'}
            </h3>
            <button
              onClick={() => setShowServicePicker(null)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {servicesLoading.has(selectedTeamMemberId) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedServices).map(
                  ([categoryName, categoryServices]) => (
                    <div key={categoryName}>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">
                        {categoryName}
                      </h4>
                      <div className="space-y-2">
                        {categoryServices.map((service) => (
                          <button
                            key={service.id}
                            onClick={() => handleSelectService(service)}
                            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors flex items-center gap-3"
                          >
                            <div
                              className="w-1 h-10 rounded-full"
                              style={{
                                backgroundColor:
                                  service.service_categories?.color ||
                                  '#8B5CF6',
                              }}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {service.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {service.base_duration} min
                              </p>
                            </div>
                            <p className="font-medium text-gray-900">
                              A${service.base_price?.toFixed(0) || 0}
                            </p>
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
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[70]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] md:w-[600px] lg:w-[750px] bg-white shadow-2xl z-[70] flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="bg-purple-600 text-white flex-shrink-0">
          <div className="px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Left: Title */}
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold">New Booking</h1>
              </div>

              {/* Right: Close */}
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT SIDEBAR - Client Section */}
          <div className="lg:w-56 xl:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="p-4 lg:p-5">
              {/* Client Display */}
              <div className="flex lg:flex-col items-center lg:items-center gap-4 lg:gap-0 lg:text-center">
                {/* Client Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-xl lg:text-2xl">
                      {clientInitials}
                    </span>
                  </div>
                </div>

                {/* Client Info */}
                <div className="flex-1 lg:mt-3">
                  <h2 className="text-lg font-bold text-gray-900">
                    {clientName}
                  </h2>

                  {/* Contact Icons */}
                  <div className="flex lg:justify-center gap-2 mt-2">
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="p-2 bg-white rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                        title={client.phone}
                      >
                        <Phone className="w-4 h-4 text-gray-600" />
                      </a>
                    )}
                    {client.email && (
                      <a
                        href={`mailto:${client.email}`}
                        className="p-2 bg-white rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                        title={client.email}
                      >
                        <Mail className="w-4 h-4 text-gray-600" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="mt-6 space-y-3">
                {/* Date */}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">
                    {formatDateDisplay(selectedDate)}
                  </span>
                </div>

                {/* Time */}
                <div className="relative">
                  <button
                    onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                    className="flex items-center gap-3 text-sm w-full hover:bg-gray-100 rounded-lg p-2 -ml-2 transition-colors"
                  >
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {formatTime12Hour(selectedTime)}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                  </button>

                  {showTimeDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowTimeDropdown(false)}
                      />
                      <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto w-32">
                        {generateTimeSlots().map((time) => (
                          <button
                            key={time}
                            onClick={() => {
                              onUpdateTime(time);
                              setShowTimeDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                              time === selectedTime
                                ? 'bg-purple-50 text-purple-700'
                                : 'text-gray-700'
                            }`}
                          >
                            {formatTime12Hour(time)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Team Member */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowTeamMemberDropdown(!showTeamMemberDropdown)
                    }
                    className="flex items-center gap-3 text-sm w-full hover:bg-gray-100 rounded-lg p-2 -ml-2 transition-colors"
                  >
                    {selectedTeamMember?.photo_url ? (
                      <Image
                        src={selectedTeamMember.photo_url}
                        alt={selectedTeamMemberName}
                        width={16}
                        height={16}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-gray-700">
                      {selectedTeamMemberName}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                  </button>

                  {showTeamMemberDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowTeamMemberDropdown(false)}
                      />
                      <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto w-48">
                        {teamMembersLoading ? (
                          <div className="p-4 text-center">
                            <Loader2 className="w-5 h-5 animate-spin text-purple-600 mx-auto" />
                          </div>
                        ) : (
                          availableTeamMembers.map((member) => (
                            <button
                              key={member.id}
                              onClick={() => {
                                onUpdateTeamMember(
                                  member.id,
                                  `${member.first_name} ${member.last_name}`
                                );
                                setShowTeamMemberDropdown(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                member.id === selectedTeamMemberId
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'text-gray-700'
                              }`}
                            >
                              {member.photo_url ? (
                                <Image
                                  src={member.photo_url}
                                  alt={`${member.first_name} ${member.last_name}`}
                                  width={24}
                                  height={24}
                                  className="rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                                  <span className="text-purple-600 text-xs font-medium">
                                    {member.first_name[0]}
                                    {member.last_name[0]}
                                  </span>
                                </div>
                              )}
                              {member.first_name} {member.last_name}
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT - Services */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
              {/* Services Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg lg:text-xl font-bold text-gray-900">
                    Services
                  </h3>
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                    {services.length}
                  </span>
                </div>

                {/* Add Service Button */}
                <button
                  onClick={() => setShowServicePicker('add-new')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Service
                </button>
              </div>

              {/* Services List */}
              <div className="space-y-3">
                {services.map((service, index) => {
                  const isExpanded = expandedServiceIndex === index;
                  const categoryColor = service.categoryColor || '#8B5CF6';
                  const canDelete = services.length > 1;

                  return (
                    <div
                      key={index}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                    >
                      {/* Collapsed View */}
                      <div className="flex items-center">
                        <button
                          onClick={() =>
                            setExpandedServiceIndex(isExpanded ? null : index)
                          }
                          className="flex-1 p-3 lg:p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                        >
                          {/* Color Bar */}
                          <div
                            className="w-1 h-12 rounded-full flex-shrink-0"
                            style={{ backgroundColor: categoryColor }}
                          />

                          {/* Service Info */}
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {service.serviceName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {getDurationDisplay(service.duration)}
                            </p>
                          </div>

                          {/* Price */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-gray-900">
                              A${service.price.toFixed(0)}
                            </p>
                          </div>

                          {/* Expand Icon */}
                          <ChevronRight
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </button>

                        {/* Delete Button */}
                        <div className="relative pr-3">
                          <button
                            onClick={() =>
                              setDeleteConfirmIndex(
                                deleteConfirmIndex === index ? null : index
                              )
                            }
                            disabled={!canDelete}
                            className={`p-2 rounded-lg transition-colors ${
                              canDelete
                                ? 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                                : 'text-gray-200 cursor-not-allowed'
                            }`}
                            title={
                              canDelete
                                ? 'Delete service'
                                : 'Cannot delete last service'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Delete Confirmation Tooltip */}
                          {deleteConfirmIndex === index && canDelete && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setDeleteConfirmIndex(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-48">
                                <p className="text-sm text-gray-600 mb-3">
                                  Delete this service?
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setDeleteConfirmIndex(null)}
                                    className="flex-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleDeleteService(index)}
                                    className="flex-1 px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
                          {/* Service Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Service
                            </label>
                            <button
                              onClick={() => setShowServicePicker(index)}
                              className="w-full p-3 border-l-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
                              style={{ borderLeftColor: categoryColor }}
                            >
                              <span className="font-medium text-gray-900">
                                {service.serviceName}, {service.duration}min
                              </span>
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </button>
                          </div>

                          {/* Duration */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Duration
                            </label>
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setShowDurationDropdown(
                                    showDurationDropdown === index
                                      ? null
                                      : index
                                  )
                                }
                                className="w-full p-3 bg-white rounded-lg border border-gray-200 text-left flex items-center justify-between hover:bg-gray-50"
                              >
                                <span>
                                  {getDurationDisplay(service.duration)}
                                </span>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              </button>

                              {showDurationDropdown === index && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() =>
                                      setShowDurationDropdown(null)
                                    }
                                  />
                                  <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto w-full">
                                    {generateDurationOptions().map(
                                      (duration) => (
                                        <button
                                          key={duration}
                                          onClick={() => {
                                            onUpdateService(index, {
                                              duration,
                                            });
                                            setShowDurationDropdown(null);
                                          }}
                                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                                            duration === service.duration
                                              ? 'bg-purple-50 text-purple-700'
                                              : 'text-gray-700'
                                          }`}
                                        >
                                          {getDurationDisplay(duration)}
                                        </button>
                                      )
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Price */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Price
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                A$
                              </span>
                              <input
                                type="number"
                                value={service.price}
                                onChange={(e) =>
                                  onUpdateService(index, {
                                    price: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full p-3 pl-10 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4 lg:p-6">
              {/* Total */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Total</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">
                    A${totalPrice.toFixed(0)}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({getDurationDisplay(totalDuration)})
                  </span>
                </div>
              </div>

              {/* Confirm Button */}
              <button
                onClick={onConfirm}
                disabled={isConfirming || services.length === 0}
                className="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Booking...
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Service Picker Modal */}
      {showServicePicker !== null && renderServicePicker()}
    </>
  );
}
