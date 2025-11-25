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
  setBookingNotes,
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
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
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

      {/* Main Content - Two Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - Client Section */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-6 flex-1">
            {/* Client Display */}
            <div className="text-center">
              {/* Client Avatar */}
              <div className="flex justify-center mb-3">
                {getClientPhoto() ? (
                  <div className="relative w-20 h-20 rounded-full overflow-hidden">
                    <Image
                      src={getClientPhoto()!}
                      alt={getClientName()}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
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
              <div className="font-semibold text-gray-900 text-lg mb-1">
                {getClientName()}
              </div>

              {/* Client Email */}
              {getClientEmail() && (
                <div className="text-sm text-gray-500 mb-4">
                  {getClientEmail()}
                </div>
              )}

              {/* Contact Actions */}
              <div className="flex items-center justify-center gap-2 mt-4">
                {getClientPhone() && (
                  <button
                    className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Call"
                  >
                    <Phone className="w-5 h-5 text-gray-600" />
                  </button>
                )}
                {getClientEmail() && (
                  <button
                    className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Email"
                  >
                    <Mail className="w-5 h-5 text-gray-600" />
                  </button>
                )}
                <button
                  className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Message"
                >
                  <MessageSquare className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Client Details */}
            {getClientPhone() && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                  Phone
                </div>
                <div className="text-sm text-gray-900">{getClientPhone()}</div>
              </div>
            )}

            {/* Notes Section in Sidebar */}
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
                  Booking notes
                </label>
                <textarea
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="Client visible..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
                  Internal notes
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Staff only..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT MAIN AREA - Services Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Services Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Services</h3>
              <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                {editingAppointments.size}
              </span>
            </div>

            {/* Appointments List */}
            <div className="space-y-3">
              {Array.from(editingAppointments.entries()).map(
                ([appointmentId, appointment]) => {
                  const isExpanded = expandedAppointmentId === appointmentId;
                  const teamMember = getTeamMember(appointment.teamMemberId);
                  const service = getService(
                    appointment.teamMemberId,
                    appointment.serviceId
                  );
                  // Use appointment's stored category color, fallback to service color, then purple
                  const categoryColor =
                    appointment.categoryColor ||
                    service?.service_categories?.color ||
                    '#A855F7';

                  return (
                    <div
                      key={appointmentId}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                    >
                      {/* Collapsed View */}
                      <button
                        onClick={() => onToggleAppointment(appointmentId)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="w-1 h-12 rounded"
                            style={{ backgroundColor: categoryColor }}
                          />
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-gray-900">
                              {appointment.serviceName}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                              <span>{formatTime(appointment.startTime)}</span>
                              <span>•</span>
                              <span>
                                {getDurationDisplay(appointment.duration)}
                              </span>
                              <span>•</span>
                              <span>
                                {teamMember?.first_name} {teamMember?.last_name}
                              </span>
                            </div>
                          </div>
                          <div className="text-right mr-2">
                            <p className="font-medium text-gray-900">
                              A$ {appointment.price.toFixed(0)}
                            </p>
                          </div>
                          <ChevronRight
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
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

                          {/* Start Time & Duration */}
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
                }
              )}
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
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Delete Booking */}
          <button
            onClick={onDeleteBooking}
            disabled={isDeleting}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
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
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
