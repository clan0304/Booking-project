'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Loader2,
  Clock,
  DollarSign,
  Calendar,
  FileText,
} from 'lucide-react';
import {
  TimeClockPanel,
  ActiveShiftDisplay,
  TimeEntriesTable,
  LongRunningAlert,
  PayRatesTab,
  PublicHolidaysManager,
  PayrollReportsTab,
} from '@/components/admin/staff-management';
import {
  getActiveShift,
  getTimeEntries,
  getLongRunningShifts,
} from '@/app/actions/staff-management';
import Image from 'next/image';

// =====================================================
// TYPES
// =====================================================

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
}

interface Venue {
  id: string;
  name: string;
}

interface CurrentUser {
  id: string;
  isAdmin: boolean;
  isTeamMember: boolean;
}

interface ActiveShift {
  id: string;
  venue_id: string;
  venue_name: string;
  clock_in_time: string;
  status: 'clocked_in' | 'on_break';
  current_break_start: string | null;
  breaks: Array<{ start: string; end: string | null }>;
}

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

// =====================================================
// COMPONENT
// =====================================================

interface StaffManagementClientProps {
  currentUser: CurrentUser;
  teamMembers: TeamMember[];
  venues: Venue[];
}

export function StaffManagementClient({
  currentUser,
  teamMembers,
  venues,
}: StaffManagementClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('time-tracking');
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    currentUser.isTeamMember && !currentUser.isAdmin ? currentUser.id : ''
  );
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [longRunningShifts, setLongRunningShifts] = useState<
    LongRunningShift[]
  >([]);
  const [loading, setLoading] = useState(false);

  const selectedStaff = teamMembers.find((m) => m.id === selectedStaffId);

  const fetchData = useCallback(async () => {
    if (!selectedStaffId) return;

    setLoading(true);

    const shiftResult = await getActiveShift(selectedStaffId);
    if (shiftResult.success && shiftResult.data) {
      setActiveShift(shiftResult.data);
    } else {
      setActiveShift(null);
    }

    const entriesResult = await getTimeEntries({
      teamMemberId: currentUser.isAdmin ? selectedStaffId : undefined,
      limit: 50,
    });
    if (entriesResult.success && entriesResult.data) {
      setTimeEntries(entriesResult.data);
    }

    if (currentUser.isAdmin) {
      const longResult = await getLongRunningShifts(12);
      if (longResult.success && longResult.data) {
        setLongRunningShifts(longResult.data);
      }
    }

    setLoading(false);
  }, [selectedStaffId, currentUser.isAdmin]);

  useEffect(() => {
    if (activeTab === 'time-tracking') {
      fetchData();
    }
  }, [fetchData, activeTab]);

  const handleRefresh = () => {
    router.refresh();
    fetchData();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Staff Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage time tracking, pay rates, and payroll
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid w-full ${
            currentUser.isAdmin ? 'grid-cols-4' : 'grid-cols-1'
          }`}
        >
          <TabsTrigger
            value="time-tracking"
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Time Tracking
          </TabsTrigger>
          {/* Admin-only tabs */}
          {currentUser.isAdmin && (
            <>
              <TabsTrigger
                value="pay-rates"
                className="flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Pay Rates
              </TabsTrigger>
              <TabsTrigger value="holidays" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Public Holidays
              </TabsTrigger>
              <TabsTrigger value="payroll" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Payroll Reports
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* TIME TRACKING TAB */}
        <TabsContent value="time-tracking" className="space-y-6 mt-6">
          {/* Staff Member Selector (Kiosk Mode) */}
          {currentUser.isAdmin && (
            <Card className="border-2 border-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Select Staff Member
                </CardTitle>
                <CardDescription>
                  Choose who is clocking in/out (Kiosk Mode)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedStaffId}
                  onValueChange={setSelectedStaffId}
                >
                  <SelectTrigger className="text-lg h-12">
                    <SelectValue placeholder="Choose a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          {member.photo_url ? (
                            <Image
                              src={member.photo_url}
                              alt={member.first_name}
                              className="w-6 h-6 rounded-full"
                              width={6}
                              height={6}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                              {member.first_name[0]}
                            </div>
                          )}
                          <span className="font-medium">
                            {member.first_name} {member.last_name || ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Show content only if staff member is selected */}
          {!selectedStaffId ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <User className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">
                  Please select a team member to continue
                </p>
                <p className="text-sm mt-2">
                  Choose your name from the dropdown above
                </p>
              </CardContent>
            </Card>
          ) : loading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin" />
                <p className="text-lg font-medium">Loading shift data...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Selected Staff Display */}
              {selectedStaff && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  {selectedStaff.photo_url ? (
                    <Image
                      src={selectedStaff.photo_url}
                      alt={selectedStaff.first_name}
                      className="w-12 h-12 rounded-full"
                      width={12}
                      height={12}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                      {selectedStaff.first_name[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-lg">
                      {selectedStaff.first_name} {selectedStaff.last_name || ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Currently selected for time tracking
                    </p>
                  </div>
                </div>
              )}

              {/* Long Running Shifts Alert (Admin Only) */}
              {currentUser.isAdmin && longRunningShifts.length > 0 && (
                <LongRunningAlert shifts={longRunningShifts} />
              )}

              {/* Time Clock Section */}
              <div className="grid gap-6 md:grid-cols-2">
                {activeShift ? (
                  <ActiveShiftDisplay
                    shift={activeShift}
                    onUpdate={handleRefresh}
                    selectedStaffId={selectedStaffId}
                  />
                ) : (
                  <TimeClockPanel
                    venues={venues}
                    onClockIn={handleRefresh}
                    selectedStaffId={selectedStaffId}
                  />
                )}
              </div>

              {/* Time Entries Table */}
              <TimeEntriesTable
                entries={timeEntries}
                isAdmin={currentUser.isAdmin}
                currentUserId={selectedStaffId}
              />
            </>
          )}
        </TabsContent>

        {/* PAY RATES TAB */}
        <TabsContent value="pay-rates" className="space-y-6 mt-6">
          <PayRatesTab teamMembers={teamMembers} />
        </TabsContent>

        {/* PUBLIC HOLIDAYS TAB */}
        <TabsContent value="holidays" className="space-y-6 mt-6">
          <PublicHolidaysManager />
        </TabsContent>

        {/* PAYROLL REPORTS TAB */}
        <TabsContent value="payroll" className="space-y-6 mt-6">
          <PayrollReportsTab teamMembers={teamMembers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
