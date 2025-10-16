'use client';

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface LongRunningShift {
  id: string;
  team_member_id: string;
  team_member_name: string;
  venue_id: string;
  venue_name: string;
  clock_in_time: string;
  hours_elapsed: number;
  status: string;
}

interface LongRunningAlertProps {
  shifts: LongRunningShift[];
}

export function LongRunningAlert({ shifts }: LongRunningAlertProps) {
  if (shifts.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-orange-500 bg-orange-50">
      <AlertTriangle className="h-5 w-5 text-orange-600" />
      <AlertTitle className="text-orange-900 font-semibold">
        {shifts.length} Long-Running {shifts.length === 1 ? 'Shift' : 'Shifts'}{' '}
        Detected
      </AlertTitle>
      <AlertDescription className="text-orange-800 mt-2">
        <div className="space-y-2">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="flex items-center justify-between bg-white/50 p-3 rounded"
            >
              <div>
                <p className="font-medium">{shift.team_member_name}</p>
                <p className="text-sm text-muted-foreground">
                  {shift.venue_name} • Started{' '}
                  {new Date(shift.clock_in_time).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-orange-600">
                  {shift.hours_elapsed.toFixed(1)}h
                </p>
                <p className="text-xs text-muted-foreground uppercase">
                  {shift.status.replace('_', ' ')}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">
          ⚠️ These shifts have been active for over 12 hours. Please review and
          clock out if needed.
        </p>
      </AlertDescription>
    </Alert>
  );
}
