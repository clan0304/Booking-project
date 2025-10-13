// components/admin/team/assign-venue-modal.tsx
'use client';

import { useState } from 'react';
import { X, Search, User, UserCheck } from 'lucide-react';
import {
  bulkAssignTeamMembers,
  bulkUnassignTeamMembers,
} from '@/app/actions/team-venue-assignments';
import Image from 'next/image';

interface TeamMemberOption {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  email: string;
}

interface AssignVenueModalProps {
  venueId: string;
  venueName: string;
  allTeamMembers: TeamMemberOption[];
  assignedMemberIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignVenueModal({
  venueId,
  venueName,
  allTeamMembers,
  assignedMemberIds,
  onClose,
  onSuccess,
}: AssignVenueModalProps) {
  // Initialize with already-assigned members
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(assignedMemberIds)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const filteredMembers = allTeamMembers.filter((member) => {
    const fullName = `${member.first_name} ${
      member.last_name || ''
    }`.toLowerCase();
    const email = member.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const selectedArray = Array.from(selectedIds);

      // Find members to assign (newly selected)
      const toAssign = selectedArray.filter(
        (id) => !assignedMemberIds.includes(id)
      );

      // Find members to unassign (previously selected, now unchecked)
      const toUnassign = assignedMemberIds.filter((id) => !selectedIds.has(id));

      console.log('Assignment changes:', {
        toAssign: toAssign.length,
        toUnassign: toUnassign.length,
        selected: selectedArray.length,
        previouslyAssigned: assignedMemberIds.length,
      });

      // Unassign removed members FIRST
      if (toUnassign.length > 0) {
        console.log('Unassigning members:', toUnassign);
        const unassignResult = await bulkUnassignTeamMembers(
          toUnassign,
          venueId
        );

        if (!unassignResult.success) {
          console.error('Unassign failed:', unassignResult.error);
          setError(unassignResult.error || 'Failed to unassign members');
          setIsSubmitting(false);
          return;
        }
        console.log('Unassign successful');
      }

      // Assign new members
      if (toAssign.length > 0) {
        console.log('Assigning members:', toAssign);
        const assignResult = await bulkAssignTeamMembers(toAssign, venueId);

        if (!assignResult.success) {
          console.error('Assign failed:', assignResult.error);
          setError(assignResult.error || 'Failed to assign members');
          setIsSubmitting(false);
          return;
        }
        console.log('Assign successful');
      }

      // Success - refresh and close
      console.log('All assignment changes completed successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating assignments:', error);
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Assign Team Members
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Select team members to assign to {venueName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search and Select All */}
        <div className="p-6 border-b border-gray-200 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Select All */}
          {filteredMembers.length > 0 && (
            <div className="flex items-center justify-between">
              <button
                onClick={handleSelectAll}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                {selectedIds.size === filteredMembers.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              <span className="text-sm text-gray-600">
                {selectedIds.size} selected
              </span>
            </div>
          )}
        </div>

        {/* Team Member List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">
                {allTeamMembers.length === 0
                  ? 'No team members found'
                  : 'No team members match your search'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => {
                const isSelected = selectedIds.has(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => handleToggle(member.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`flex items-center justify-center h-5 w-5 rounded border-2 transition-colors ${
                        isSelected
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <UserCheck className="h-3 w-3 text-white" />
                      )}
                    </div>

                    {/* Avatar */}
                    {member.photo_url ? (
                      <div className="relative h-10 w-10 rounded-full overflow-hidden bg-gray-200">
                        <Image
                          src={member.photo_url}
                          alt={member.first_name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-200 text-gray-600 font-medium">
                        {member.first_name[0]}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">
                        {member.first_name} {member.last_name || ''}
                      </div>
                      <div className="text-sm text-gray-500">
                        {member.email}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Updating...' : 'Update Assignments'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
