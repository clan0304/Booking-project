// app/admin/team/page.tsx
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { TeamListClient } from '@/components/admin/team/team-list-client';
import { TeamTabs } from '@/components/admin/team/team-tabs';
import { ScheduledShiftsPlaceholder } from '@/components/admin/team/scheduled-shifts-placeholder';

export default async function TeamPage() {
  await requireAdmin();

  // Fetch all team members with their team_members data
  const { data: teamMembers, error } = await supabaseAdmin
    .from('users')
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      phone_number,
      photo_url,
      roles,
      is_registered,
      team_members (
        position,
        bio,
        is_active,
        hire_date
      )
    `
    )
    .contains('roles', ['team_member'])
    .order('first_name', { ascending: true });

  if (error) {
    console.error('Error fetching team members:', error);
  }

  // Transform team_members from array to single object (one-to-one relationship)
  const transformedTeamMembers =
    teamMembers?.map((member) => ({
      ...member,
      team_members: Array.isArray(member.team_members)
        ? member.team_members[0] || null // Take first item or null if empty
        : member.team_members, // Already an object or null
    })) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex-1 overflow-hidden mt-6">
        <TeamTabs
          teamMembersContent={
            <TeamListClient initialTeamMembers={transformedTeamMembers} />
          }
          scheduledShiftsContent={<ScheduledShiftsPlaceholder />}
        />
      </div>
    </div>
  );
}
