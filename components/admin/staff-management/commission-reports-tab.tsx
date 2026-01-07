// components/admin/staff-management/commission-reports-tab.tsx
'use client';

import { useState } from 'react';
import { DollarSign, TrendingUp, Eye } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { CommissionReportModal } from './commission-report-modal';
import { CLIENT_TYPE_CONFIG } from '@/lib/client-type-config';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
}

interface CommissionReportsTabProps {
  teamMembers: TeamMember[];
}

export function CommissionReportsTab({
  teamMembers,
}: CommissionReportsTabProps) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5" />
            Commission Reports
          </CardTitle>
          <CardDescription className="text-white/80">
            View commission earnings by team member based on services performed
            and client types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm text-white/70">Type A (New)</p>
              <p className="text-2xl font-bold">
                {Math.round(CLIENT_TYPE_CONFIG.A.commission * 100)}%
              </p>
              <p className="text-xs text-white/60">
                {CLIENT_TYPE_CONFIG.A.description}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm text-white/70">Type B (Regular)</p>
              <p className="text-2xl font-bold">
                {Math.round(CLIENT_TYPE_CONFIG.B.commission * 100)}%
              </p>
              <p className="text-xs text-white/60">
                {CLIENT_TYPE_CONFIG.B.description}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm text-white/70">Type B+ (Requested)</p>
              <p className="text-2xl font-bold">
                {Math.round(CLIENT_TYPE_CONFIG['B+'].commission * 100)}%
              </p>
              <p className="text-xs text-white/60">
                {CLIENT_TYPE_CONFIG['B+'].description}
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm text-white/70">Type C (Salon)</p>
              <p className="text-2xl font-bold">
                {Math.round(CLIENT_TYPE_CONFIG.C.commission * 100)}%
              </p>
              <p className="text-xs text-white/60">
                {CLIENT_TYPE_CONFIG.C.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            Select a team member to view their commission report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {member.photo_url ? (
                    <Image
                      src={member.photo_url}
                      alt={member.first_name}
                      width={48}
                      height={48}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-lg font-bold">
                      {member.first_name[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {member.first_name} {member.last_name || ''}
                    </p>
                    <p className="text-sm text-gray-500">Stylist</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setSelectedMember(member)}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Commission
                </Button>
              </div>
            ))}

            {teamMembers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No team members found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Commission Report Modal */}
      {selectedMember && (
        <CommissionReportModal
          isOpen={true}
          onClose={() => setSelectedMember(null)}
          teamMember={selectedMember}
        />
      )}
    </div>
  );
}
