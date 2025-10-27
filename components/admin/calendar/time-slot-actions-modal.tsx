// components/admin/calendar/time-slot-actions-modal.tsx
'use client';

import { useState } from 'react';
import { X, Calendar, XCircle } from 'lucide-react';
import { BlockedTimeModal } from './blocked-time-modal';

interface TimeSlotActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeSlot: string; // e.g., "14:00"
  date: string; // e.g., "2025-10-23"
  teamMemberId: string;
  teamMemberName: string;
  venueId: string;
  venueName: string;
  onSuccess: () => void;
}

export function TimeSlotActionsModal({
  isOpen,
  onClose,
  timeSlot,
  date,
  teamMemberId,
  teamMemberName,
  venueId,
  venueName,
  onSuccess,
}: TimeSlotActionsModalProps) {
  const [showBlockTime, setShowBlockTime] = useState(false);

  // Format time for display (12-hour format)
  const formatTime = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min} ${period}`;
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  // Show blocked time modal if active
  if (showBlockTime) {
    return (
      <BlockedTimeModal
        isOpen={showBlockTime}
        onClose={() => {
          setShowBlockTime(false);
          onClose(); // Close parent modal too
        }}
        teamMemberId={teamMemberId}
        teamMemberName={teamMemberName}
        venueId={venueId}
        venueName={venueName}
        date={date}
        defaultStartTime={timeSlot}
        existingBlockedTime={null}
        onSuccess={() => {
          setShowBlockTime(false);
          onClose();
          onSuccess();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {formatTime(timeSlot)}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {teamMemberName} · {formatDate(date)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{venueName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="p-6 space-y-3">
            {/* Add Appointment - Placeholder for Phase 6 */}
            <button
              onClick={() => {
                alert(
                  'Add Appointment functionality will be implemented in Phase 6'
                );
              }}
              className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-purple-600 hover:bg-purple-50 transition-all group"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">
                  Add appointment
                </div>
                <div className="text-xs text-gray-500">
                  Create a new booking for this time
                </div>
              </div>
            </button>

            {/* Add Blocked Time */}
            <button
              onClick={() => setShowBlockTime(true)}
              className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 transition-all group"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition-colors">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">
                  Add blocked time
                </div>
                <div className="text-xs text-gray-500">
                  Mark this time as unavailable
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
