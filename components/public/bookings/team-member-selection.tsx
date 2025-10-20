// components/public/bookings/team-member-selection.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { User, Check } from 'lucide-react';
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

export function TeamMemberSelection({
  teamMembers,
  appointments,
  onSelect,
  onBack,
}: TeamMemberSelectionProps) {
  const [selections, setSelections] = useState<Record<string, string>>(
    appointments.reduce((acc, appt) => {
      acc[appt.serviceId] = appt.teamMemberId;
      return acc;
    }, {} as Record<string, string>)
  );

  const handleTeamMemberSelect = (serviceId: string, teamMemberId: string) => {
    setSelections((prev) => ({
      ...prev,
      [serviceId]: teamMemberId,
    }));
  };

  const handleContinue = () => {
    const updatedAppointments = appointments.map((appt) => {
      const teamMemberId = selections[appt.serviceId];
      const teamMember = teamMembers.find((tm) => tm.users.id === teamMemberId);

      return {
        ...appt,
        teamMemberId,
        teamMemberName: teamMember
          ? `${teamMember.users.first_name} ${teamMember.users.last_name}`
          : '',
      };
    });

    onSelect(updatedAppointments);
  };

  const allSelected = appointments.every((appt) => selections[appt.serviceId]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Team Members
        </h2>
        <p className="text-gray-600">
          Select who you&apos;d like to perform each service
        </p>
      </div>

      {/* Service-wise Team Member Selection */}
      <div className="space-y-6">
        {appointments.map((appointment, index) => (
          <div
            key={appointment.serviceId}
            className="border border-gray-200 rounded-xl p-6 bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900 mb-4">
              {index + 1}. {appointment.serviceName}
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teamMembers.map((member) => {
                const isSelected =
                  selections[appointment.serviceId] === member.users.id;
                const teamMemberInfo = member.users.team_members[0];

                return (
                  <button
                    key={member.users.id}
                    onClick={() =>
                      handleTeamMemberSelect(
                        appointment.serviceId,
                        member.users.id
                      )
                    }
                    className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#6C5CE7] bg-white'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="rounded-full bg-[#6C5CE7] p-1">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-2">
                      {member.users.photo_url ? (
                        <div className="relative h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                          <Image
                            src={member.users.photo_url}
                            alt={member.users.first_name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-500" />
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {member.users.first_name} {member.users.last_name}
                        </h4>
                        {teamMemberInfo?.position && (
                          <p className="text-sm text-gray-600">
                            {teamMemberInfo.position}
                          </p>
                        )}
                      </div>
                    </div>

                    {teamMemberInfo?.specialties &&
                      teamMemberInfo.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {teamMemberInfo.specialties
                            .slice(0, 2)
                            .map((specialty, i) => (
                              <span
                                key={i}
                                className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded"
                              >
                                {specialty}
                              </span>
                            ))}
                        </div>
                      )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
          disabled={!allSelected}
          className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
