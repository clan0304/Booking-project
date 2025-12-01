// components/admin/calendar/appointment/edit-appointment-view-mode.tsx
'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import Image from 'next/image';
import type {
  ViewModeProps,
  EditingAppointment,
} from './edit-appointment-types';

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
  onSave,
  onToggleEdit,
  onEditAppointment,
  onDeleteBooking,
  onDeleteAppointment,
  onClose,
  formatDate,
  formatTime,
  getPriceDisplay,
  getClientName,
  getClientInitials,
  getTotalPrice,
  getStatusLabel,
}: ViewModeProps) {
  // State for delete confirmation tooltip
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle delete with confirmation
  const handleDeleteClick = (appointmentId: string) => {
    if (editingAppointments.size <= 1) {
      onDeleteBooking();
    } else {
      setDeleteConfirmId(appointmentId);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async (appointmentId: string) => {
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
  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  // Get client photo
  const getClientPhoto = () => {
    return booking.client?.photo_url || null;
  };

  // Get client email
  const getClientEmail = () => {
    return booking.client?.email || null;
  };

  // Get client phone
  const getClientPhone = () => {
    return booking.client?.phone_number || null;
  };

  // Generate gradient colors for avatar
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
  const sortedAppointments = Array.from(editingAppointments.entries()).sort(
    ([, a], [, b]) => {
      const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    }
  );

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
                {formatTime(booking.appointments[0]?.start_time || '00:00')}
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
              <button
                onClick={onToggleStatusDropdown}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-white/30 hover:bg-white/10 transition-colors text-sm ${
                  showStatusDropdown ? 'bg-white/10' : ''
                }`}
              >
                <span>{getStatusLabel(bookingStatus)}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showStatusDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={onToggleStatusDropdown}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[160px]">
                    {(
                      [
                        'confirmed',
                        'completed',
                        'cancelled',
                        'no_show',
                      ] as const
                    ).map((status) => (
                      <button
                        key={status}
                        onClick={() => onStatusChange(status)}
                        className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-sm"
                      >
                        {bookingStatus === status && (
                          <Check className="w-4 h-4 text-purple-600" />
                        )}
                        <span
                          className={
                            bookingStatus === status ? 'text-purple-600' : ''
                          }
                        >
                          {getStatusLabel(status)}
                        </span>
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
                      src={getClientPhoto()!}
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
              {sortedAppointments.map(([appointmentId, appointment]) => {
                const isPendingAddition = appointmentId.startsWith('pending-');

                return (
                  <div key={appointmentId} className="relative group">
                    {/* Service Card - Clickable */}
                    <div
                      onClick={() =>
                        allowEdit && onEditAppointment(appointmentId)
                      }
                      className={`flex items-center gap-3 p-3 lg:p-4 bg-gray-50 rounded-xl transition-colors ${
                        isPendingAddition
                          ? 'ring-2 ring-green-200 bg-green-50'
                          : ''
                      } ${allowEdit ? 'cursor-pointer hover:bg-gray-100' : ''}`}
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

                      {/* Price */}
                      <div className="flex-shrink-0 text-right">
                        <p className="font-semibold text-gray-900 text-sm lg:text-base">
                          {getPriceDisplay(appointment.price)}
                        </p>
                      </div>

                      {/* Edit Arrow */}
                      {allowEdit && (
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                    </div>

                    {/* Delete Button - On hover */}
                    {allowEdit && editingAppointments.size > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(appointmentId);
                        }}
                        className="absolute -right-2 -top-2 p-1.5 bg-white border border-gray-200 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200"
                        title="Remove service"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                      </button>
                    )}

                    {/* Delete Confirmation Tooltip */}
                    {deleteConfirmId === appointmentId && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={handleCancelDelete}
                        />
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
                              onClick={() => handleConfirmDelete(appointmentId)}
                              disabled={isDeleting}
                              className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              {isDeleting ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Service Button */}
            {allowEdit && (
              <button
                onClick={onToggleEdit}
                className="mt-4 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-purple-600"
              >
                <Plus className="h-5 w-5" />
                Add service
              </button>
            )}

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
            {/* Save changes button */}
            {hasUnsavedChanges && (
              <button
                onClick={onSave}
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

            {/* Checkout button */}
            <button
              onClick={onCheckout}
              disabled={isSaving}
              className="px-5 lg:px-6 py-2.5 lg:py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-medium text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
