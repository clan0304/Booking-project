'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Clock, Coffee, MapPin, StopCircle } from 'lucide-react';
import { clockOut, startBreak, endBreak } from '@/app/actions/staff-management';

interface Break {
  start: string;
  end: string | null;
}

interface ActiveShift {
  id: string;
  venue_id: string;
  venue_name: string;
  clock_in_time: string;
  status: 'clocked_in' | 'on_break';
  current_break_start: string | null;
  breaks: Break[];
}

interface ActiveShiftDisplayProps {
  shift: ActiveShift;
  onUpdate?: () => void;
  selectedStaffId?: string; // ✅ NEW: For kiosk mode
}

export function ActiveShiftDisplay({
  shift,
  onUpdate,
  selectedStaffId, // ✅ NEW: Receive selected staff ID
}: ActiveShiftDisplayProps) {
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState('00:00:00');

  // Calculate duration
  useEffect(() => {
    const updateDuration = () => {
      const now = new Date();
      const clockIn = new Date(shift.clock_in_time);
      const diffMs = now.getTime() - clockIn.getTime();

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setDuration(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
          2,
          '0'
        )}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [shift.clock_in_time]);

  const handleClockOut = async () => {
    if (!confirm('Are you sure you want to clock out?')) return;

    setLoading(true);
    // ✅ FIX: Pass selectedStaffId for kiosk mode
    const result = await clockOut(shift.id, selectedStaffId);

    if (result.success) {
      if (onUpdate) onUpdate();
    } else {
      alert(result.error || 'Failed to clock out');
    }
    setLoading(false);
  };

  const handleStartBreak = async () => {
    setLoading(true);
    // ✅ FIX: Pass selectedStaffId for kiosk mode
    const result = await startBreak(shift.id, selectedStaffId);

    if (result.success) {
      if (onUpdate) onUpdate();
    } else {
      alert(result.error || 'Failed to start break');
    }
    setLoading(false);
  };

  const handleEndBreak = async () => {
    setLoading(true);
    // ✅ FIX: Pass selectedStaffId for kiosk mode
    const result = await endBreak(shift.id, selectedStaffId);

    if (result.success) {
      if (onUpdate) onUpdate();
    } else {
      alert(result.error || 'Failed to end break');
    }
    setLoading(false);
  };

  const isOnBreak = shift.status === 'on_break';

  return (
    <Card className="border-2 border-green-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-green-500" />
          {isOnBreak ? 'On Break' : 'Active Shift'}
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {shift.venue_name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Duration Timer */}
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <div className="text-5xl font-bold font-mono">{duration}</div>
          <p className="text-sm text-muted-foreground mt-2">
            Started at{' '}
            {new Date(shift.clock_in_time).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        </div>

        {/* Break Button */}
        {isOnBreak ? (
          <Button
            onClick={handleEndBreak}
            disabled={loading}
            variant="default"
            className="w-full h-12"
            size="lg"
          >
            <Coffee className="mr-2 h-5 w-5" />
            {loading ? 'Ending Break...' : 'End Break'}
          </Button>
        ) : (
          <Button
            onClick={handleStartBreak}
            disabled={loading}
            variant="outline"
            className="w-full h-12"
            size="lg"
          >
            <Coffee className="mr-2 h-5 w-5" />
            {loading ? 'Starting Break...' : 'Start Break'}
          </Button>
        )}

        {/* Clock Out Button */}
        <Button
          onClick={handleClockOut}
          disabled={loading}
          variant="destructive"
          className="w-full h-12"
          size="lg"
        >
          <StopCircle className="mr-2 h-5 w-5" />
          {loading ? 'Clocking Out...' : 'Clock Out'}
        </Button>

        {/* Break History */}
        {shift.breaks && shift.breaks.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Break History</p>
            <div className="space-y-1">
              {shift.breaks.map((brk, index) => (
                <div
                  key={index}
                  className="text-xs text-muted-foreground flex justify-between"
                >
                  <span>Break {index + 1}</span>
                  <span>
                    {new Date(brk.start).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    -{' '}
                    {brk.end
                      ? new Date(brk.end).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'In Progress'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
