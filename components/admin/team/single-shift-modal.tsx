// components/admin/team/single-shift-modal.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import { createShift, updateShift, deleteShift } from '@/app/actions/shifts';
import Link from 'next/link';

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

  // Calculate total shift duration
  const totalDuration = useMemo(() => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const diffMinutes = endMinutes - startMinutes;

    if (diffMinutes <= 0) return null;

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }, [startTime, endTime]);

  // Format date for Fresha-style header (e.g., "Thu 15 Jan")
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  };

  // Get first name for possessive header
  const firstName = teamMemberName.split(' ')[0];

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {firstName}&apos;s shift {formatDateHeader(date)}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              You are editing this day&apos;s shift only. To set repeating
              shifts, go to{' '}
              <Link
                href="/admin/team"
                className="text-purple-600 hover:text-purple-700 hover:underline"
                onClick={onClose}
              >
                scheduled shifts
              </Link>
              .
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-4"
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
                Start time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                required
                disabled={isSubmitting || isDeleting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                required
                disabled={isSubmitting || isDeleting}
              />
            </div>
          </div>

          {/* Total Duration */}
          {totalDuration && (
            <div className="flex justify-end">
              <p className="text-sm text-gray-500">
                Total shift duration:{' '}
                <span className="font-medium text-gray-700">
                  {totalDuration}
                </span>
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes{' '}
              <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about this shift..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
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
                className="flex items-center justify-center w-10 h-10 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                disabled={isSubmitting || isDeleting}
                title="Delete shift"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 rounded-full text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || isDeleting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
