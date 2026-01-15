// components/admin/calendar/team-member-header-popover.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, Clock, Ban } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SingleShiftModal } from '@/components/admin/team/single-shift-modal';
import { BlockedTimeModal } from './blocked-time-modal';
import Image from 'next/image';

interface ExistingShift {
  id: string;
  start_time: string;
  end_time: string;
  notes: string | null;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

interface TeamMemberHeaderPopoverProps {
  member: TeamMember;
  currentDate: string;
  venueId: string;
  venueName: string;
  shifts: Array<{
    team_member_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    id?: string;
    notes?: string | null;
  }>;
  onRefresh: () => void;
}

export function TeamMemberHeaderPopover({
  member,
  currentDate,
  venueId,
  venueName,
  shifts,
  onRefresh,
}: TeamMemberHeaderPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showBlockedTimeModal, setShowBlockedTimeModal] = useState(false);

  const memberName = `${member.first_name} ${member.last_name}`;

  // Find existing shift for this team member on the current date
  const shiftForDate = shifts.find(
    (s) => s.team_member_id === member.id && s.shift_date === currentDate
  );

  // Convert to the format SingleShiftModal expects
  const existingShift: ExistingShift | null = shiftForDate?.id
    ? {
        id: shiftForDate.id,
        start_time: shiftForDate.start_time,
        end_time: shiftForDate.end_time,
        notes: shiftForDate.notes ?? null,
      }
    : null;

  const handleEditShift = () => {
    setIsOpen(false);
    setShowShiftModal(true);
  };

  const handleAddBlockedTime = () => {
    setIsOpen(false);
    setShowBlockedTimeModal(true);
  };

  const handleShiftSuccess = () => {
    setShowShiftModal(false);
    onRefresh();
  };

  const handleBlockedTimeSuccess = () => {
    setShowBlockedTimeModal(false);
    onRefresh();
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button className="flex flex-col items-center gap-2 w-full hover:bg-gray-100 rounded-lg p-2 transition-colors group">
            {/* Photo */}
            <div className="flex-shrink-0 relative">
              {member.photo_url ? (
                <Image
                  src={member.photo_url}
                  alt={memberName}
                  width={48}
                  height={48}
                  className="rounded-full object-cover ring-2 ring-transparent group-hover:ring-purple-200 transition-all"
                  style={{ width: '48px', height: '48px' }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center ring-2 ring-transparent group-hover:ring-purple-200 transition-all">
                  <span className="text-sm font-semibold text-white">
                    {member.first_name[0]}
                    {member.last_name[0]}
                  </span>
                </div>
              )}
            </div>

            {/* Name with dropdown indicator */}
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {member.first_name}
              </p>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-56 p-0" align="center">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-medium text-gray-900">{memberName}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {existingShift
                ? `Shift: ${existingShift.start_time.substring(
                    0,
                    5
                  )} - ${existingShift.end_time.substring(0, 5)}`
                : 'No shift scheduled'}
            </p>
          </div>

          {/* Actions */}
          <div className="p-2">
            <p className="px-2 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Actions
            </p>

            <button
              onClick={handleEditShift}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
            >
              <Clock className="h-4 w-4 text-gray-400" />
              <span>Edit Shift</span>
            </button>

            <button
              onClick={handleAddBlockedTime}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
            >
              <Ban className="h-4 w-4 text-gray-400" />
              <span>Add blocked time</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Single Shift Modal */}
      {showShiftModal && (
        <SingleShiftModal
          isOpen={showShiftModal}
          onClose={() => setShowShiftModal(false)}
          teamMemberId={member.id}
          teamMemberName={memberName}
          venueId={venueId}
          venueName={venueName}
          date={currentDate}
          existingShift={existingShift}
          onSuccess={handleShiftSuccess}
        />
      )}

      {/* Blocked Time Modal */}
      {showBlockedTimeModal && (
        <BlockedTimeModal
          isOpen={showBlockedTimeModal}
          onClose={() => setShowBlockedTimeModal(false)}
          teamMemberId={member.id}
          teamMemberName={memberName}
          venueId={venueId}
          venueName={venueName}
          date={currentDate}
          defaultStartTime="09:00"
          existingBlockedTime={null}
          onSuccess={handleBlockedTimeSuccess}
        />
      )}
    </>
  );
}
