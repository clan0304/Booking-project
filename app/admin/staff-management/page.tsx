// app/admin/staff-management/page.tsx
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { StaffManagementClient } from '@/components/admin/staff-management';

// =====================================================
// PAGE COMPONENT
// =====================================================

export default async function StaffManagementPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect('/sign-in');

  // Get user from database
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, roles, first_name, last_name')
    .eq('clerk_user_id', clerkUser.id)
    .single();

  if (!user) redirect('/onboarding');

  const roles = user.roles || [];
  const isAdmin = roles.includes('admin');
  const isTeamMember = roles.includes('team_member');

  if (!isTeamMember && !isAdmin) {
    redirect('/'); // Only team members and admins can access
  }

  // Get all venues
  const { data: venues } = await supabaseAdmin
    .from('venues')
    .select('id, name')
    .order('name', { ascending: true });

  // Get all team members for dropdown
  const { data: allTeamMembers } = await supabaseAdmin
    .from('users')
    .select('id, first_name, last_name, photo_url, roles')
    .contains('roles', ['team_member'])
    .order('first_name', { ascending: true });

  // Filter to get only team members
  const teamMembers = (allTeamMembers || [])
    .filter((member) => {
      const memberRoles = member.roles || [];
      return memberRoles.includes('team_member');
    })
    .map((member) => ({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      photo_url: member.photo_url,
    }));

  return (
    <StaffManagementClient
      currentUser={{
        id: user.id,
        isAdmin,
        isTeamMember,
      }}
      teamMembers={teamMembers}
      venues={venues || []}
    />
  );
}
