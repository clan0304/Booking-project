// app/admin/team/page.tsx
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  TeamListClient,
  TeamTabs,
  ScheduledShiftsClient,
} from '@/components/admin/team';

export default async function TeamPage() {
  await requireAdmin();

  // Fetch all team members with their team_members data
  const { data: teamMembers, error: teamError } = await supabaseAdmin
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

  if (teamError) {
    console.error('Error fetching team members:', teamError);
  }

  // Transform team_members from array to single object (one-to-one relationship)
  const transformedTeamMembers =
    teamMembers?.map((member) => ({
      ...member,
      team_members: Array.isArray(member.team_members)
        ? member.team_members[0] || null
        : member.team_members,
    })) || [];

  // Fetch all venues for scheduling
  const { data: venues, error: venuesError } = await supabaseAdmin
    .from('venues')
    .select('*')
    .order('name', { ascending: true });

  if (venuesError) {
    console.error('Error fetching venues:', venuesError);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <TeamTabs
          teamMembersContent={
            <TeamListClient initialTeamMembers={transformedTeamMembers} />
          }
          scheduledShiftsContent={
            <ScheduledShiftsClient initialVenues={venues || []} />
          }
        />
      </div>
    </div>
  );
}
