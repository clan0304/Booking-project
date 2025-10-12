// components/admin/team/repeating-shifts-modal.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import {
  createRepeatingShifts,
  checkExistingShifts,
} from '@/app/actions/shifts';
import { getToday, addWeeks, validateShiftPattern } from '@/lib/shift-helpers';
import type { ShiftPattern, ConflictResolution } from '@/lib/shift-helpers';

interface RepeatingShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMemberId: string;
  teamMemberName: string;
  venueId: string;
  venueName: string;
  onSuccess: () => void;
}

export function RepeatingShiftsModal({
  isOpen,
  onClose,
  teamMemberId,
  teamMemberName,
  venueId,
  venueName,
  onSuccess,
}: RepeatingShiftsModalProps) {
  const today = getToday();
  const fourWeeksLater = addWeeks(today, 4);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(fourWeeksLater);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [conflictResolution, setConflictResolution] =
    useState<ConflictResolution>('skip');
  const [existingCount, setExistingCount] = useState(0);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const dayButtons = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
  ];

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  // Check for conflicts when dates or days change
  const checkConflicts = async () => {
    if (selectedDays.length === 0) return;

    setIsCheckingConflicts(true);
    try {
      const result = await checkExistingShifts(
        teamMemberId,
        venueId,
        startDate,
        endDate
      );

      if (result.success) {
        setExistingCount(result.count || 0);
      }
    } catch (err) {
      console.error('Error checking conflicts:', err);
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate pattern
      const pattern: ShiftPattern = {
        days: selectedDays,
        startTime,
        endTime,
        startDate,
        endDate,
      };

      const validation = validateShiftPattern(pattern);
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        setIsSubmitting(false);
        return;
      }

      // Create FormData - CRITICAL: Send dates as plain strings
      const formData = new FormData();
      formData.append('teamMemberId', teamMemberId);
      formData.append('venueId', venueId);
      formData.append('startDate', startDate); // Keep as string!
      formData.append('endDate', endDate); // Keep as string!
      formData.append('days', JSON.stringify(selectedDays));
      formData.append('startTime', startTime);
      formData.append('endTime', endTime);
      formData.append('conflictResolution', conflictResolution);

      const result = await createRepeatingShifts(formData);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to create shifts');
      }
    } catch (err) {
      console.error('Error creating shifts:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="sticky top-0 border-b bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Set Repeating Shifts
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {teamMemberName} at {venueName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Date Range */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Date Range
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    // CRITICAL: Keep as string, never convert to Date object
                    setStartDate(e.target.value);
                  }}
                  onBlur={checkConflicts}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    // CRITICAL: Keep as string, never convert to Date object
                    setEndDate(e.target.value);
                  }}
                  onBlur={checkConflicts}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Days of Week */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Days of Week
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {dayButtons.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => {
                    toggleDay(day.value);
                    // Small delay to ensure state is updated before checking conflicts
                    setTimeout(checkConflicts, 100);
                  }}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                    selectedDays.includes(day.value)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isSubmitting}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {selectedDays.length === 0 && (
              <p className="text-sm text-red-600 mt-2">
                Please select at least one day
              </p>
            )}
          </div>

          {/* Shift Hours */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Shift Hours
              </h3>
              <button
                type="button"
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                onClick={() => {
                  // Use venue hours feature (future implementation)
                  alert('Venue hours feature coming soon!');
                }}
              >
                Use Venue Hours
              </button>
            </div>
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Conflict Detection */}
          {existingCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-yellow-800 font-medium mb-3">
                    Found {existingCount} existing shift(s) in this date range.
                    How would you like to handle them?
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="conflictResolution"
                        value="skip"
                        checked={conflictResolution === 'skip'}
                        onChange={(e) =>
                          setConflictResolution(
                            e.target.value as ConflictResolution
                          )
                        }
                        className="text-purple-600"
                        disabled={isSubmitting}
                      />
                      <span className="text-sm text-gray-700">
                        Skip existing dates (keep old shifts)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="conflictResolution"
                        value="replace"
                        checked={conflictResolution === 'replace'}
                        onChange={(e) =>
                          setConflictResolution(
                            e.target.value as ConflictResolution
                          )
                        }
                        className="text-purple-600"
                        disabled={isSubmitting}
                      />
                      <span className="text-sm text-gray-700">
                        Replace with new shifts (delete old shifts)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Footer */}
          <div className="sticky bottom-0 border-t bg-white pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                isSubmitting || selectedDays.length === 0 || isCheckingConflicts
              }
            >
              {isSubmitting
                ? 'Creating...'
                : `Create ${
                    selectedDays.length *
                    Math.ceil(
                      (new Date(endDate).getTime() -
                        new Date(startDate).getTime()) /
                        (7 * 24 * 60 * 60 * 1000)
                    )
                  } Shifts`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
