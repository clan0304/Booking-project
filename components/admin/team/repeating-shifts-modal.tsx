'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import {
  createRepeatingShifts,
  checkExistingShifts,
} from '@/app/actions/shifts';
import { getClosedDays } from '@/app/actions/venue-closed-days';
import { getVenueHours } from '@/app/actions/venue-hours';
import {
  generateShiftDates,
  filterClosedDays,
  validateShiftPattern,
  getToday,
  getTomorrow,
  addWeeks,
  getFullDayName,
  type ShiftPattern,
  type ConflictResolution,
} from '@/lib/shift-helpers';
import type { VenueOperatingHours } from '@/types/database';

interface RepeatingShiftsModalProps {
  teamMemberId: string;
  teamMemberName: string;
  venueId: string;
  venueName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RepeatingShiftsModal({
  teamMemberId,
  teamMemberName,
  venueId,
  venueName,
  onClose,
  onSuccess,
}: RepeatingShiftsModalProps) {
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:00');
  const [startDate, setStartDate] = useState(getTomorrow());
  const [endDate, setEndDate] = useState(addWeeks(getTomorrow(), 4)); // 4 weeks
  const [conflictResolution, setConflictResolution] =
    useState<ConflictResolution>('skip');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [venueHours, setVenueHours] = useState<VenueOperatingHours[]>([]);
  const [existingShiftCount, setExistingShiftCount] = useState(0);
  const [previewCount, setPreviewCount] = useState(0);

  // Load venue hours
  useEffect(() => {
    const loadVenueHours = async () => {
      const result = await getVenueHours(venueId);
      if (result.success && result.data) {
        setVenueHours(result.data as VenueOperatingHours[]);
      }
    };
    loadVenueHours();
  }, [venueId]);

  // Check existing shifts when date range or days change
  useEffect(() => {
    const checkExisting = async () => {
      const result = await checkExistingShifts(
        teamMemberId,
        venueId,
        startDate,
        endDate
      );
      if (result.success) {
        setExistingShiftCount(result.count || 0);
      }
    };
    checkExisting();
  }, [teamMemberId, venueId, startDate, endDate]);

  // Calculate preview count when pattern changes
  useEffect(() => {
    const calculatePreview = async () => {
      const pattern: ShiftPattern = {
        days: selectedDays,
        startTime,
        endTime,
        startDate,
        endDate,
      };

      const shifts = generateShiftDates(pattern);

      // Get closed days
      const closedResult = await getClosedDays(venueId, startDate, endDate);
      if (closedResult.success && closedResult.data) {
        const closedDates = closedResult.data.map((d) => d.closed_date);
        const filteredShifts = filterClosedDays(shifts, closedDates);
        setPreviewCount(filteredShifts.length);
      } else {
        setPreviewCount(shifts.length);
      }
    };

    if (selectedDays.length > 0 && startDate && endDate) {
      calculatePreview();
    }
  }, [selectedDays, startTime, endTime, startDate, endDate, venueId]);

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort();
      }
    });
  };

  const handleUseVenueHours = (day: number) => {
    const dayHours = venueHours.find((h) => h.day_of_week === day);
    if (dayHours && !dayHours.is_closed) {
      setStartTime(dayHours.start_time || '09:00');
      setEndTime(dayHours.end_time || '18:00');
    }
  };

  const handleSubmit = async () => {
    setError('');

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
      setError(validation.errors.join('. '));
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate shifts
      const shifts = generateShiftDates(pattern);

      // Get closed days and filter
      const closedResult = await getClosedDays(venueId, startDate, endDate);
      let filteredShifts = shifts;

      if (closedResult.success && closedResult.data) {
        const closedDates = closedResult.data.map((d) => d.closed_date);
        filteredShifts = filterClosedDays(shifts, closedDates);
      }

      // Submit
      const formData = new FormData();
      formData.append('teamMemberId', teamMemberId);
      formData.append('venueId', venueId);
      formData.append('shifts', JSON.stringify(filteredShifts));
      formData.append('conflictResolution', conflictResolution);

      const result = await createRepeatingShifts(formData);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to create shifts');
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Set Repeating Shifts
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {teamMemberName} at {venueName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Date Range */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getToday()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Days Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">
              Days of Week
            </label>
            <div className="grid grid-cols-7 gap-2">
              {dayNames.map((day, index) => {
                const isSelected = selectedDays.includes(index);
                return (
                  <button
                    key={index}
                    onClick={() => handleDayToggle(index)}
                    className={`py-3 rounded-lg font-medium text-sm transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-900">
                Shift Hours
              </label>
              <button
                onClick={() => handleUseVenueHours(selectedDays[0] || 1)}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                Use Venue Hours
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Conflict Resolution */}
          {existingShiftCount > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-900">
                Existing Shifts Detected
              </label>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    Found {existingShiftCount} existing shift(s) in this date
                    range. How would you like to handle them?
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="conflict"
                    value="skip"
                    checked={conflictResolution === 'skip'}
                    onChange={(e) =>
                      setConflictResolution(
                        e.target.value as ConflictResolution
                      )
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      Skip Existing (Recommended)
                    </div>
                    <div className="text-sm text-gray-600">
                      Keep existing shifts, only add new ones
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="conflict"
                    value="replace"
                    checked={conflictResolution === 'replace'}
                    onChange={(e) =>
                      setConflictResolution(
                        e.target.value as ConflictResolution
                      )
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Replace All</div>
                    <div className="text-sm text-gray-600">
                      Delete existing shifts and create new ones
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-900">
              <Calendar className="h-5 w-5" />
              <span className="font-medium">
                Will create {previewCount} shift(s)
              </span>
            </div>
            {previewCount > 0 && (
              <div className="text-sm text-purple-700 mt-1">
                {selectedDays.map((day) => getFullDayName(day)).join(', ')} from{' '}
                {startTime} to {endTime}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || previewCount === 0}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : `Create ${previewCount} Shifts`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
