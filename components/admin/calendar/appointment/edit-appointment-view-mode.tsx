// components/admin/calendar/appointment/edit-appointment-view-mode.tsx
'use client';

import { useState } from 'react';
import {
  ChevronDown,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  Check,
  Pencil,
  Phone,
  Mail,
  MessageSquare,
  X,
} from 'lucide-react';
import Image from 'next/image';
import type { ViewModeProps } from './edit-appointment-types';

export function ViewMode({
  booking,
  editingAppointments,

  bookingStatus,
  showStatusDropdown,
  showMoreMenu,
  bookingNotes,
  allowEdit,
  onStatusChange,
  onToggleStatusDropdown,
  onToggleMoreMenu,
  onCheckout,
  onToggleEdit,
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

  // Client Section Component (reusable for both layouts)
  const ClientSection = () => (
    <div className="p-4 lg:p-6">
      {/* Client Display */}
      <div className="text-center">
        {/* Client Avatar */}
        <div className="flex justify-center mb-3">
          {getClientPhoto() ? (
            <div className="relative w-16 h-16 lg:w-20 lg:h-20 rounded-full overflow-hidden">
              <Image
                src={getClientPhoto()!}
                alt={getClientName()}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center text-white text-xl lg:text-2xl font-semibold"
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

        {/* Client Name */}
        <div className="font-semibold text-gray-900 text-base lg:text-lg mb-1">
          {getClientName()}
        </div>

        {/* Client Email */}
        {getClientEmail() && (
          <div className="text-sm text-gray-500 mb-3">{getClientEmail()}</div>
        )}

        {/* Contact Actions */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {getClientPhone() && (
            <button
              className="p-2.5 lg:p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              title="Call"
            >
              <Phone className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
            </button>
          )}
          {getClientEmail() && (
            <button
              className="p-2.5 lg:p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              title="Email"
            >
              <Mail className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
            </button>
          )}
          <button
            className="p-2.5 lg:p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            title="Message"
          >
            <MessageSquare className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Client Details */}
      {getClientPhone() && (
        <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase mb-2">
            Phone
          </div>
          <div className="text-sm text-gray-900">{getClientPhone()}</div>
        </div>
      )}

      {/* Notes Display */}
      {bookingNotes && (
        <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase mb-2">
            Notes
          </div>
          <div className="text-sm text-gray-700">{bookingNotes}</div>
        </div>
      )}
    </div>
  );

  // Services Section Component (reusable for both layouts)
  const ServicesSection = () => (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      {/* Services Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg lg:text-xl font-bold text-gray-900">Services</h3>
        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
          {editingAppointments.size}
        </span>
      </div>
      {/* Service Cards */}
      <div className="space-y-3">
        {Array.from(editingAppointments.values()).map((appointment) => {
          const originalAppointment = booking.appointments.find(
            (a) => a.id === appointment.id
          );
          const teamMember = originalAppointment?.team_member;
          const categoryColor =
            originalAppointment?.category_color || '#EC4899';

          return (
            <div
              key={appointment.id}
              className="group relative bg-white rounded-lg p-3 lg:p-4 border border-gray-200 border-l-4 hover:bg-gray-50 transition-colors"
              style={{ borderLeftColor: categoryColor }} // CHANGE THIS - use categoryColor variable
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {appointment.serviceName}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1 flex-wrap">
                    <span>{formatTime(appointment.startTime)}</span>
                    <span>•</span>
                    <span>{appointment.duration}min</span>
                    <span>•</span>
                    <span className="truncate">
                      {teamMember?.first_name || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Right side - Price and Hover Icons */}
                <div className="relative flex items-center justify-end w-24 lg:w-28 flex-shrink-0">
                  {/* Price - visible by default, hidden on hover */}
                  <div className="absolute right-0 group-hover:opacity-0 group-hover:invisible transition-all duration-200">
                    <p className="font-medium text-gray-900 text-right whitespace-nowrap">
                      {getPriceDisplay(appointment.price)}
                    </p>
                  </div>

                  {/* Hover Icons - hidden by default, visible on hover */}
                  {allowEdit && (
                    <div className="absolute right-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 flex items-center gap-1">
                      <button
                        onClick={onToggleEdit}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Edit service"
                      >
                        <Pencil className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(appointment.id)}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Delete service"
                      >
                        <Trash2 className="w-4 h-4 lg:w-5 lg:h-5 text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Delete Confirmation Tooltip */}
              {deleteConfirmId === appointment.id && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={handleCancelDelete}
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-64">
                    <div className="absolute -top-2 right-6 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45" />
                    <p className="text-sm text-gray-700 mb-3">
                      Remove this service from the booking?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelDelete}
                        disabled={isDeleting}
                        className="flex-1 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleConfirmDelete(appointment.id)}
                        disabled={isDeleting}
                        className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {isDeleting ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <span>Remove</span>
                        )}
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
          className="mt-4 flex items-center gap-2 px-4 py-2 text-sm lg:text-base text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add service</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Purple Header - Full Width */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl lg:text-2xl font-bold truncate">
                {formatDate(booking.booking_date)}
              </span>
              <ChevronDown className="w-4 h-4 lg:w-5 lg:h-5 mt-0.5 lg:mt-1 opacity-70 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-white/80 text-xs lg:text-sm mt-1">
              <span>
                {formatTime(booking.appointments[0]?.start_time || '00:00')}
              </span>
              <span>•</span>
              <span>Doesn&apos;t repeat</span>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3 ml-2 flex-shrink-0">
            {/* Status Dropdown */}
            <div className="relative">
              <button
                onClick={onToggleStatusDropdown}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full border-2 border-white/30 hover:bg-white/10 transition-colors text-sm lg:text-base ${
                  showStatusDropdown ? 'bg-white/10' : ''
                }`}
              >
                <span className="font-medium">
                  {getStatusLabel(bookingStatus)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </button>

              {showStatusDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={onToggleStatusDropdown}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {(
                      [
                        'confirmed',
                        'pending',
                        'cancelled',
                        'completed',
                        'no_show',
                      ] as const
                    ).map((status) => (
                      <button
                        key={status}
                        onClick={() => onStatusChange(status)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                          status === bookingStatus ? 'font-medium' : ''
                        }`}
                      >
                        <span
                          className={
                            status === bookingStatus
                              ? 'text-purple-600'
                              : 'text-gray-700'
                          }
                        >
                          {getStatusLabel(status)}
                        </span>
                        {status === bookingStatus && (
                          <Check className="w-4 h-4 text-purple-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 lg:p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT SIDEBAR - Client Section (Desktop: side, Mobile: top) */}
        <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 flex-shrink-0">
          <ClientSection />
        </div>

        {/* RIGHT MAIN AREA - Services Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ServicesSection />
        </div>
      </div>

      {/* Footer - Full Width */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Total */}
          <div className="text-sm text-gray-600">
            <span className="text-base lg:text-lg font-semibold text-gray-900">
              {getPriceDisplay(getTotalPrice())}
            </span>
            {' • '}
            {Array.from(editingAppointments.values()).reduce(
              (sum, a) => sum + a.duration,
              0
            )}{' '}
            min
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 lg:gap-3">
            {/* More Options */}
            <div className="relative">
              <button
                onClick={onToggleMoreMenu}
                className="p-2.5 lg:p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MoreVertical className="w-4 h-4 lg:w-5 lg:h-5 text-gray-700" />
              </button>

              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={onToggleMoreMenu}
                  />
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {allowEdit && (
                      <button
                        onClick={() => {
                          onToggleMoreMenu();
                          onToggleEdit();
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit booking</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onToggleMoreMenu();
                        onDeleteBooking();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete booking</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Pay Now */}
            <button className="flex-1 sm:flex-initial px-4 lg:px-6 py-2.5 lg:py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm lg:text-base">
              <span className="font-medium text-gray-900">Pay now</span>
              <span className="text-xs text-gray-500 uppercase">VISA</span>
            </button>

            {/* Checkout */}
            <button
              onClick={onCheckout}
              className="flex-1 sm:flex-initial px-4 lg:px-6 py-2.5 lg:py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm lg:text-base"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
