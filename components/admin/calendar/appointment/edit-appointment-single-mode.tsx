'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Heart,
  X,
} from 'lucide-react';
import Image from 'next/image';
import type { SingleEditModeProps } from './edit-appointment-types';

export function SingleEditMode({
  appointment,
  appointmentId,
  teamMember,
  availableTeamMembers,
  availableServices,
  teamMembersLoading,
  showTeamMemberDropdown,
  showTimeDropdown,
  showDurationDropdown,

  canDelete,
  onUpdateAppointmentField,
  onTeamMemberChange,
  onDeleteAppointment,
  onShowServicePicker,
  onSave,
  onBack,
  onClose,
  setShowTeamMemberDropdown,
  setShowTimeDropdown,
  setShowDurationDropdown,
  formatTime,
  getDurationDisplay,
  generateTimeSlots,
  generateDurationOptions,
}: SingleEditModeProps) {
  // Get category color - first check appointment, then look up from services
  const getCategoryColor = (): string => {
    if (appointment.categoryColor) {
      return appointment.categoryColor;
    }

    const services = availableServices.get(appointment.teamMemberId);
    if (services) {
      const service = services.find((s) => s.id === appointment.serviceId);
      if (service?.service_categories?.color) {
        return service.service_categories.color;
      }
    }

    return '#A855F7';
  };

  const categoryColor = getCategoryColor();
  const isPendingAddition = appointmentId.startsWith('pending-');

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
        <h2 className="text-lg font-semibold text-gray-900">Edit Service</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Service Name Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-1.5 h-12 rounded-full"
            style={{ backgroundColor: categoryColor }}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-gray-900">
                {appointment.serviceName}
              </h3>
              {isPendingAddition && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                  NEW
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatTime(appointment.startTime)} •{' '}
              {getDurationDisplay(appointment.duration)} • A${' '}
              {appointment.price.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-5">
          {/* Service Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Service
            </label>
            <button
              onClick={() => onShowServicePicker(appointmentId)}
              className="w-full p-4 border-l-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors text-left flex items-center justify-between"
              style={{ borderLeftColor: categoryColor }}
            >
              <div>
                <span className="font-medium text-gray-900">
                  {appointment.serviceName}
                </span>
                <span className="text-gray-500 ml-2">
                  {appointment.duration}min
                </span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Team Member */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Team member
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                <Heart className="h-6 w-6 text-red-500 fill-red-500" />
              </div>

              <div className="flex-1 relative">
                {teamMembersLoading ? (
                  <div className="w-full px-4 py-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-gray-500">Loading...</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setShowTeamMemberDropdown(
                          showTeamMemberDropdown ? null : appointmentId
                        )
                      }
                      className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      {teamMember?.photo_url ? (
                        <Image
                          src={teamMember.photo_url}
                          alt={teamMember.first_name}
                          width={36}
                          height={36}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-600">
                            {teamMember?.first_name[0]}
                          </span>
                        </div>
                      )}
                      <span className="flex-1 text-left font-medium text-gray-900">
                        {teamMember?.first_name} {teamMember?.last_name}
                      </span>
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    </button>

                    {showTeamMemberDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                        {availableTeamMembers.map((member) => (
                          <button
                            key={member.id}
                            onClick={() =>
                              onTeamMemberChange(appointmentId, member.id)
                            }
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                          >
                            {member.photo_url ? (
                              <Image
                                src={member.photo_url}
                                alt={member.first_name}
                                width={36}
                                height={36}
                                className="rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-sm font-medium text-purple-600">
                                  {member.first_name[0]}
                                </span>
                              </div>
                            )}
                            <span className="flex-1 text-left font-medium text-gray-900">
                              {member.first_name} {member.last_name}
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
                    setShowTimeDropdown(showTimeDropdown ? null : appointmentId)
                  }
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">
                    {formatTime(appointment.startTime)}
                  </span>
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </button>

                {showTimeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
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
                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                          time === appointment.startTime
                            ? 'bg-purple-50 text-purple-600 font-medium'
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
                      showDurationDropdown ? null : appointmentId
                    )
                  }
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">
                    {getDurationDisplay(appointment.duration)}
                  </span>
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </button>

                {showDurationDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                    {generateDurationOptions().map((duration) => (
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
                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                          duration === appointment.duration
                            ? 'bg-purple-50 text-purple-600 font-medium'
                            : 'text-gray-900'
                        }`}
                      >
                        {getDurationDisplay(duration)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                A$
              </span>
              <input
                type="number"
                value={appointment.price ?? ''}
                onChange={(e) =>
                  onUpdateAppointmentField(
                    appointmentId,
                    'price',
                    e.target.value ? parseFloat(e.target.value) : 0
                  )
                }
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium text-gray-900"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
          </div>

          {/* Remove Service Button */}
          {canDelete && (
            <button
              onClick={() => onDeleteAppointment(appointmentId)}
              className="w-full px-4 py-3.5 text-red-600 border border-red-200 rounded-xl hover:bg-red-50 flex items-center justify-center gap-2 transition-colors mt-6"
            >
              <Trash2 className="h-4 w-4" />
              Remove service from booking
            </button>
          )}
        </div>
      </div>

      {/* Footer - Single "Done" button since changes are applied instantly */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 lg:px-6 py-3 lg:py-4">
        <button
          onClick={onSave}
          className="w-full px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-medium"
        >
          Done
        </button>
      </div>
    </div>
  );
}
