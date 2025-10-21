// components/admin/calendar/appointment-details-modal.tsx
'use client';

import { X, Clock, User, Calendar, Phone, Mail } from 'lucide-react';
import type { CalendarAppointment, CalendarBooking } from '@/types/calendar';

interface AppointmentDetailsModalProps {
  appointment: CalendarAppointment;
  booking: CalendarBooking;
  isOpen: boolean;
  onClose: () => void;
}

export function AppointmentDetailsModal({
  appointment,
  booking,
  isOpen,
  onClose,
}: AppointmentDetailsModalProps) {
  if (!isOpen) return null;

  const clientName = `${booking.guest_first_name} ${
    booking.guest_last_name || ''
  }`.trim();

  const teamMemberName = appointment.team_member
    ? `${appointment.team_member.first_name} ${appointment.team_member.last_name}`
    : 'Unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Client Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Client Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">{clientName}</span>
              </div>
              {booking.guest_email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">{booking.guest_email}</span>
                </div>
              )}
              {booking.guest_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">{booking.guest_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Appointment Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Appointment Details
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">{booking.booking_date}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">
                  {appointment.start_time} - {appointment.end_time} (
                  {appointment.duration_minutes} mins)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">Stylist: {teamMemberName}</span>
              </div>
            </div>
          </div>

          {/* Service Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Service Information
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">
                  {appointment.service_name}
                </span>
                <span className="font-semibold text-gray-900">
                  ${appointment.price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Status</h3>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {appointment.status.charAt(0).toUpperCase() +
                appointment.status.slice(1)}
            </div>
          </div>

          {/* Notes */}
          {(booking.notes || booking.internal_notes || appointment.notes) && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Notes
              </h3>
              <div className="space-y-2">
                {booking.notes && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Client Notes:
                    </p>
                    <p className="text-sm text-blue-800">{booking.notes}</p>
                  </div>
                )}
                {appointment.notes && (
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm font-medium text-purple-900 mb-1">
                      Service Notes:
                    </p>
                    <p className="text-sm text-purple-800">
                      {appointment.notes}
                    </p>
                  </div>
                )}
                {booking.internal_notes && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Internal Notes:
                    </p>
                    <p className="text-sm text-gray-700">
                      {booking.internal_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900">
                Total Price:
              </span>
              <span className="text-2xl font-bold text-purple-600">
                ${booking.total_price.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            Edit Booking
          </button>
        </div>
      </div>
    </div>
  );
}
