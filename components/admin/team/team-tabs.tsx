// components/admin/team/team-tabs.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TeamTabsProps {
  children: React.ReactNode;
  teamMembersContent: React.ReactNode;
  scheduledShiftsContent: React.ReactNode;
}

export function TeamTabs({
  teamMembersContent,
  scheduledShiftsContent,
}: Omit<TeamTabsProps, 'children'>) {
  const [activeTab, setActiveTab] = useState<'members' | 'shifts'>('members');

  const tabs = [
    { id: 'members', label: 'Team members' },
    { id: 'shifts', label: 'Scheduled shifts' },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white">
        <nav className="flex space-x-8 px-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-[#6C5CE7] text-gray-900'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'members' && teamMembersContent}
        {activeTab === 'shifts' && scheduledShiftsContent}
      </div>
    </div>
  );
}
