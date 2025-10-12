'use client';

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import {
  getStartOfWeek,
  addWeeks,
  addDays,
  formatDateRange,
  getToday,
} from '@/lib/shift-helpers';

interface WeekNavigatorProps {
  currentWeekStart: string;
  onWeekChange: (weekStart: string) => void;
}

export function WeekNavigator({
  currentWeekStart,
  onWeekChange,
}: WeekNavigatorProps) {
  const handlePrevWeek = () => {
    const prevWeek = addWeeks(currentWeekStart, -1);
    onWeekChange(prevWeek);
  };

  const handleNextWeek = () => {
    const nextWeek = addWeeks(currentWeekStart, 1);
    onWeekChange(nextWeek);
  };

  const handleThisWeek = () => {
    const thisWeek = getStartOfWeek(getToday());
    onWeekChange(thisWeek);
  };

  // Calculate the actual end of the week (Sunday = 6 days after Monday)
  const weekEnd = addDays(currentWeekStart, 6);
  const dateRangeText = formatDateRange(currentWeekStart, weekEnd);

  // Check if current week is this week
  const thisWeekStart = getStartOfWeek(getToday());
  const isThisWeek = currentWeekStart === thisWeekStart;

  return (
    <div className="flex items-center gap-3">
      {/* Previous Week */}
      <button
        onClick={handlePrevWeek}
        className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        title="Previous week"
      >
        <ChevronLeft className="h-5 w-5 text-gray-600" />
      </button>

      {/* Current Week Display */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white min-w-[200px] justify-center">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="font-medium text-gray-900">{dateRangeText}</span>
      </div>

      {/* Next Week */}
      <button
        onClick={handleNextWeek}
        className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        title="Next week"
      >
        <ChevronRight className="h-5 w-5 text-gray-600" />
      </button>

      {/* This Week Button */}
      {!isThisWeek && (
        <button
          onClick={handleThisWeek}
          className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
        >
          This Week
        </button>
      )}
    </div>
  );
}
