// components/public/bookings/team-member-selection.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { User, Users, Search, ArrowLeft } from 'lucide-react';
import type {
  Service,
  TeamMember,
  SelectedAppointment,
} from '@/types/bookings';

interface TeamMemberSelectionProps {
  teamMembers: TeamMember[];
  services: Service[];
  appointments: SelectedAppointment[];
  onSelect: (appointments: SelectedAppointment[]) => void;
  onBack: () => void;
}

type SelectionMode = 'choice' | 'search';

export function TeamMemberSelection({
  teamMembers,
  appointments,
  onSelect,
  onBack,
}: TeamMemberSelectionProps) {
  const [mode, setMode] = useState<SelectionMode>('choice');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamMember, setSelectedTeamMember] =
    useState<TeamMember | null>(null);

  // Filter team members based on search query
  const filteredTeamMembers = teamMembers.filter((member) => {
    if (!searchQuery.trim()) return false; // Don't show any until user types

    const fullName = `${member.users.first_name} ${
      member.users.last_name || ''
    }`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query);
  });

  // Handle "Any Professional" selection
  const handleAnyProfessional = () => {
    const updatedAppointments = appointments.map((appt) => ({
      ...appt,
      teamMemberId: 'any',
      teamMemberName: 'Any professional',
    }));
    onSelect(updatedAppointments);
  };

  // Handle specific team member selection
  const handleTeamMemberSelect = (teamMember: TeamMember) => {
    setSelectedTeamMember(teamMember);
  };

  // Handle Continue button click
  const handleContinue = () => {
    if (!selectedTeamMember) return;

    const updatedAppointments = appointments.map((appt) => ({
      ...appt,
      teamMemberId: selectedTeamMember.users.id,
      teamMemberName: `${selectedTeamMember.users.first_name} ${selectedTeamMember.users.last_name}`,
    }));
    onSelect(updatedAppointments);
  };

  // Get the lowest price for "Any professional" option
  const getLowestPrice = () => {
    if (appointments.length === 0) return 0;
    // Use the first appointment's price as base
    return appointments[0].price;
  };

  const lowestPrice = getLowestPrice();

  // ========================================
  // RENDER: Initial Choice (2 boxes)
  // ========================================
  if (mode === 'choice') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Choose Team Member
          </h2>
          <p className="text-gray-600">
            Select how you&apos;d like to book your appointment
          </p>
        </div>

        {/* Two Choice Boxes */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Any Professional Box */}
          <button
            onClick={handleAnyProfessional}
            className="relative text-left p-6 rounded-xl border-2 border-gray-200 hover:border-[#6C5CE7] hover:shadow-sm bg-white transition-all group"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Icon */}
              <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Users className="h-8 w-8 text-[#6C5CE7]" />
              </div>

              {/* Content */}
              <div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">
                  Any Professional
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  Maximum availability
                </p>
                <p className="text-sm font-medium text-gray-900">
                  from ${lowestPrice}
                </p>
              </div>

              {/* Select Button */}
              <div className="pt-2">
                <span className="inline-flex items-center px-6 py-2 rounded-full border-2 border-[#6C5CE7] text-sm font-medium text-[#6C5CE7] bg-white group-hover:bg-[#6C5CE7] group-hover:text-white transition-colors">
                  Select
                </span>
              </div>
            </div>
          </button>

          {/* Choose Specific Designer Box */}
          <button
            onClick={() => setMode('search')}
            className="relative text-left p-6 rounded-xl border-2 border-gray-200 hover:border-[#6C5CE7] hover:shadow-sm bg-white transition-all group"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Icon */}
              <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Search className="h-8 w-8 text-[#6C5CE7]" />
              </div>

              {/* Content */}
              <div>
                <h3 className="font-semibold text-gray-900 text-lg mb-2">
                  Choose Specific Designer
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  Pick your preferred stylist
                </p>
                <p className="text-sm font-medium text-gray-900">
                  Search by name
                </p>
              </div>

              {/* Select Button */}
              <div className="pt-2">
                <span className="inline-flex items-center px-6 py-2 rounded-full border-2 border-[#6C5CE7] text-sm font-medium text-[#6C5CE7] bg-white group-hover:bg-[#6C5CE7] group-hover:text-white transition-colors">
                  Select
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Back Button */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // RENDER: Search Interface
  // ========================================
  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            setMode('choice');
            setSearchQuery('');
            setSelectedTeamMember(null); // Reset selection
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Back to selection mode"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Search for Your Stylist
          </h2>
          <p className="text-gray-600">
            Type a name to find your preferred professional
          </p>
        </div>
      </div>

      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Start typing stylist name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:border-[#6C5CE7] focus:ring-4 focus:ring-purple-100 outline-none transition-all"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="space-y-3">
        {!searchQuery.trim() ? (
          // Empty state - no search query
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Start typing to search</p>
            <p className="text-gray-400 text-sm mt-2">
              Enter the name of your preferred stylist
            </p>
          </div>
        ) : filteredTeamMembers.length === 0 ? (
          // No results found
          <div className="text-center py-16">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No stylists found</p>
            <p className="text-gray-400 text-sm mt-2">
              Try searching with a different name
            </p>
          </div>
        ) : (
          // Show filtered results
          filteredTeamMembers.map((member) => {
            const teamMemberInfo = member.users.team_members[0];
            const price = appointments[0]?.price || 0;
            const isSelected = selectedTeamMember?.users.id === member.users.id;

            return (
              <button
                key={member.users.id}
                onClick={() => handleTeamMemberSelect(member)}
                className={`relative w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-[#6C5CE7] bg-purple-50 shadow-sm'
                    : 'border-gray-200 hover:border-[#6C5CE7] hover:shadow-sm bg-white'
                }`}
              >
                {/* Checkmark for selected */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <div className="rounded-full bg-[#6C5CE7] p-1">
                      <svg
                        className="h-4 w-4 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4 pr-12">
                  {/* Profile Photo */}
                  <div className="flex-shrink-0">
                    {member.users.photo_url ? (
                      <div className="relative h-14 w-14 rounded-full overflow-hidden bg-gray-100">
                        <Image
                          src={member.users.photo_url}
                          alt={member.users.first_name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                        <span className="text-lg font-semibold text-white">
                          {member.users.first_name[0]}
                          {member.users.last_name?.[0] || ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 text-base">
                        {member.users.first_name} {member.users.last_name}
                      </h4>
                      {/* Rating placeholder - empty for now */}
                    </div>
                    {teamMemberInfo?.position && (
                      <p className="text-sm text-gray-600 mb-1">
                        {teamMemberInfo.position}
                      </p>
                    )}
                    <p className="text-sm font-medium text-gray-900">
                      from ${price}
                    </p>
                    {/* View Profile Link - styled but non-functional for now */}
                    <span className="text-sm text-gray-900 hover:underline mt-1 inline-block cursor-pointer">
                      View profile
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedTeamMember}
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
