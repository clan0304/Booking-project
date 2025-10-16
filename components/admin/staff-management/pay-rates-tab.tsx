'use client';

import { useState, useEffect, useCallback } from 'react';
import { DefaultPayRatesCard } from './default-pay-rates-card';
import { CustomPayRatesList } from './custom-pay-rates-list';
import {
  getDefaultPayRates,
  getCustomPayRates,
} from '@/app/actions/staff-pay-rates';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
}

interface DefaultPayRates {
  id: string;
  weekday_rate: number;
  saturday_rate: number;
  sunday_rate: number;
  public_holiday_rate: number;
  paid_break_minutes: number;
  updated_at: string;
}

interface CustomPayRate {
  id: string;
  team_member_id: string;
  weekday_rate: number | null;
  saturday_rate: number | null;
  sunday_rate: number | null;
  public_holiday_rate: number | null;
  paid_break_minutes: number | null;
  notes: string | null;
  users: {
    first_name: string;
    last_name: string | null;
  };
}

interface PayRatesTabProps {
  teamMembers: TeamMember[];
}

export function PayRatesTab({ teamMembers }: PayRatesTabProps) {
  const [defaultRates, setDefaultRates] = useState<DefaultPayRates | null>(
    null
  );
  const [customRates, setCustomRates] = useState<CustomPayRate[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Load all data ONCE when tab mounts
  const loadAllData = useCallback(async () => {
    setLoading(true);

    // Load default rates (1 API call)
    const defaultResult = await getDefaultPayRates();
    if (defaultResult.success && defaultResult.data) {
      setDefaultRates(defaultResult.data);
    }

    // Load all custom rates (1 API call)
    const customResult = await getCustomPayRates();
    if (customResult.success && Array.isArray(customResult.data)) {
      setCustomRates(customResult.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ✅ Refresh function to reload data after updates
  const handleRefresh = () => {
    loadAllData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 text-muted-foreground">
          Loading pay rates...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pass default rates as props - no additional API call */}
      <DefaultPayRatesCard
        initialRates={defaultRates}
        onUpdate={handleRefresh}
      />

      {/* Pass both default and custom rates as props - no additional API calls */}
      <CustomPayRatesList
        teamMembers={teamMembers}
        initialCustomRates={customRates}
        defaultRates={defaultRates}
        onUpdate={handleRefresh}
      />
    </div>
  );
}
