// components/admin/team/team-list-client.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, UserPlus, Power, UserX, Edit } from 'lucide-react';
import {
  toggleTeamMemberStatus,
  removeTeamMember,
} from '@/app/actions/team-members';
import { TeamMemberModal } from './team-member-modal';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  photo_url: string | null;
  roles: string[];
  is_registered: boolean;
  team_members?: {
    position: string | null;
    bio: string | null;
    is_active: boolean;
    hire_date: string | null;
  } | null; // ← OBJECT, not array!
}

// Type for modal data (flatter structure)
interface TeamMemberModalData {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  photo_url: string | null;
  position: string | null;
  bio: string | null;
}

interface TeamListClientProps {
  initialTeamMembers: TeamMember[];
}

export function TeamListClient({ initialTeamMembers }: TeamListClientProps) {
  const router = useRouter();
  const [teamMembers] = useState(initialTeamMembers);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal state - using the flatter type
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedMember, setSelectedMember] =
    useState<TeamMemberModalData | null>(null);

  // Filter team members
  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      member.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());

    // team_members is an object, not array
    const teamMember = member.team_members || null;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && teamMember?.is_active) ||
      (filterStatus === 'inactive' && !teamMember?.is_active);

    return matchesSearch && matchesStatus;
  });

  const handleAddClick = () => {
    setModalMode('add');
    setSelectedMember(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (member: TeamMember) => {
    setModalMode('edit');
    setSelectedMember({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      phone_number: member.phone_number,
      photo_url: member.photo_url,
      position: member.team_members?.position || null,
      bio: member.team_members?.bio || null,
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    setActionLoading(userId);
    const result = await toggleTeamMemberStatus(userId, !currentStatus);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to update status');
    }

    setActionLoading(null);
  };

  const handleRemove = async (userId: string, name: string) => {
    if (
      confirm(`Remove ${name} from team? They will lose team member access.`)
    ) {
      return;
    }

    setActionLoading(userId);
    const result = await removeTeamMember(userId);

    if (result.success) {
      router.refresh();
    } else {
      window.alert('Failed to remove team member');
    }

    setActionLoading(null);
  };

  const activeCount = teamMembers.filter(
    (m) => m.team_members?.is_active
  ).length;
  const inactiveCount = teamMembers.length - activeCount;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your salon team members
            </p>
          </div>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            <UserPlus className="h-4 w-4" />
            Add Team Member
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Total Members</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {teamMembers.length}
            </p>
          </div>
          <div className="rounded-xl bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-700">Active</p>
            <p className="mt-1 text-2xl font-bold text-green-900">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Inactive</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {inactiveCount}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === 'active'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === 'inactive'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Team Members List */}
        {filteredMembers.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-12 text-center">
            <p className="text-gray-600">No team members found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member) => {
              const teamMember = member.team_members || null;
              const isLoading = actionLoading === member.id;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-xl bg-white p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Photo */}
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                      {member.photo_url ? (
                        <Image
                          src={member.photo_url}
                          alt={member.first_name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-600 font-semibold">
                          {member.first_name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {member.first_name} {member.last_name}
                        </h3>
                        {teamMember?.is_active ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            Inactive
                          </span>
                        )}
                        {!member.is_registered && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            Unregistered
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                        <span>{member.email}</span>
                        {teamMember?.position && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span>{teamMember.position}</span>
                          </>
                        )}
                        {member.phone_number && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span>{member.phone_number}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditClick(member)}
                      disabled={isLoading}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>

                    {/* Status Toggle Button */}
                    {teamMember?.is_active ? (
                      <button
                        onClick={() => handleToggleStatus(member.id, true)}
                        disabled={isLoading}
                        className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50 flex items-center gap-2"
                        title="Deactivate this team member"
                      >
                        <Power className="h-4 w-4" />
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(member.id, false)}
                        disabled={isLoading}
                        className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 flex items-center gap-2"
                        title="Activate this team member"
                      >
                        <Power className="h-4 w-4" />
                        Activate
                      </button>
                    )}

                    <button
                      onClick={() =>
                        handleRemove(
                          member.id,
                          `${member.first_name} ${member.last_name || ''}`
                        )
                      }
                      disabled={isLoading}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
                    >
                      <UserX className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Privacy Notice */}
        <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-1">
            🔒 Privacy Protection Active
          </p>
          <p className="text-xs text-blue-700">
            Only <strong>first names</strong> and <strong>photos</strong> are
            exposed on the public booking page via{' '}
            <code className="bg-blue-100 px-1 rounded">/api/public/team</code>.
            All other information shown here (email, phone, last name) is
            admin-only and protected.
          </p>
        </div>
      </div>

      {/* Modal */}
      <TeamMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        teamMember={selectedMember || undefined}
      />
    </>
  );
}
