// components/admin/team/scheduled-shifts-placeholder.tsx
'use client';

import { Calendar } from 'lucide-react';

export function ScheduledShiftsPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
          <Calendar className="h-8 w-8 text-[#6C5CE7]" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Scheduled Shifts
        </h3>
        <p className="text-sm text-gray-600">
          Shift scheduling will be available here. This feature is coming soon.
        </p>
      </div>
    </div>
  );
}
