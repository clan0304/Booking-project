// components/admin/staff-management/time-entries-table.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock,
  MapPin,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Edit2,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getTimeEntries,
  updateTimeEntry,
  deleteTimeEntry,
} from '@/app/actions/staff-management';

// =====================================================
// TYPES
// =====================================================

interface Break {
  start: string;
  end: string | null;
}

interface EditableBreak {
  start: string;
  end: string;
}

interface TimeEntry {
  id: string;
  team_member_id: string;
  venue_id: string;
  shift_date: string;
  clock_in_time: string;
  clock_out_time: string | null;
  breaks: Break[];
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

type DateRangePreset =
  | 'today'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'custom';

interface TimeEntriesTableProps {
  entries: TimeEntry[];
  isAdmin: boolean;
  currentUserId: string;
  onRefresh?: () => void;
}

// =====================================================
// HELPERS
// =====================================================

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getDateRangeStrings(preset: DateRangePreset): {
  start: string;
  end: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today': {
      const dateStr = formatDate(today);
      return { start: dateStr, end: dateStr };
    }
    case 'this_week': {
      return {
        start: formatDate(getStartOfWeek(today)),
        end: formatDate(getEndOfWeek(today)),
      };
    }
    case 'last_week': {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return {
        start: formatDate(getStartOfWeek(lastWeek)),
        end: formatDate(getEndOfWeek(lastWeek)),
      };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: formatDate(start), end: formatDate(end) };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(start), end: formatDate(end) };
    }
    default:
      return {
        start: formatDate(getStartOfWeek(today)),
        end: formatDate(getEndOfWeek(today)),
      };
  }
}

function formatDateRange(startStr: string, endStr: string): string {
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  const startFormatted = start.toLocaleDateString('en-AU', options);
  const endFormatted = end.toLocaleDateString('en-AU', {
    ...options,
    year: 'numeric',
  });
  return `${startFormatted} - ${endFormatted}`;
}

