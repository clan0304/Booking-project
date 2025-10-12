'use client';

import { useState } from 'react';
import { Users, Calendar } from 'lucide-react';

interface TeamTabsProps {
  teamMembersContent: React.ReactNode;
  scheduledShiftsContent: React.ReactNode;
}

export function TeamTabs({
  teamMembersContent,
  scheduledShiftsContent,
}: TeamTabsProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'schedule'>(
    'schedule'
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'members'
              ? 'text-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Team Members</span>
          {activeTab === 'members' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'schedule'
              ? 'text-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Scheduled Shifts</span>
          {activeTab === 'schedule' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'members' && teamMembersContent}
        {activeTab === 'schedule' && scheduledShiftsContent}
      </div>
    </div>
  );
}
