'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { addRoleToUser, removeRoleFromUser } from '@/lib/role-management';
import { revalidatePath } from 'next/cache';

export async function addTeamMember(formData: FormData) {
  try {
    // Verify admin access
    await requireAdmin();

    // Get form data
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const firstName = (formData.get('firstName') as string)?.trim();
    const lastName = (formData.get('lastName') as string)?.trim();
    const position = (formData.get('position') as string)?.trim();
    const bio = (formData.get('bio') as string)?.trim();
    const phoneNumber = (formData.get('phoneNumber') as string)?.trim();

    // Validate required fields
    if (!email) {
      return { success: false, error: 'Email is required' };
    }

    if (!firstName) {
      return { success: false, error: 'First name is required' };
    }

    // Check if user already exists in database
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking existing user:', fetchError);
      return { success: false, error: 'Database error' };
    }

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // User exists - add team_member role
      console.log(`User exists with email ${email}, adding team_member role`);

      userId = existingUser.id;

      // Add team_member role (keeps existing roles)
      const roleResult = await addRoleToUser(userId, 'team_member');

      if (!roleResult.success) {
        return {
          success: false,
          error: roleResult.error || 'Failed to add team member role',
        };
      }

      // Update other fields if provided - properly typed
      const updateData: {
        updated_at: string;
        phone_number?: string;
        last_name?: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      if (phoneNumber) {
        updateData.phone_number = phoneNumber;
      }

      if (lastName) {
        updateData.last_name = lastName;
      }

      await supabaseAdmin.from('users').update(updateData).eq('id', userId);
    } else {
      // Create new user (unregistered)
      console.log(`Creating new unregistered user with email ${email}`);

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          email: email,
          first_name: firstName,
          last_name: lastName || null,
          phone_number: phoneNumber || null,
          clerk_user_id: null, // Unregistered
          is_registered: false,
          roles: ['client', 'team_member'], // Both roles
          onboarding_completed: true, // Admin created
        })
        .select()
        .single();

      if (insertError || !newUser) {
        console.error('Error creating user:', insertError);
        return { success: false, error: 'Failed to create user' };
      }

      userId = newUser.id;
      isNewUser = true;
    }

    // Check if team_member record already exists
    const { data: existingTeamMember } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingTeamMember) {
      // Update existing team member record
      await supabaseAdmin
        .from('team_members')
        .update({
          position: position || null,
          bio: bio || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      // Create team member record
      const { error: teamMemberError } = await supabaseAdmin
        .from('team_members')
        .insert({
          user_id: userId,
          position: position || null,
          bio: bio || null,
          is_active: true,
          hire_date: new Date().toISOString(),
        });

      if (teamMemberError) {
        console.error('Error creating team member:', teamMemberError);
        console.warn(
          'Team member record creation failed, but user role was updated'
        );
      }
    }

    // Revalidate pages
    revalidatePath('/admin');
    revalidatePath('/admin/team');

    if (isNewUser) {
      return {
        success: true,
        message: `Team member ${firstName} ${lastName} created. They can register with ${email} to access the system.`,
      };
    } else {
      return {
        success: true,
        message: `${firstName} ${lastName} is now a team member! Changes are effective immediately.`,
      };
    }
  } catch (error) {
    console.error('Error adding team member:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

export async function updateTeamMemberStatus(
  teamMemberId: string,
  isActive: boolean
) {
  try {
    await requireAdmin();

    const { error } = await supabaseAdmin
      .from('team_members')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamMemberId);

    if (error) {
      console.error('Error updating team member status:', error);
      return { success: false, error: 'Failed to update status' };
    }

    revalidatePath('/admin/team');
    return { success: true };
  } catch (error) {
    console.error('Error updating team member status:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function removeTeamMember(userId: string) {
  try {
    await requireAdmin();

    // Remove team_member role using utility
    const result = await removeRoleFromUser(userId, 'team_member');

    if (!result.success) {
      return result;
    }

    // Deactivate team member record
    await supabaseAdmin
      .from('team_members')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    revalidatePath('/admin/team');

    return {
      success: true,
      message: 'Team member removed. Changes are effective immediately.',
    };
  } catch (error) {
    console.error('Error removing team member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