// Extract time (HH:MM) from ISO timestamp
function extractTimeFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Combine date and time into ISO timestamp
function combineDateTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00`;
}

// =====================================================
// COMPONENT
// =====================================================

export function TimeEntriesTable({
  entries: initialEntries,
  isAdmin,
  currentUserId,
  onRefresh,
}: TimeEntriesTableProps) {
  // Date range state
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_week');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Data state
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ totalHours: 0, totalShifts: 0 });
  const [hasFetched, setHasFetched] = useState(false);

  // Edit modal state
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editBreaks, setEditBreaks] = useState<EditableBreak[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete modal state
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculate date range strings (memoized to prevent infinite loops)
  const dateRange = useMemo(() => {
    if (datePreset === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    return getDateRangeStrings(datePreset);
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch entries function
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTimeEntries({
        teamMemberId: isAdmin ? undefined : currentUserId,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      if (result.success && result.data) {
        setEntries(result.data);

        // Calculate summary
        const totalHours = result.data.reduce((sum, entry) => {
          return sum + (entry.total_paid_hours || 0);
        }, 0);
        setSummary({
          totalHours,
          totalShifts: result.data.length,
        });
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [dateRange.start, dateRange.end, isAdmin, currentUserId]);

  // Fetch on mount and when date range changes
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Navigate weeks (for this_week preset)
  const navigateWeek = (direction: 'prev' | 'next') => {
    const days = direction === 'prev' ? -7 : 7;
    const currentStart = new Date(dateRange.start + 'T00:00:00');
    const newStart = new Date(currentStart);
    newStart.setDate(newStart.getDate() + days);

    // Check if it's this week or last week
    const today = new Date();
    const thisWeekStart = getStartOfWeek(today);
    const lastWeekStart = getStartOfWeek(
      new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    );

    const newStartStr = newStart.toISOString().split('T')[0];
    const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0];
    const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];

    if (newStartStr === thisWeekStartStr) {
      setDatePreset('this_week');
    } else if (newStartStr === lastWeekStartStr) {
      setDatePreset('last_week');
    } else {
      setDatePreset('custom');
      setCustomStartDate(newStartStr);
      const newEnd = new Date(newStart);
      newEnd.setDate(newEnd.getDate() + 6);
      setCustomEndDate(newEnd.toISOString().split('T')[0]);
    }
  };

  // Handle preset change
  const handlePresetChange = (value: DateRangePreset) => {
    if (value === 'custom') {
      setShowCustomPicker(true);
      // Initialize custom dates with current range
      setCustomStartDate(dateRange.start);
      setCustomEndDate(dateRange.end);
    } else {
      setShowCustomPicker(false);
      setDatePreset(value);
    }
  };

  // Apply custom date range
  const applyCustomRange = () => {
    if (customStartDate && customEndDate) {
      setDatePreset('custom');
      setShowCustomPicker(false);
    }
  };

  // Open edit modal
  const openEditModal = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditClockIn(extractTimeFromTimestamp(entry.clock_in_time));
    setEditClockOut(
      entry.clock_out_time ? extractTimeFromTimestamp(entry.clock_out_time) : ''
    );
    // Convert ISO timestamps to HH:MM format for breaks
    const formattedBreaks: EditableBreak[] = (entry.breaks || []).map(
      (brk) => ({
        start: extractTimeFromTimestamp(brk.start),
        end: brk.end ? extractTimeFromTimestamp(brk.end) : '',
      })
    );
    setEditBreaks(formattedBreaks);
    setEditNotes(entry.notes || '');
    setEditError(null);
  };

  // Add a new break
  const handleAddBreak = () => {
    const newBreak: EditableBreak = { start: '', end: '' };
    setEditBreaks([...editBreaks, newBreak]);
  };

  // Update a break
  const handleUpdateBreak = (
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    const updated = [...editBreaks];
    updated[index] = { ...updated[index], [field]: value };
    setEditBreaks(updated);
  };

  // Remove a break
  const handleRemoveBreak = (index: number) => {
    setEditBreaks(editBreaks.filter((_, i) => i !== index));
  };

  // Save edited entry
  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    // Validation
    if (!editClockIn) {
      setEditError('Clock in time is required');
      return;
    }

    if (editClockOut && editClockIn >= editClockOut) {
      setEditError('Clock out must be after clock in');
      return;
    }

    // Validate breaks
    for (let i = 0; i < editBreaks.length; i++) {
      const brk = editBreaks[i];
      if (!brk.start || !brk.end) {
        setEditError(`Break ${i + 1}: Both start and end times are required`);
        return;
      }
      if (brk.start >= brk.end) {
        setEditError(`Break ${i + 1}: End time must be after start time`);
        return;
      }
      // Check break is within shift times
      if (brk.start < editClockIn) {
        setEditError(`Break ${i + 1}: Cannot start before clock in`);
        return;
      }
      if (editClockOut && brk.end > editClockOut) {
        setEditError(`Break ${i + 1}: Cannot end after clock out`);
        return;
      }
    }

    setIsSaving(true);
    setEditError(null);

    try {
      const clockInTimestamp = combineDateTime(
        editingEntry.shift_date,
        editClockIn
      );
      const clockOutTimestamp = editClockOut
        ? combineDateTime(editingEntry.shift_date, editClockOut)
        : undefined;

      // Convert breaks back to ISO timestamps
      const breaksWithTimestamps = editBreaks
        .filter((brk) => brk.start && brk.end) // Only include complete breaks
        .map((brk) => ({
          start: combineDateTime(editingEntry.shift_date, brk.start),
          end: combineDateTime(editingEntry.shift_date, brk.end),
        }));

      const result = await updateTimeEntry(editingEntry.id, {
        clock_in_time: clockInTimestamp,
        clock_out_time: clockOutTimestamp,
        breaks: breaksWithTimestamps,
        notes: editNotes || undefined,
      });

      if (result.success) {
        setEditingEntry(null);
        fetchEntries();
        onRefresh?.();
      } else {
        setEditError(result.error || 'Failed to update entry');
      }
    } catch (error) {
      setEditError(`${error} An unexpected error occurred`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete entry
  const handleDelete = async () => {
    if (!deletingEntry) return;

    setIsDeleting(true);

    try {
      const result = await deleteTimeEntry(deletingEntry.id);

      if (result.success) {
        setDeletingEntry(null);
        fetchEntries();
        onRefresh?.();
      } else {
        alert(result.error || 'Failed to delete entry');
      }
    } catch (error) {
      alert(`${error} An unexpected error occurred`);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'clocked_in':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
        );
      case 'on_break':
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600">On Break</Badge>
        );
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatHours = (hours: number | null) => {
    if (hours === null) return '-';
    return `${hours.toFixed(2)}h`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Shift History
              </CardTitle>
              <CardDescription>
                {isAdmin ? 'All team member shifts' : 'Your shift history'}
              </CardDescription>
            </div>

            {/* Date Range Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Week Navigation (when viewing weeks) */}
              {(datePreset === 'this_week' ||
                datePreset === 'last_week' ||
                datePreset === 'custom') && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigateWeek('prev')}
                    disabled={loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigateWeek('next')}
                    disabled={loading || datePreset === 'this_week'}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Preset Selector */}
              <Select
                value={datePreset}
                onValueChange={(v) => handlePresetChange(v as DateRangePreset)}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  fetchEntries();
                  onRefresh?.();
                }}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>

          {/* Custom Date Picker */}
          {showCustomPicker && (
            <div className="flex flex-wrap items-center gap-2 mt-4 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Button size="sm" onClick={applyCustomRange}>
                Apply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCustomPicker(false);
                  setDatePreset('this_week');
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Date Range Display & Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">
                {formatDateRange(dateRange.start, dateRange.end)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Shifts:</span>
                <span className="font-semibold text-gray-900">
                  {summary.totalShifts}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Total Hours:</span>
                <span className="font-semibold text-blue-600">
                  {summary.totalHours.toFixed(2)}h
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading || !hasFetched ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No shifts found for this period</p>
              <p className="text-sm">Try selecting a different date range</p>
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
                    <TableHead>Break</TableHead>
                    <TableHead>Paid Hours</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatDate(entry.shift_date)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="whitespace-nowrap">
                              {entry.users.first_name}{' '}
                              {entry.users.last_name || ''}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="whitespace-nowrap">
                            {entry.venues.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(entry.clock_in_time)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {entry.clock_out_time
                          ? formatTime(entry.clock_out_time)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {entry.total_break_minutes > 0
                          ? `${entry.total_break_minutes}m`
                          : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.status === 'completed' ? (
                          <span
                            className={
                              (entry.total_paid_hours || 0) > 12
                                ? 'text-red-600'
                                : 'text-gray-900'
                            }
                          >
                            {formatHours(entry.total_paid_hours)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEditModal(entry)}
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit Times
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeletingEntry(entry)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
            <DialogDescription>
              {editingEntry && (
                <>
                  {editingEntry.users.first_name}{' '}
                  {editingEntry.users.last_name || ''} •{' '}
                  {formatDate(editingEntry.shift_date)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Clock In Time */}
            <div className="grid gap-2">
              <Label htmlFor="clock-in">Clock In Time</Label>
              <Input
                id="clock-in"
                type="time"
                value={editClockIn}
                onChange={(e) => setEditClockIn(e.target.value)}
              />
            </div>

            {/* Clock Out Time */}
            <div className="grid gap-2">
              <Label htmlFor="clock-out">Clock Out Time</Label>
              <Input
                id="clock-out"
                type="time"
                value={editClockOut}
                onChange={(e) => setEditClockOut(e.target.value)}
                placeholder="Leave empty if still active"
              />
              <p className="text-xs text-gray-500">
                Leave empty if the shift is still active
              </p>
            </div>

            {/* Breaks Section */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Breaks</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddBreak}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Break
                </Button>
              </div>

              {editBreaks.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No breaks recorded</p>
              ) : (
                <div className="space-y-2">
                  {editBreaks.map((brk, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <span className="text-xs text-gray-500 w-16">
                        Break {index + 1}
                      </span>
                      <Input
                        type="time"
                        value={brk.start}
                        onChange={(e) =>
                          handleUpdateBreak(index, 'start', e.target.value)
                        }
                        className="h-8 text-sm flex-1"
                      />
                      <span className="text-gray-400">→</span>
                      <Input
                        type="time"
                        value={brk.end}
                        onChange={(e) =>
                          handleUpdateBreak(index, 'end', e.target.value)
                        }
                        className="h-8 text-sm flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBreak(index)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500">
                Edit break start and end times. Breaks will be used to calculate
                paid hours.
              </p>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add any notes about this correction..."
                rows={3}
              />
            </div>

            {/* Error Message */}
            {editError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {editError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingEntry(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={!!deletingEntry}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Shift Entry
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this shift entry? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deletingEntry && (
            <div className="py-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Staff:</span>
                <span className="font-medium">
                  {deletingEntry.users.first_name}{' '}
                  {deletingEntry.users.last_name || ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span className="font-medium">
                  {formatDate(deletingEntry.shift_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Clock In:</span>
                <span className="font-medium">
                  {formatTime(deletingEntry.clock_in_time)}
                </span>
              </div>
              {deletingEntry.clock_out_time && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Clock Out:</span>
                  <span className="font-medium">
                    {formatTime(deletingEntry.clock_out_time)}
                  </span>
                </div>
              )}
              {deletingEntry.total_paid_hours !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid Hours:</span>
                  <span className="font-medium">
                    {formatHours(deletingEntry.total_paid_hours)}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingEntry(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Shift'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
