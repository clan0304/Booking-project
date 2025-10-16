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
}

export function ActiveShiftDisplay({
  shift,
  onUpdate,
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
    const result = await clockOut(shift.id);

    if (result.success) {
      if (onUpdate) onUpdate();
    } else {
      alert(result.error || 'Failed to clock out');
    }
    setLoading(false);
  };

  const handleStartBreak = async () => {
    setLoading(true);
    const result = await startBreak(shift.id);

    if (result.success) {
      if (onUpdate) onUpdate();
    } else {
      alert(result.error || 'Failed to start break');
    }
    setLoading(false);
  };

  const handleEndBreak = async () => {
    setLoading(true);
    const result = await endBreak(shift.id);

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
        {/* Duration Display */}
        <div className="text-center py-6 bg-muted rounded-lg">
          <div className="text-4xl font-bold font-mono tabular-nums">
            {duration}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Started at{' '}
            {new Date(shift.clock_in_time).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        </div>

        {/* Break Info */}
        {shift.breaks.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <p>Breaks taken: {shift.breaks.length}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid gap-2">
          {isOnBreak ? (
            <Button
              onClick={handleEndBreak}
              disabled={loading}
              className="w-full"
              variant="default"
            >
              {loading ? 'Ending Break...' : '✅ End Break'}
            </Button>
          ) : (
            <Button
              onClick={handleStartBreak}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Coffee className="h-4 w-4 mr-2" />
              {loading ? 'Starting...' : 'Start Break'}
            </Button>
          )}

          <Button
            onClick={handleClockOut}
            disabled={loading || isOnBreak}
            className="w-full"
            variant="destructive"
          >
            <StopCircle className="h-4 w-4 mr-2" />
            {loading ? 'Clocking Out...' : 'Clock Out'}
          </Button>
        </div>

        {isOnBreak && (
          <p className="text-xs text-orange-600 text-center">
            ⚠️ You must end your break before clocking out
          </p>
        )}
      </CardContent>
    </Card>
  );
}
