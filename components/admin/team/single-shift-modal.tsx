// components/admin/team/single-shift-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { createShift, updateShift, deleteShift } from '@/app/actions/shifts';

interface SingleShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMemberId: string;
  teamMemberName: string;
  venueId: string;
  venueName: string;
  date: string; // YYYY-MM-DD
  existingShift?: {
    id: string;
    start_time: string;
    end_time: string;
    notes: string | null;
  } | null;
  onSuccess: () => void;
}

export function SingleShiftModal({
  isOpen,
  onClose,
  teamMemberId,
  teamMemberName,
  venueId,

  date,
  existingShift,
  onSuccess,
}: SingleShiftModalProps) {
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  // Load existing shift data if editing
  useEffect(() => {
    if (existingShift) {
      setStartTime(existingShift.start_time.slice(0, 5)); // HH:MM
      setEndTime(existingShift.end_time.slice(0, 5)); // HH:MM
      setNotes(existingShift.notes || '');
    } else {
      setStartTime('10:00');
      setEndTime('18:00');
      setNotes('');
    }
    setError('');
  }, [existingShift, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const formData = new FormData();

      if (existingShift) {
        // Update existing shift
        formData.append('startTime', startTime);
        formData.append('endTime', endTime);
        formData.append('notes', notes);

        const result = await updateShift(existingShift.id, formData);

        if (result.success) {
          onClose();
          onSuccess();
        } else {
          setError(result.error || 'Failed to update shift');
        }
      } else {
        // Create new shift
        formData.append('teamMemberId', teamMemberId);
        formData.append('venueId', venueId);
        formData.append('shiftDate', date);
        formData.append('startTime', startTime);
        formData.append('endTime', endTime);
        formData.append('notes', notes);

        const result = await createShift(formData);

        if (result.success) {
          onClose();
          onSuccess();
        } else {
          setError(result.error || 'Failed to create shift');
        }
      }
    } catch (err) {
      console.error('Error saving shift:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingShift) return;
    if (!confirm('Delete this shift?')) return;

    setIsDeleting(true);
    setError('');

    try {
      const result = await deleteShift(existingShift.id);

      if (result.success) {
        onClose();
        onSuccess();
      } else {
        setError(result.error || 'Failed to delete shift');
      }
    } catch (err) {
      console.error('Error deleting shift:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {existingShift ? 'Edit Shift' : 'Add Shift'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {teamMemberName} · {formatDate(date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                required
                disabled={isSubmitting || isDeleting}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-500">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about this shift..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 resize-none"
              disabled={isSubmitting || isDeleting}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            {existingShift ? (
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
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || isDeleting}
              >
                {isSubmitting
                  ? 'Saving...'
                  : existingShift
                  ? 'Save Changes'
                  : 'Add Shift'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
