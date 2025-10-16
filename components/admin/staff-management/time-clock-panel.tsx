'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, MapPin } from 'lucide-react';
import { clockIn } from '@/app/actions/staff-management';

interface Venue {
  id: string;
  name: string;
}

interface TimeClockPanelProps {
  venues: Venue[];
  onClockIn?: () => void;
  selectedStaffId?: string; // ✅ NEW: For kiosk mode
}

export function TimeClockPanel({
  venues,
  onClockIn,
  selectedStaffId, // ✅ NEW: Receive selected staff ID
}: TimeClockPanelProps) {
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleClockIn = async () => {
    if (!selectedVenue) {
      alert('Please select a venue');
      return;
    }

    setLoading(true);
    // ✅ FIX: Pass selectedStaffId for kiosk mode
    const result = await clockIn(selectedVenue, selectedStaffId);

    if (result.success) {
      if (onClockIn) onClockIn();
    } else {
      alert(result.error || 'Failed to clock in');
    }
    setLoading(false);
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Clock In
        </CardTitle>
        <CardDescription>
          Select your venue and start your shift
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Venue Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Select Venue
          </label>
          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a venue" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clock In Button */}
        <Button
          onClick={handleClockIn}
          disabled={loading || !selectedVenue}
          className="w-full h-12 text-lg"
          size="lg"
        >
          {loading ? 'Clocking In...' : '🟢 Clock In'}
        </Button>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center">
          Your shift will start immediately after clocking in
        </p>
      </CardContent>
    </Card>
  );
}
