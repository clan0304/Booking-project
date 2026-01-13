// components/admin/calendar/appointment/edit-appointment-view-mode.tsx
'use client';

import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  Pencil,
  User,
} from 'lucide-react';
import Image from 'next/image';
import {
  updateBookingClientType,
  updateClientAlertNote,
  updateBookingInternalNotes,
} from '@/app/actions/calendar-appointments';
import { checkClientIsNew } from '@/app/actions/client-profile';
import type { ClientType } from '@/lib/client-type-helpers';
import type {
  ViewModeProps,
  EditingAppointment,
  BookingStatus,
} from './edit-appointment-types';
import type { BookingGroupWithAppointments } from '@/types/calendar';
import { ClientProfileView } from './sections/client-profile-view';

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
  internalNotes,
  clientAlertNote,
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
  onInternalNotesChange,
  onClientAlertChange,
  onSelectBooking,

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
  const isCancelled: boolean = booking.status === 'cancelled';
  const isNoShow: boolean = booking.status === 'no_show';

  // Read-only mode for terminal states (completed, cancelled, no_show)
  const isReadOnly: boolean = isCompleted || isCancelled || isNoShow;

  // Can edit only if allowEdit is true AND not in a terminal state
  const canEdit: boolean = allowEdit && !isReadOnly;

  // =====================================================
  // CLIENT TYPE STATE
  // =====================================================
  const [clientType, setClientType] = useState<ClientType | null>(
    bookingWithType.client_type ?? null
  );
  const [isSavingClientType, setIsSavingClientType] = useState<boolean>(false);
  const [showClientTypeDropdown, setShowClientTypeDropdown] =
    useState<boolean>(false);

  // =====================================================
  // CLIENT ALERT STATE
  // =====================================================
  const [localAlertNote, setLocalAlertNote] = useState<string>(
    clientAlertNote || ''
  );
  const [isEditingAlert, setIsEditingAlert] = useState<boolean>(false);
  const [isSavingAlert, setIsSavingAlert] = useState<boolean>(false);
  const [showDeleteAlertConfirm, setShowDeleteAlertConfirm] =
    useState<boolean>(false);

  // =====================================================
  // INTERNAL NOTES STATE
  // =====================================================
  const [localInternalNotes, setLocalInternalNotes] = useState<string>(
    internalNotes || ''
  );
  const [isEditingInternalNotes, setIsEditingInternalNotes] =
    useState<boolean>(false);
  const [isSavingInternalNotes, setIsSavingInternalNotes] =
    useState<boolean>(false);

  // =====================================================
  // CLIENT PROFILE VIEW STATE
  // =====================================================
  const [showClientProfile, setShowClientProfile] = useState<boolean>(false);
  const [isNewClient, setIsNewClient] = useState<boolean>(false);

  // Check if client is new (no completed or no_show appointments)
  useEffect(() => {
    const checkIfNewClient = async () => {
      if (!booking.client_id) {
        setIsNewClient(false);
        return;
      }

      try {
        const result = await checkClientIsNew(booking.client_id);
        if (result.success) {
          setIsNewClient(result.isNew ?? false);
        }
      } catch (error) {
        console.error('Error checking if client is new:', error);
      }
    };

    checkIfNewClient();
  }, [booking.client_id]);

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

  // Handle client alert save
  const handleSaveAlertNote = async (): Promise<void> => {
    if (!booking.client_id) return;

    setIsSavingAlert(true);
    try {
      const noteToSave = localAlertNote.trim() || null;
      const result = await updateClientAlertNote(booking.client_id, noteToSave);
      if (result.success) {
        setIsEditingAlert(false);
        // Notify parent of the change
        if (onClientAlertChange) {
          onClientAlertChange(noteToSave);
        }
      } else {
        console.error('Failed to save alert note:', result.error);
      }
    } catch (error) {
      console.error('Error saving alert note:', error);
    } finally {
      setIsSavingAlert(false);
    }
  };

  // Handle client alert delete
  const handleDeleteAlertNote = async (): Promise<void> => {
    if (!booking.client_id) return;

    setIsSavingAlert(true);
    try {
      const result = await updateClientAlertNote(booking.client_id, null);
      if (result.success) {
        setLocalAlertNote('');
        setShowDeleteAlertConfirm(false);
        // Notify parent of the change
        if (onClientAlertChange) {
          onClientAlertChange(null);
        }
      } else {
        console.error('Failed to delete alert note:', result.error);
      }
    } catch (error) {
      console.error('Error deleting alert note:', error);
    } finally {
      setIsSavingAlert(false);
    }
  };

  // Handle internal notes save
  const handleSaveInternalNotes = async (): Promise<void> => {
    setIsSavingInternalNotes(true);
    try {
      const noteToSave = localInternalNotes.trim() || null;
      const result = await updateBookingInternalNotes(booking.id, noteToSave);
      if (result.success) {
        setIsEditingInternalNotes(false);
        // Notify parent of the change
        if (onInternalNotesChange) {
          onInternalNotesChange(noteToSave || '');
        }
      } else {
        console.error('Failed to save internal notes:', result.error);
      }
    } catch (error) {
      console.error('Error saving internal notes:', error);
    } finally {
      setIsSavingInternalNotes(false);
    }
  };

  // Handle internal notes delete
  const handleDeleteInternalNotes = async (): Promise<void> => {
    setIsSavingInternalNotes(true);
    try {
      const result = await updateBookingInternalNotes(booking.id, null);
      if (result.success) {
        setLocalInternalNotes('');
        setIsEditingInternalNotes(false);
        // Notify parent of the change
        if (onInternalNotesChange) {
          onInternalNotesChange('');
        }
      } else {
        console.error('Failed to delete internal notes:', result.error);
      }
    } catch (error) {
      console.error('Error deleting internal notes:', error);
    } finally {
      setIsSavingInternalNotes(false);
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
                    {/* Rebook button */}
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
        <div className="lg:w-56 xl:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 flex-shrink-0 lg:overflow-y-auto">
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

              {/* Contact Actions - Hidden on desktop when we have the new layout */}
              <div className="flex items-center gap-1 lg:hidden">
                {getClientPhone() && (
                  <a
                    href={`tel:${getClientPhone()}`}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Call"
                  >
                    <Phone className="w-4 h-4 text-gray-600" />
                  </a>
                )}
                {getClientEmail() && (
                  <a
                    href={`mailto:${getClientEmail()}`}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Email"
                  >
                    <Mail className="w-4 h-4 text-gray-600" />
                  </a>
                )}
                <button
                  className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Message"
                >
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* New Client Badge - Desktop (centered) */}
              {isNewClient && booking.client_id && (
                <div className="hidden lg:flex w-full justify-center mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                    New
                  </span>
                </div>
              )}

              {/* Actions & View Profile Buttons (Desktop - Fresha-style, stacked vertically) */}
              {booking.client_id && (
                <div className="hidden lg:flex flex-col w-full gap-2 mt-3">
                  {/* Actions Dropdown */}
                  <button className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 flex items-center justify-center gap-2">
                    Actions
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {/* View Profile */}
                  <button
                    onClick={() => setShowClientProfile(true)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 flex items-center justify-center"
                  >
                    View profile
                  </button>
                </div>
              )}
            </div>

            {/* Mobile: New Badge + View Profile Button */}
            {booking.client_id && (
              <div className="lg:hidden mt-3">
                {/* New Client Badge - Mobile */}
                {isNewClient && (
                  <div className="flex justify-center mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                      New
                    </span>
                  </div>
                )}
                {/* View Profile Button - Mobile */}
                <button
                  onClick={() => setShowClientProfile(true)}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4" />
                  View profile
                </button>
              </div>
            )}

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
                    if (canEdit && !isSavingClientType) {
                      setShowClientTypeDropdown(!showClientTypeDropdown);
                    }
                  }}
                  disabled={isSavingClientType || !canEdit}
                  className={`
                    w-full px-4 py-2.5 rounded-lg border-2 transition-all text-left font-semibold
                    flex items-center justify-between
                    ${
                      clientType
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-500'
                    }
                    ${
                      isSavingClientType || !canEdit
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

            {/* =====================================================
                CLIENT ALERT NOTE - EDITABLE (Left Sidebar)
                ===================================================== */}
            {booking.client_id && (
              <div className="hidden lg:block mt-5 pt-5 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Client Alert
                  </label>
                  {!isEditingAlert && canEdit && localAlertNote && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setIsEditingAlert(true)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                        title="Edit alert"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteAlertConfirm(true);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        title="Delete alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditingAlert ? (
                  // Edit mode
                  <div className="space-y-2">
                    <textarea
                      value={localAlertNote}
                      onChange={(e) => setLocalAlertNote(e.target.value)}
                      placeholder="Add alert about this client..."
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setLocalAlertNote(clientAlertNote || '');
                          setIsEditingAlert(false);
                        }}
                        disabled={isSavingAlert}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void handleSaveAlertNote()}
                        disabled={isSavingAlert}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                      >
                        {isSavingAlert ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : localAlertNote ? (
                  // Display mode with content - 4 lines truncated, hover popup for full
                  <div className="relative group">
                    <div
                      onClick={() => canEdit && setIsEditingAlert(true)}
                      className={`p-3 bg-amber-50 border border-amber-200 rounded-lg ${
                        canEdit ? 'cursor-pointer hover:bg-amber-100' : ''
                      }`}
                    >
                      <p className="text-sm text-amber-700 line-clamp-4">
                        {localAlertNote}
                      </p>
                    </div>
                    {/* Hover popup for full content - hide when delete confirm is open */}
                    {localAlertNote && !showDeleteAlertConfirm && (
                      <div className="absolute left-0 right-0 bottom-full mb-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-h-60 overflow-y-auto">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                              Client Alert
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {localAlertNote}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Delete Confirmation Modal */}
                    {showDeleteAlertConfirm && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowDeleteAlertConfirm(false)}
                        />
                        <div className="absolute left-0 right-0 bottom-full mb-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4">
                          <p className="text-sm text-gray-700 mb-3">
                            Delete this client alert?
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowDeleteAlertConfirm(false)}
                              disabled={isSavingAlert}
                              className="flex-1 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => void handleDeleteAlertNote()}
                              disabled={isSavingAlert}
                              className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              {isSavingAlert ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  // No alert - show add button
                  canEdit && (
                    <button
                      onClick={() => setIsEditingAlert(true)}
                      className="w-full px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      + Add client alert
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT MAIN AREA - Services Section OR Client Profile */}
        {showClientProfile && booking.client_id ? (
          // Client Profile View (Fresha-style)
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <ClientProfileView
              clientId={booking.client_id}
              clientName={getClientName()}
              clientInitials={getClientInitials()}
              clientPhoto={getClientPhoto()}
              clientEmail={getClientEmail()}
              clientPhone={getClientPhone()}
              onBack={() => setShowClientProfile(false)}
              onSelectBooking={(bookingId) => {
                setShowClientProfile(false);
                onSelectBooking?.(bookingId);
              }}
            />
          </div>
        ) : (
          // Default Services View
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
                              if (canEdit) {
                                onEditAppointment(appointmentId);
                              }
                            }}
                            className={`flex items-center gap-3 p-3 lg:p-4 bg-gray-50 rounded-xl transition-colors ${
                              isPendingAddition
                                ? 'ring-2 ring-green-200 bg-green-50'
                                : ''
                            } ${
                              canEdit ? 'cursor-pointer hover:bg-gray-100' : ''
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
                              {canEdit && (
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

                              {canEdit && (
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
              {canEdit && (
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

              {/* =====================================================
                  NOTES SECTION - RIGHT SIDE (Booking-level notes)
                  ===================================================== */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Notes
                </h4>

                <div className="space-y-4">
                  {/* Client Note - Read-only if from online booking */}
                  {booking.booking_source === 'online' && bookingNotes && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Client note (from online booking)
                      </label>
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-sm text-gray-700 italic">
                          &ldquo;{bookingNotes}&rdquo;
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Internal Notes - View mode with Edit/Delete buttons */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-gray-500">
                        Internal notes
                        {isSavingInternalNotes && (
                          <span className="ml-2 text-purple-600 animate-pulse">
                            Saving...
                          </span>
                        )}
                      </label>
                      {!isEditingInternalNotes &&
                        canEdit &&
                        localInternalNotes && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setIsEditingInternalNotes(true)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                              title="Edit notes"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => void handleDeleteInternalNotes()}
                              disabled={isSavingInternalNotes}
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                              title="Delete notes"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                    </div>

                    {isEditingInternalNotes ? (
                      // Edit mode
                      <div className="space-y-2">
                        <textarea
                          value={localInternalNotes}
                          onChange={(e) =>
                            setLocalInternalNotes(e.target.value)
                          }
                          placeholder="Staff only - add notes about this booking..."
                          rows={3}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setLocalInternalNotes(internalNotes || '');
                              setIsEditingInternalNotes(false);
                            }}
                            disabled={isSavingInternalNotes}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void handleSaveInternalNotes()}
                            disabled={isSavingInternalNotes}
                            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            {isSavingInternalNotes ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : localInternalNotes ? (
                      // Display mode with content - 4 lines truncated, hover popup for full
                      <div className="relative group">
                        <div
                          onClick={() =>
                            canEdit && setIsEditingInternalNotes(true)
                          }
                          className={`p-3 bg-gray-50 border border-gray-200 rounded-lg ${
                            canEdit ? 'cursor-pointer hover:bg-gray-100' : ''
                          }`}
                        >
                          <p className="text-sm text-gray-700 line-clamp-4">
                            {localInternalNotes}
                          </p>
                        </div>
                        {/* Hover popup for full content */}
                        {localInternalNotes && (
                          <div className="absolute left-0 right-0 bottom-full mb-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-h-60 overflow-y-auto">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  Internal Notes
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {localInternalNotes}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // No notes - show add button
                      canEdit && (
                        <button
                          onClick={() => setIsEditingInternalNotes(true)}
                          className="w-full px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          + Add internal notes
                        </button>
                      )
                    )}
                  </div>

                  {/* Mobile Client Alert - Only visible on mobile */}
                  {booking.client_id && (
                    <div className="lg:hidden">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Client Alert
                        </label>
                        {!isEditingAlert && canEdit && localAlertNote && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setIsEditingAlert(true)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                              title="Edit alert"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteAlertConfirm(true);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                              title="Delete alert"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditingAlert ? (
                        <div className="space-y-2">
                          <textarea
                            value={localAlertNote}
                            onChange={(e) => setLocalAlertNote(e.target.value)}
                            placeholder="Add alert about this client..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setLocalAlertNote(clientAlertNote || '');
                                setIsEditingAlert(false);
                              }}
                              disabled={isSavingAlert}
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => void handleSaveAlertNote()}
                              disabled={isSavingAlert}
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                            >
                              {isSavingAlert ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : localAlertNote ? (
                        <div className="relative group">
                          <div
                            onClick={() => canEdit && setIsEditingAlert(true)}
                            className={`p-3 bg-amber-50 border border-amber-200 rounded-lg ${
                              canEdit ? 'cursor-pointer' : ''
                            }`}
                          >
                            <p className="text-sm text-amber-700 line-clamp-4">
                              {localAlertNote}
                            </p>
                          </div>
                          {/* Hover popup for full content - hide when delete confirm is open */}
                          {localAlertNote && !showDeleteAlertConfirm && (
                            <div className="absolute left-0 right-0 bottom-full mb-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                              <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-h-60 overflow-y-auto">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                  <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                                    Client Alert
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {localAlertNote}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Delete Confirmation Modal */}
                          {showDeleteAlertConfirm && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowDeleteAlertConfirm(false)}
                              />
                              <div className="absolute left-0 right-0 bottom-full mb-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4">
                                <p className="text-sm text-gray-700 mb-3">
                                  Delete this client alert?
                                </p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      setShowDeleteAlertConfirm(false)
                                    }
                                    disabled={isSavingAlert}
                                    className="flex-1 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => void handleDeleteAlertNote()}
                                    disabled={isSavingAlert}
                                    className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {isSavingAlert ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        canEdit && (
                          <button
                            onClick={() => setIsEditingAlert(true)}
                            className="w-full px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            + Add client alert
                          </button>
                        )
                      )}
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

                {/* Action Buttons - Hidden for cancelled/no_show */}
                {bookingStatus === 'cancelled' ||
                bookingStatus === 'no_show' ? (
                  <div className="text-sm text-gray-500 italic">
                    {bookingStatus === 'cancelled'
                      ? 'Booking cancelled'
                      : 'Client did not show'}
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
