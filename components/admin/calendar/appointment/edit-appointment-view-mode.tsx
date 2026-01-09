// components/admin/calendar/appointment/edit-appointment-view-mode.tsx
'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  Plus,
  Trash2,
  MoreVertical,
  Check,
  Phone,
  Mail,
  MessageSquare,
  X,
  ChevronRight,
  Receipt,
  RefreshCcw,
} from 'lucide-react';
import Image from 'next/image';
import { updateBookingClientType } from '@/app/actions/calendar-appointments';
import type { ClientType } from '@/lib/client-type-helpers';
import type {
  ViewModeProps,
  EditingAppointment,
  BookingStatus,
} from './edit-appointment-types';
import type { BookingGroupWithAppointments } from '@/types/calendar';

// Extended booking type that includes client_type
// Using Omit to properly override the client_type property
interface BookingWithClientType
  extends Omit<BookingGroupWithAppointments, 'client_type'> {
  client_type?: ClientType | null;
}

export function ViewMode({
  booking,
  editingAppointments,
  availableTeamMembers,
  availableServices,
  bookingStatus,
  showStatusDropdown,
  showMoreMenu,
  bookingNotes,
  allowEdit,
  hasUnsavedChanges,
  isSaving,
  onStatusChange,
  onToggleStatusDropdown,
  onToggleMoreMenu,
  onCheckout,
  onViewSale,
  onSave,
  onToggleEdit,
  onShowServicePicker,
  onEditAppointment,
  onDeleteBooking,
  onDeleteAppointment,
  onRebook,
  onClose,

  formatDate,
  formatTime,
  getPriceDisplay,
  getClientName,
  getClientInitials,
  getTotalPrice,
  getStatusLabel,

  // Products section (optional)
  productsSection,
}: ViewModeProps): React.ReactElement {
  // Cast booking to extended type with client_type
  const bookingWithType = booking as BookingWithClientType;

  // State for delete confirmation tooltip
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const isCompleted: boolean = booking.status === 'completed';

  // =====================================================
  // CLIENT TYPE STATE
  // =====================================================
  const [clientType, setClientType] = useState<ClientType | null>(
    bookingWithType.client_type ?? null
  );
  const [isSavingClientType, setIsSavingClientType] = useState<boolean>(false);
  const [showClientTypeDropdown, setShowClientTypeDropdown] =
    useState<boolean>(false);

  // Handle client type change
  const handleClientTypeChange = async (type: ClientType): Promise<void> => {
    setClientType(type);
    setIsSavingClientType(true);

    try {
      const result = await updateBookingClientType(booking.id, type);
      if (!result.success) {
        console.error('Failed to update client type:', result.error);
        // Revert on error
        setClientType(bookingWithType.client_type ?? null);
      }
    } catch (error) {
      console.error('Error updating client type:', error);
      setClientType(bookingWithType.client_type ?? null);
    } finally {
      setIsSavingClientType(false);
    }
  };

  // Handle delete with confirmation
  const handleDeleteClick = (appointmentId: string): void => {
    // Always show delete confirmation for the specific appointment
    // The booking will only be deleted if Save is clicked with no items
    setDeleteConfirmId(appointmentId);
  };

  // Confirm delete
  const handleConfirmDelete = async (appointmentId: string): Promise<void> => {
    setIsDeleting(true);
    try {
      await onDeleteAppointment(appointmentId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting appointment:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel delete
  const handleCancelDelete = (): void => {
    setDeleteConfirmId(null);
  };

  // Get client photo
  const getClientPhoto = (): string | null => {
    return booking.client?.photo_url ?? null;
  };

  // Get client email
  const getClientEmail = (): string | null => {
    return booking.client?.email ?? null;
  };

  // Get client phone
  const getClientPhone = (): string | null => {
    return booking.client?.phone_number ?? null;
  };

  // Generate gradient colors for avatar
  const getGradientColors = (name: string): string => {
    const colors: string[] = [
      '#8B5CF6, #EC4899',
      '#3B82F6, #8B5CF6',
      '#10B981, #3B82F6',
      '#F59E0B, #EF4444',
      '#EC4899, #EF4444',
      '#6366F1, #8B5CF6',
    ];
    const index: number = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Get team member name by ID
  const getTeamMemberName = (teamMemberId: string): string => {
    const member = availableTeamMembers.find((m) => m.id === teamMemberId);
    return member ? `${member.first_name} ${member.last_name}` : '';
  };

  // Get category color - first check appointment, then look up from services
  const getCategoryColor = (appointment: EditingAppointment): string => {
    // If appointment already has a color, use it
    if (appointment.categoryColor) {
      return appointment.categoryColor;
    }

    // Look up from loaded services
    const services = availableServices.get(appointment.teamMemberId);
    if (services) {
      const service = services.find((s) => s.id === appointment.serviceId);
      if (service?.service_categories?.color) {
        return service.service_categories.color;
      }
    }

    // Fallback to purple
    return '#8B5CF6';
  };

  // Sort appointments by start time
  const sortedAppointments: [string, EditingAppointment][] = Array.from(
    editingAppointments.entries()
  ).sort(([, a], [, b]) => {
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });

  // Get available status options based on current status and booking time
  const getAvailableStatusOptions = (): BookingStatus[] => {
    // If already cancelled, no changes allowed
    if (bookingStatus === 'cancelled') {
      return ['cancelled'];
    }

    // If already completed, no changes allowed
    if (bookingStatus === 'completed') {
      return ['completed'];
    }

    // Base options (excluding 'completed' - that's set via checkout only)
    const options: BookingStatus[] = ['confirmed', 'cancelled'];

    // Only show 'no_show' if current time has passed the booking time
    const now = new Date();
    const bookingDateTime = new Date(
      `${booking.booking_date}T${
        booking.appointments[0]?.start_time || '00:00:00'
      }`
    );

    if (now > bookingDateTime) {
      options.push('no_show');
    }

    return options;
  };

  const statusOptions = getAvailableStatusOptions();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg lg:text-xl font-bold truncate">
                {formatDate(booking.booking_date)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-white/80 text-xs lg:text-sm mt-0.5">
              <span>
                {formatTime(booking.appointments[0]?.start_time ?? '00:00')}
              </span>
              <span>•</span>
              <span>
                {editingAppointments.size} service
                {editingAppointments.size > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {/* Status Dropdown */}
            <div className="relative">
              {statusOptions.length > 1 ? (
                // Editable status - show dropdown
                <button
                  onClick={onToggleStatusDropdown}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-white/30 hover:bg-white/10 transition-colors text-sm ${
                    showStatusDropdown ? 'bg-white/10' : ''
                  }`}
                >
                  <span className="font-medium capitalize">
                    {getStatusLabel(bookingStatus)}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      showStatusDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              ) : (
                // Locked status (cancelled/completed) - no dropdown
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-white/30 text-sm opacity-80">
                  <span className="font-medium capitalize">
                    {getStatusLabel(bookingStatus)}
                  </span>
                </div>
              )}

              {showStatusDropdown && statusOptions.length > 1 && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={onToggleStatusDropdown}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[160px]">
                    {statusOptions.map((status: BookingStatus) => (
                      <button
                        key={status}
                        onClick={() => {
                          onStatusChange(status);
                          onToggleStatusDropdown();
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                          bookingStatus === status
                            ? 'text-purple-600 font-medium'
                            : 'text-gray-700'
                        }`}
                      >
                        <span className="capitalize">
                          {getStatusLabel(status)}
                        </span>
                        {bookingStatus === status && (
                          <Check className="w-4 h-4 text-purple-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* More Menu */}
            <div className="relative">
              <button
                onClick={onToggleMoreMenu}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={onToggleMoreMenu}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[180px]">
                    {/* ✅ NEW: Rebook button */}
                    <button
                      onClick={() => {
                        onToggleMoreMenu();
                        onRebook();
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm flex items-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Rebook
                    </button>
                    <button
                      onClick={() => {
                        onToggleMoreMenu();
                        onToggleEdit();
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      Edit all services
                    </button>
                    <button
                      onClick={() => {
                        onToggleMoreMenu();
                        onDeleteBooking();
                      }}
                      className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 text-sm"
                    >
                      Delete booking
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT SIDEBAR - Client Section */}
        <div className="lg:w-56 xl:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="p-4 lg:p-5">
            {/* Client Display - Horizontal on mobile, vertical on desktop */}
            <div className="flex lg:flex-col items-center lg:items-center gap-4 lg:gap-0 lg:text-center">
              {/* Client Avatar */}
              <div className="flex-shrink-0">
                {getClientPhoto() ? (
                  <div className="relative w-14 h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden">
                    <Image
                      src={getClientPhoto() as string}
                      alt={getClientName()}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center text-white text-xl lg:text-2xl font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${getGradientColors(
                        getClientName()
                      )})`,
                    }}
                  >
                    {getClientInitials()}
                  </div>
                )}
              </div>

              {/* Client Info */}
              <div className="flex-1 lg:flex-none lg:mt-3">
                <div className="font-semibold text-gray-900 lg:text-lg">
                  {getClientName()}
                </div>
                {getClientEmail() && (
                  <div className="text-xs lg:text-sm text-gray-500 truncate max-w-[180px]">
                    {getClientEmail()}
                  </div>
                )}
              </div>

              {/* Contact Actions */}
              <div className="flex items-center gap-1 lg:gap-2 lg:mt-3">
                {getClientPhone() && (
                  <a
                    href={`tel:${getClientPhone()}`}
                    className="p-2 lg:p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Call"
                  >
                    <Phone className="w-4 h-4 text-gray-600" />
                  </a>
                )}
                {getClientEmail() && (
                  <a
                    href={`mailto:${getClientEmail()}`}
                    className="p-2 lg:p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Email"
                  >
                    <Mail className="w-4 h-4 text-gray-600" />
                  </a>
                )}
                <button
                  className="p-2 lg:p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Message"
                >
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* =====================================================
                CLIENT TYPE SECTION
                ===================================================== */}
            <div className="mt-5 pt-5 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client Type
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (allowEdit && !isSavingClientType) {
                      setShowClientTypeDropdown(!showClientTypeDropdown);
                    }
                  }}
                  disabled={isSavingClientType || !allowEdit}
                  className={`
                    w-full px-4 py-2.5 rounded-lg border-2 transition-all text-left font-semibold
                    flex items-center justify-between
                    ${
                      clientType
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-500'
                    }
                    ${
                      isSavingClientType || !allowEdit
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:border-purple-400'
                    }
                  `}
                >
                  <span>{clientType ?? 'Select type'}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      showClientTypeDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {showClientTypeDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowClientTypeDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1">
                      {(['A', 'B', 'B+', 'C'] as ClientType[]).map(
                        (type: ClientType) => (
                          <button
                            key={type}
                            onClick={() => {
                              void handleClientTypeChange(type);
                              setShowClientTypeDropdown(false);
                            }}
                            className={`
                            w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between
                            ${
                              clientType === type
                                ? 'text-purple-600 font-semibold bg-purple-50'
                                : 'text-gray-700'
                            }
                          `}
                          >
                            <span className="font-bold">{type}</span>
                            {clientType === type && (
                              <Check className="w-4 h-4 text-purple-600" />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </>
                )}
              </div>
              {isSavingClientType && (
                <p className="text-xs text-purple-600 mt-2 animate-pulse">
                  Saving...
                </p>
              )}
            </div>

            {/* Notes Section - Hidden on mobile, visible on lg+ */}
            {bookingNotes && (
              <div className="hidden lg:block mt-5 pt-5 border-t border-gray-200">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">
                  Booking notes
                </label>
                <p className="text-sm text-gray-700">{bookingNotes}</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT MAIN AREA - Services Section */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            {/* Services Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg lg:text-xl font-bold text-gray-900">
                Services
              </h3>
              <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                {editingAppointments.size}
              </span>
            </div>

            {/* Appointments List */}
            <div className="space-y-3">
              {sortedAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No services added</p>
                  <p className="text-xs mt-1">
                    Add a service or product to continue
                  </p>
                </div>
              ) : (
                sortedAppointments.map(
                  ([appointmentId, appointment]: [
                    string,
                    EditingAppointment
                  ]) => {
                    const isPendingAddition: boolean =
                      appointmentId.startsWith('pending-');

                    return (
                      <div key={appointmentId} className="relative group">
                        {/* Service Card - Clickable */}
                        <div
                          onClick={() => {
                            if (allowEdit) {
                              onEditAppointment(appointmentId);
                            }
                          }}
                          className={`flex items-center gap-3 p-3 lg:p-4 bg-gray-50 rounded-xl transition-colors ${
                            isPendingAddition
                              ? 'ring-2 ring-green-200 bg-green-50'
                              : ''
                          } ${
                            allowEdit ? 'cursor-pointer hover:bg-gray-100' : ''
                          }`}
                        >
                          {/* Color Bar */}
                          <div
                            className="w-1 self-stretch rounded flex-shrink-0"
                            style={{
                              backgroundColor: getCategoryColor(appointment),
                            }}
                          />

                          {/* Service Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 text-sm lg:text-base truncate">
                                {appointment.serviceName}
                              </p>
                              {isPendingAddition && (
                                <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                  NEW
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                              <span className="flex-shrink-0">
                                {formatTime(appointment.startTime)}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="flex-shrink-0">
                                {appointment.duration}min
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="truncate">
                                {getTeamMemberName(appointment.teamMemberId)}
                              </span>
                            </div>
                          </div>

                          {/* Price & Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <p className="font-semibold text-gray-900">
                              {getPriceDisplay(appointment.price)}
                            </p>

                            {/* Delete button - show on hover or always on mobile */}
                            {allowEdit && (
                              <button
                                onClick={(
                                  e: React.MouseEvent<HTMLButtonElement>
                                ) => {
                                  e.stopPropagation();
                                  handleDeleteClick(appointmentId);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            {allowEdit && (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Delete Confirmation Tooltip */}
                        {deleteConfirmId === appointmentId && (
                          <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 min-w-[220px]">
                            <p className="text-sm text-gray-700 mb-3">
                              Remove this service?
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCancelDelete}
                                className="flex-1 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  void handleConfirmDelete(appointmentId);
                                }}
                                disabled={isDeleting}
                                className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                {isDeleting ? 'Removing...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                )
              )}
            </div>

            {/* Add Service Button */}
            {allowEdit && (
              <button
                onClick={onShowServicePicker}
                className="mt-4 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-purple-600"
              >
                <Plus className="h-5 w-5" />
                Add service
              </button>
            )}

            {/* =====================================================
                PRODUCTS SECTION (Rendered from parent)
                ===================================================== */}
            {productsSection}

            {/* Mobile Notes Section */}
            {bookingNotes && (
              <div className="lg:hidden mt-6 pt-6 border-t border-gray-200">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">
                  Booking notes
                </label>
                <p className="text-sm text-gray-700">{bookingNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Total */}
          <div>
            <p className="text-xs lg:text-sm text-gray-500">Total</p>
            <p className="text-xl lg:text-2xl font-bold text-gray-900">
              {getPriceDisplay(getTotalPrice())}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Save button - hide when completed */}
            {hasUnsavedChanges && !isCompleted && (
              <button
                onClick={() => {
                  void onSave();
                }}
                disabled={isSaving}
                className="px-4 lg:px-5 py-2.5 lg:py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            )}

            {/* Checkout OR View Sale */}
            {isCompleted ? (
              <button
                onClick={onViewSale}
                className="px-5 lg:px-6 py-2.5 lg:py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium text-sm lg:text-base flex items-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                View Sale
              </button>
            ) : (
              <button
                onClick={() => {
                  void onCheckout();
                }}
                disabled={isSaving}
                className="px-5 lg:px-6 py-2.5 lg:py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-medium text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Checkout
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
