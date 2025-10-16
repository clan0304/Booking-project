'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, User } from 'lucide-react';

interface TimeEntry {
  id: string;
  team_member_id: string;
  venue_id: string;
  shift_date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  status: 'clocked_in' | 'on_break' | 'completed';
  total_hours: number | null;
  total_paid_hours: number | null;
  total_break_minutes: number;
  notes: string | null;
  users: {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  };
  venues: {
    id: string;
    name: string;
  };
}

interface TimeEntriesTableProps {
  entries: TimeEntry[];
  isAdmin: boolean;
  currentUserId: string;
}

export function TimeEntriesTable({ entries, isAdmin }: TimeEntriesTableProps) {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'clocked_in':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'on_break':
        return <Badge className="bg-orange-500">On Break</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Shifts
        </CardTitle>
        <CardDescription>
          {isAdmin ? 'All team member shifts' : 'Your recent work history'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No shift records yet</p>
            <p className="text-sm">Clock in to start tracking your hours</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {isAdmin && <TableHead>Staff</TableHead>}
                  <TableHead>Venue</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatDate(entry.shift_date)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {entry.users.first_name}{' '}
                            {entry.users.last_name || ''}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {entry.venues.name}
                      </div>
                    </TableCell>
                    <TableCell>{formatTime(entry.clock_in_time)}</TableCell>
                    <TableCell>
                      {entry.clock_out_time
                        ? formatTime(entry.clock_out_time)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {entry.total_paid_hours !== null ? (
                        <div>
                          <div className="font-medium">
                            {entry.total_paid_hours.toFixed(2)}h
                          </div>
                          {entry.total_break_minutes > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {entry.total_break_minutes} min break
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
