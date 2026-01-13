'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Heart,
  Plus,
  X,
  Phone,
  Mail,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import Image from 'next/image';
import type { EditModeProps } from './edit-appointment-types';

export function EditMode({
  booking,
  editingAppointments,
  expandedAppointmentId,
  availableTeamMembers,
  teamMembersLoading,

  showTeamMemberDropdown,
  showTimeDropdown,
  showDurationDropdown,
  bookingNotes,
  internalNotes,
  clientAlertNote,
  isSubmitting,
  isDeleting,
  onToggleAppointment,
  onUpdateAppointmentField,
  onTeamMemberChange,
  onDeleteAppointment,
  onSaveAll,
  onDeleteBooking,
  onShowServicePicker,
  onBack,
  onClose,
  setShowTeamMemberDropdown,
  setShowTimeDropdown,
  setShowDurationDropdown,
  setInternalNotes,
  getTeamMember,
  getService,
  formatTime,
  getDurationDisplay,
  generateTimeSlots,
  generateDurationOptions,
}: EditModeProps) {
  // Get client info helpers
  const getClientName = (): string => {
    if (booking.client) {
      return `${booking.client.first_name} ${
        booking.client.last_name || ''
      }`.trim();
    }
    if (booking.guest_first_name) {
      return `${booking.guest_first_name} ${
        booking.guest_last_name || ''
      }`.trim();
    }
    return 'Walk-in';
  };

  const getClientInitials = (): string => {
    if (booking.client) {
      return `${booking.client.first_name[0]}${
        booking.client.last_name?.[0] || ''
      }`;
    }
    if (booking.guest_first_name) {
      return `${booking.guest_first_name[0]}${
        booking.guest_last_name?.[0] || ''
      }`;
    }
    return 'W';
  };

  const getClientPhoto = () => {
    return booking.client?.photo_url || null;
  };

  const getClientEmail = () => {
    return booking.client?.email || null;
  };

  const getClientPhone = () => {
    return booking.client?.phone_number || null;
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 border-b border-gray-200 bg-white">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Edit Booking</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT SIDEBAR - Client Section (collapsible on mobile) */}
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

              {/* Contact Actions - Always visible */}
              <div className="flex items-center gap-1 lg:gap-2 lg:mt-3">
                {getClientPhone() && (
                  <button
                    className="p-2 lg:p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Call"
                  >
                    <Phone className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                {getClientEmail() && (
                  <button
                    className="p-2 lg:p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Email"
                  >
                    <Mail className="w-4 h-4 text-gray-600" />
                  </button>
                )}
                <button
                  className="p-2 lg:p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Message"
                >
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Client Alert Note - LEFT SIDEBAR (client-level warning) */}
            {clientAlertNote && (
              <div className="hidden lg:block mt-5 pt-5 border-t border-gray-200">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                        Client Alert
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        {clientAlertNote}
                      </p>
                    </div>
                  </div>
                </div>
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
              {Array.from(editingAppointments.entries())
                .sort(([, a], [, b]) => {
                  // Sort by start time (earlier first)
                  const timeToMinutes = (time: string) => {
                    const [hours, minutes] = time.split(':').map(Number);
                    return hours * 60 + minutes;
                  };
                  return (
                    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
                  );
                })
                .map(([appointmentId, appointment]) => {
                  const isExpanded = expandedAppointmentId === appointmentId;
                  const teamMember = getTeamMember(appointment.teamMemberId);
                  const service = getService(
                    appointment.teamMemberId,
                    appointment.serviceId
                  );
                  const categoryColor =
                    appointment.categoryColor ||
                    service?.service_categories?.color ||
                    '#A855F7';

                  const isPendingAddition =
                    appointmentId.startsWith('pending-');

                  return (
                    <div
                      key={appointmentId}
                      className={`bg-white rounded-lg border overflow-hidden ${
                        isPendingAddition
                          ? 'border-green-300 ring-2 ring-green-100'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Collapsed View - Improved single-line layout */}
                      <button
                        onClick={() => onToggleAppointment(appointmentId)}
                        className={`w-full p-3 lg:p-4 flex items-center gap-3 transition-colors ${
                          isPendingAddition
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Color Bar */}
                        <div
                          className="w-1 self-stretch rounded flex-shrink-0"
                          style={{ backgroundColor: categoryColor }}
                        />

                        {/* Service Info - Flexible */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {appointment.serviceName}
                            </h4>
                            {isPendingAddition && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                NEW
                              </span>
                            )}
                          </div>
                          {/* Details on single line */}
                          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
                            <span className="flex-shrink-0">
                              {formatTime(appointment.startTime)}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="flex-shrink-0">
                              {getDurationDisplay(appointment.duration)}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="truncate">
                              {teamMember?.first_name} {teamMember?.last_name}
                            </span>
                          </div>
                        </div>

                        {/* Price - Fixed width */}
                        <div className="flex-shrink-0 text-right">
                          <p className="font-semibold text-gray-900">
                            A$ {appointment.price.toFixed(0)}
                          </p>
                        </div>

                        {/* Chevron */}
                        <ChevronRight
                          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                      </button>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-4">
                          {/* Service Selection */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                              Service
                            </label>
                            <button
                              onClick={() =>
                                onShowServicePicker(appointment.id)
                              }
                              className="w-full p-3 border-l-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
                              style={{ borderLeftColor: categoryColor }}
                            >
                              <span className="font-medium text-gray-900">
                                {appointment.serviceName},{' '}
                                {appointment.duration}min
                              </span>
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </button>
                          </div>

                          {/* Team Member */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                              Team member
                            </label>
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                              </div>

                              <div className="flex-1 relative">
                                {teamMembersLoading ? (
                                  <div className="w-full px-4 py-3 bg-white rounded-lg border border-gray-200">
                                    <span className="text-gray-500">
                                      Loading...
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() =>
                                        setShowTeamMemberDropdown(
                                          showTeamMemberDropdown ===
                                            appointment.id
                                            ? null
                                            : appointment.id
                                        )
                                      }
                                      className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                                    >
                                      {teamMember?.photo_url ? (
                                        <Image
                                          src={teamMember.photo_url}
                                          alt={teamMember.first_name}
                                          width={32}
                                          height={32}
                                          className="rounded-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                          <span className="text-sm font-medium text-purple-600">
                                            {teamMember?.first_name[0]}
                                          </span>
                                        </div>
                                      )}
                                      <span className="flex-1 text-left font-medium text-gray-900">
                                        {teamMember?.first_name}{' '}
                                        {teamMember?.last_name}
                                      </span>
                                      <ChevronDown className="h-5 w-5 text-gray-400" />
                                    </button>

                                    {showTeamMemberDropdown ===
                                      appointment.id && (
                                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                                        {availableTeamMembers.map((member) => (
                                          <button
                                            key={member.id}
                                            onClick={() =>
                                              onTeamMemberChange(
                                                appointment.id,
                                                member.id
                                              )
                                            }
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                                          >
                                            {member.photo_url ? (
                                              <Image
                                                src={member.photo_url}
                                                alt={member.first_name}
                                                width={32}
                                                height={32}
                                                className="rounded-full object-cover"
                                              />
                                            ) : (
                                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                                <span className="text-sm font-medium text-purple-600">
                                                  {member.first_name[0]}
                                                </span>
                                              </div>
                                            )}
                                            <span className="flex-1 text-left font-medium text-gray-900">
                                              {member.first_name}{' '}
                                              {member.last_name}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Start Time & Duration - Side by side */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Start Time */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Start time
                              </label>
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setShowTimeDropdown(
                                      showTimeDropdown === appointmentId
                                        ? null
                                        : appointmentId
                                    )
                                  }
                                  className="w-full px-4 py-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                >
                                  <span className="font-medium text-gray-900">
                                    {formatTime(appointment.startTime)}
                                  </span>
                                  <ChevronDown className="h-5 w-5 text-gray-400" />
                                </button>

                                {showTimeDropdown === appointmentId && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                                    {generateTimeSlots().map((time) => (
                                      <button
                                        key={time}
                                        onClick={() => {
                                          onUpdateAppointmentField(
                                            appointmentId,
                                            'startTime',
                                            time
                                          );
                                          setShowTimeDropdown(null);
                                        }}
                                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                                          time === appointment.startTime
                                            ? 'bg-purple-50 text-purple-600'
                                            : 'text-gray-900'
                                        }`}
                                      >
                                        {formatTime(time)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Duration */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Duration
                              </label>
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setShowDurationDropdown(
                                      showDurationDropdown === appointmentId
                                        ? null
                                        : appointmentId
                                    )
                                  }
                                  className="w-full px-4 py-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                >
                                  <span className="font-medium text-gray-900">
                                    {getDurationDisplay(appointment.duration)}
                                  </span>
                                  <ChevronDown className="h-5 w-5 text-gray-400" />
                                </button>

                                {showDurationDropdown === appointmentId && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                                    {generateDurationOptions().map(
                                      (duration) => (
                                        <button
                                          key={duration}
                                          onClick={() => {
                                            onUpdateAppointmentField(
                                              appointmentId,
                                              'duration',
                                              duration
                                            );
                                            setShowDurationDropdown(null);
                                          }}
                                          className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                                            duration === appointment.duration
                                              ? 'bg-purple-50 text-purple-600'
                                              : 'text-gray-900'
                                          }`}
                                        >
                                          {getDurationDisplay(duration)}
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Delete Service Button */}
                          <button
                            onClick={() => onDeleteAppointment(appointment.id)}
                            disabled={editingAppointments.size <= 1}
                            className="w-full px-4 py-3 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove service
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Add Service Button */}
            <button
              onClick={() => {
                const firstAppointment = Array.from(
                  editingAppointments.values()
                )[0];
                if (firstAppointment) {
                  onShowServicePicker('add-new');
                }
              }}
              disabled={editingAppointments.size === 0}
              className="mt-4 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-5 w-5" />
              Add service
            </button>

            {/* Notes Section - RIGHT SIDE (booking-level notes) */}
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Notes
              </h4>

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

              {/* Internal Notes - Editable by staff */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Internal notes
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Staff only - add notes about this booking..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Mobile Client Alert - Only visible on mobile (since left sidebar is collapsed) */}
            {clientAlertNote && (
              <div className="lg:hidden mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                      Client Alert
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      {clientAlertNote}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Delete Booking */}
          <button
            onClick={onDeleteBooking}
            disabled={isDeleting}
            className="px-3 lg:px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors text-sm lg:text-base"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Delete booking</span>
              </>
            )}
          </button>

          {/* Save Button */}
          <button
            onClick={onSaveAll}
            disabled={isSubmitting}
            className="px-5 lg:px-6 py-2.5 lg:py-3 bg-black text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm lg:text-base"
          >
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
