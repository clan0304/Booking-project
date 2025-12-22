// components/admin/calendar/team-member-reorder-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { updateTeamMemberOrder } from '@/app/actions/team-venue-assignments';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

interface TeamMemberReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  venueId: string;
  venueName: string;
  teamMembers: TeamMember[];
  onSuccess: () => void;
}

export function TeamMemberReorderModal({
  isOpen,
  onClose,
  venueId,
  venueName,
  teamMembers,
  onSuccess,
}: TeamMemberReorderModalProps) {
  const [orderedMembers, setOrderedMembers] = useState<TeamMember[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Initialize ordered members when modal opens
  useEffect(() => {
    if (isOpen && teamMembers) {
      setOrderedMembers([...teamMembers]);
      setError(null);
    }
  }, [isOpen, teamMembers]);

  // Check if order has changed
  const hasChanges = () => {
    if (!teamMembers || !orderedMembers) return false;
    if (orderedMembers.length !== teamMembers.length) return true;
    return orderedMembers.some(
      (member, index) => member.id !== teamMembers[index]?.id
    );
  };

  // Move member up
  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newOrder = [...orderedMembers];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    setOrderedMembers(newOrder);
  };

  // Move member down
  const moveDown = (index: number) => {
    if (index >= orderedMembers.length - 1) return;
    const newOrder = [...orderedMembers];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    setOrderedMembers(newOrder);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...orderedMembers];
    const [draggedMember] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedMember);
    setOrderedMembers(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Save order
  const handleSave = async () => {
    if (!hasChanges()) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const orderedIds = orderedMembers.map((m) => m.id);
      const result = await updateTeamMemberOrder(venueId, orderedIds);

      if (!result.success) {
        setError(result.error || 'Failed to save order');
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving order:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to original order
  const handleReset = () => {
    setOrderedMembers([...teamMembers]);
  };

  if (!isOpen) return null;

  // Safety check for undefined teamMembers
  if (!teamMembers) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Reorder Team Members
              </h2>
              <p className="text-sm text-gray-500">{venueName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              Drag and drop or use arrows to reorder. This affects the calendar
              column order.
            </p>
          </div>

          {/* Team Members List */}
          <div className="flex-1 overflow-y-auto p-4">
            {orderedMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No team members assigned to this venue
              </div>
            ) : (
              <div className="space-y-2">
                {orderedMembers.map((member, index) => (
                  <div
                    key={member.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                      ${
                        draggedIndex === index
                          ? 'opacity-50 border-purple-300 bg-purple-50'
                          : dragOverIndex === index
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                      cursor-grab active:cursor-grabbing
                    `}
                  >
                    {/* Drag Handle */}
                    <div className="text-gray-400 hover:text-gray-600">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    {/* Position Number */}
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {index + 1}
                      </span>
                    </div>

                    {/* Avatar */}
                    {member.photo_url ? (
                      <Image
                        src={member.photo_url}
                        alt={`${member.first_name} ${member.last_name}`}
                        width={36}
                        height={36}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-sm">
                          {member.first_name[0]}
                          {member.last_name[0]}
                        </span>
                      </div>
                    )}

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {member.first_name} {member.last_name}
                      </p>
                    </div>

                    {/* Up/Down Arrows */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveUp(index);
                        }}
                        disabled={index === 0}
                        className={`p-1 rounded transition-colors ${
                          index === 0
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveDown(index);
                        }}
                        disabled={index === orderedMembers.length - 1}
                        className={`p-1 rounded transition-colors ${
                          index === orderedMembers.length - 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleReset}
                disabled={!hasChanges() || isSaving}
                className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges() || isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Order'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
