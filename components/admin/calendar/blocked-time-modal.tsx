// components/admin/calendar/blocked-time-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  createBlockedTime,
  updateBlockedTime,
  deleteBlockedTime,
} from '@/app/actions/blocked-times';
import type { BlockedTime } from '@/types/calendar';

interface BlockedTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMemberId: string;
  teamMemberName: string;
  venueId: string;
  venueName: string;
  date: string;
  defaultStartTime: string;
  existingBlockedTime: BlockedTime | null; // For editing
  onSuccess: () => void;
}

export function BlockedTimeModal({
  isOpen,
  onClose,
  teamMemberId,
  teamMemberName,
  venueId,
  venueName,
  date,
  defaultStartTime,
  existingBlockedTime,
  onSuccess,
}: BlockedTimeModalProps) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const reasonOptions = [
    'Lunch Break',
    'Personal Appointment',
    'Training',
    'Meeting',
    'Break',
    'Other',
  ];

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (existingBlockedTime) {
        // Edit mode - load existing data
        setStartTime(existingBlockedTime.start_time.substring(0, 5)); // Remove seconds
        setEndTime(existingBlockedTime.end_time.substring(0, 5));
        setReason(existingBlockedTime.reason || '');
      } else {
        // Create mode - use defaults
        setStartTime(defaultStartTime);

        // Auto-set end time to 1 hour later (with wrap-around at midnight)
        const [hour, min] = defaultStartTime.split(':');
        const endHour = ((parseInt(hour) + 1) % 24).toString().padStart(2, '0');
        setEndTime(`${endHour}:${min}`);
        setReason('');
      }
      setError('');
    }
  }, [isOpen, existingBlockedTime, defaultStartTime]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate time range
      if (startTime >= endTime) {
        setError('End time must be after start time');
        setIsSubmitting(false);
        return;
      }

      const result = existingBlockedTime
        ? await updateBlockedTime(existingBlockedTime.id, {
            start_time: startTime + ':00',
            end_time: endTime + ':00',
            reason: reason || null,
          })
        : await createBlockedTime({
            team_member_id: teamMemberId,
            venue_id: venueId,
            blocked_date: date,
            start_time: startTime + ':00',
            end_time: endTime + ':00',
            reason: reason || null,
          });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to save blocked time');
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingBlockedTime) return;

    const confirmed = confirm(
      'Are you sure you want to delete this blocked time?'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError('');

    try {
      const result = await deleteBlockedTime(existingBlockedTime.id);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to delete blocked time');
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

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
                {existingBlockedTime ? 'Edit' : 'Add'} Blocked Time
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {teamMemberName} · {formatDate(date)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{venueName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSubmitting || isDeleting}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  required
                  disabled={isSubmitting || isDeleting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  required
                  disabled={isSubmitting || isDeleting}
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-gray-500">(Optional)</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                disabled={isSubmitting || isDeleting}
              >
                <option value="">Select a reason</option>
                {reasonOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              {existingBlockedTime ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  disabled={isSubmitting || isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting || isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isDeleting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : existingBlockedTime
                    ? 'Update'
                    : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
