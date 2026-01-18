// components/public/venue/venue-team-section.tsx
'use client';

import Image from 'next/image';
import { Star } from 'lucide-react';
import type { PublicTeamMember } from '@/app/actions/public-venue';

interface VenueTeamSectionProps {
  teamMembers: PublicTeamMember[];
}

function TeamMemberCard({ member }: { member: PublicTeamMember }) {
  const initial = member.first_name.charAt(0).toUpperCase();
  const hasRating = member.total_reviews > 0;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar */}
      <div className="relative mb-2">
        <div className="w-28 h-28 rounded-full overflow-hidden bg-purple-100 flex items-center justify-center">
          {member.photo_url ? (
            <Image
              src={member.photo_url}
              alt={`${member.first_name} ${member.last_name || ''}`}
              fill
              className="object-cover"
            />
          ) : (
            <span className="text-4xl font-semibold text-purple-500">
              {initial}
            </span>
          )}
        </div>

        {/* Rating Badge */}
        {hasRating && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white rounded-full px-2.5 py-1 shadow-md border border-gray-100 flex items-center gap-1">
            <span className="text-sm font-medium text-gray-900">
              {member.average_rating.toFixed(1)}
            </span>
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
          </div>
        )}
      </div>

      {/* Name */}
      <h3 className="font-semibold text-gray-900 mt-2">{member.first_name}</h3>
    </div>
  );
}

export function VenueTeamSection({ teamMembers }: VenueTeamSectionProps) {
  if (teamMembers.length === 0) {
    return null;
  }

  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Team</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {teamMembers.map((member) => (
          <TeamMemberCard key={member.id} member={member} />
        ))}
      </div>
    </section>
  );
}
