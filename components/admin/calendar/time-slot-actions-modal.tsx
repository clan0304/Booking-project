// components/admin/calendar/time-slot-actions-modal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Calendar, XCircle } from 'lucide-react';
import { BlockedTimeModal } from './blocked-time-modal';
import { CreateAppointmentModal } from './appointment/create-appointment-modal';

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
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    // Small delay to prevent immediate close on open
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

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

  // Show add appointment modal if active
  if (showAddAppointment) {
    return (
      <CreateAppointmentModal
        isOpen={showAddAppointment}
        onClose={() => {
          setShowAddAppointment(false);
          onClose(); // Close parent modal too
        }}
        venueId={venueId}
        venueName={venueName}
        teamMemberId={teamMemberId}
        teamMemberName={teamMemberName}
        date={date}
        startTime={timeSlot}
        onSuccess={() => {
          setShowAddAppointment(false);
          onClose();
          onSuccess();
        }}
      />
    );
  }

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
    <>
      {/* Transparent backdrop (no dark overlay) */}
      <div className="fixed inset-0 z-50" onClick={onClose} />

      {/* Modal - positioned at clicked location (COMPACT SIZE) */}
      <div
        ref={modalRef}
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 max-w-xs w-full animate-in fade-in zoom-in-95 duration-200"
        style={{
          // Center on screen by default
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Header - Compact */}
        <div className="flex items-start justify-between p-3 pb-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {formatTime(timeSlot)}
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {teamMemberName} · {formatDate(date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-0.5 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action Buttons - Compact */}
        <div className="p-3 space-y-2">
          {/* Add Appointment */}
          <button
            onClick={() => setShowAddAppointment(true)}
            className="w-full flex items-center gap-2.5 p-3 rounded-lg border-2 border-gray-200 hover:border-purple-600 hover:bg-purple-50 transition-all group"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
              <Calendar className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm text-gray-900">
                Add appointment
              </div>
            </div>
          </button>

          {/* Add Blocked Time */}
          <button
            onClick={() => setShowBlockTime(true)}
            className="w-full flex items-center gap-2.5 p-3 rounded-lg border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 transition-all group"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition-colors">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-sm text-gray-900">
                Add blocked time
              </div>
            </div>
          </button>
        </div>

        {/* Footer - Compact */}
        <div className="px-3 pb-3">
          <button
            className="w-full text-center text-xs text-purple-600 hover:text-purple-700 font-medium py-1.5 hover:bg-purple-50 rounded-lg transition-colors"
            onClick={() => {
              // TODO: Open quick actions settings
              console.log('Open quick actions settings');
            }}
          >
            Quick actions settings
          </button>
        </div>
      </div>
    </>
  );
}
