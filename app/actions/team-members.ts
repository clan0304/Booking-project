// app/actions/team-members.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { addRoleToUser, removeRoleFromUser } from '@/lib/role-management';
import { revalidatePath } from 'next/cache';

/**
 * Add a new team member
 * Admin only - creates user and team_member record
 */
export async function addTeamMember(formData: FormData) {
  try {
    await requireAdmin();

    // Get form data
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const firstName = (formData.get('firstName') as string)?.trim();
    const lastName = (formData.get('lastName') as string)?.trim();
    const phoneNumber = (formData.get('phoneNumber') as string)?.trim();
    const position = (formData.get('position') as string)?.trim();
    const bio = (formData.get('bio') as string)?.trim();
    const photoFile = formData.get('photo') as File | null;

    // Validate required fields
    if (!email) {
      return { success: false, error: 'Email is required' };
    }

    if (!firstName) {
      return { success: false, error: 'First name is required' };
    }

    // Check if user already exists
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
    let photoUrl: string | null = null;

    // Upload photo if provided
    if (photoFile && photoFile.size > 0) {
      if (photoFile.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Photo must be less than 5MB' };
      }

      if (!photoFile.type.startsWith('image/')) {
        return { success: false, error: 'File must be an image' };
      }

      const arrayBuffer = await photoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileExt = photoFile.name.split('.').pop();
      const fileName = `team-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('team-member-photos')
        .upload(filePath, buffer, {
          contentType: photoFile.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        return { success: false, error: 'Failed to upload photo' };
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('team-member-photos')
        .getPublicUrl(filePath);

      photoUrl = urlData.publicUrl;
    }

    if (existingUser) {
      // User exists - add team_member role
      userId = existingUser.id;

      const roleResult = await addRoleToUser(userId, 'team_member');
      if (!roleResult.success) {
        return {
          success: false,
          error: roleResult.error || 'Failed to add team member role',
        };
      }

      // Update user info
      await supabaseAdmin
        .from('users')
        .update({
          phone_number: phoneNumber || existingUser.phone_number,
          last_name: lastName || existingUser.last_name,
          photo_url: photoUrl || existingUser.photo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          email: email,
          first_name: firstName,
          last_name: lastName || null,
          phone_number: phoneNumber || null,
          photo_url: photoUrl,
          clerk_user_id: null,
          is_registered: false,
          roles: ['client', 'team_member'],
          onboarding_completed: true,
        })
        .select()
        .single();

      if (insertError || !newUser) {
        console.error('Error creating user:', insertError);
        return { success: false, error: 'Failed to create user' };
      }

      userId = newUser.id;
    }

    // Check if team_member record exists
    const { data: existingTeamMember } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingTeamMember) {
      // Update existing record - ALWAYS set to active when adding
      await supabaseAdmin
        .from('team_members')
        .update({
          position: position || null,
          bio: bio || null,
          is_active: true, // ✅ Always activate when adding
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      // Create team member record - ACTIVE by default
      const { error: teamMemberError } = await supabaseAdmin
        .from('team_members')
        .insert({
          user_id: userId,
          position: position || null,
          bio: bio || null,
          is_active: true, // ✅ Active by default
          hire_date: new Date().toISOString(),
        });

      if (teamMemberError) {
        console.error('Error creating team member:', teamMemberError);
      }
    }

    revalidatePath('/admin/team');
    revalidatePath('/api/public/team');

    return {
      success: true,
      message: `Team member ${firstName} added successfully and is now active!`,
    };
  } catch (error) {
    console.error('Error adding team member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update team member
 * Admin only
 */
export async function updateTeamMember(userId: string, formData: FormData) {
  try {
    await requireAdmin();

    const firstName = (formData.get('firstName') as string)?.trim();
    const lastName = (formData.get('lastName') as string)?.trim();
    const phoneNumber = (formData.get('phoneNumber') as string)?.trim();
    const position = (formData.get('position') as string)?.trim();
    const bio = (formData.get('bio') as string)?.trim();
    const photoFile = formData.get('photo') as File | null;

    if (!firstName) {
      return { success: false, error: 'First name is required' };
    }

    // Get existing user
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return { success: false, error: 'User not found' };
    }

    let photoUrl = user.photo_url;

    // Upload new photo if provided
    if (photoFile && photoFile.size > 0) {
      if (photoFile.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Photo must be less than 5MB' };
      }

      if (!photoFile.type.startsWith('image/')) {
        return { success: false, error: 'File must be an image' };
      }

      // Delete old photo
      if (user.photo_url) {
        const oldPath = user.photo_url.split(
          '/storage/v1/object/public/team-member-photos/'
        )[1];
        if (oldPath) {
          await supabaseAdmin.storage
            .from('team-member-photos')
            .remove([oldPath]);
        }
      }

      const arrayBuffer = await photoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileExt = photoFile.name.split('.').pop();
      const fileName = `team-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('team-member-photos')
        .upload(filePath, buffer, {
          contentType: photoFile.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        return { success: false, error: 'Failed to upload photo' };
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('team-member-photos')
        .getPublicUrl(filePath);

      photoUrl = urlData.publicUrl;
    }

    // Update user
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName || null,
        phone_number: phoneNumber || null,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return { success: false, error: 'Failed to update user' };
    }

    // Update team member record
    await supabaseAdmin
      .from('team_members')
      .update({
        position: position || null,
        bio: bio || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    revalidatePath('/admin/team');
    revalidatePath('/api/public/team');

    return {
      success: true,
      message: 'Team member updated successfully!',
    };
  } catch (error) {
    console.error('Error updating team member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Toggle team member active status
 */
export async function toggleTeamMemberStatus(
  userId: string,
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
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating status:', error);
      return { success: false, error: 'Failed to update status' };
    }

    revalidatePath('/admin/team');
    revalidatePath('/api/public/team');

    return {
      success: true,
      message: `Team member ${
        isActive ? 'activated' : 'deactivated'
      } successfully!`,
    };
  } catch (error) {
    console.error('Error toggling status:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Remove team member (removes role, deactivates record)
 */
export async function removeTeamMember(userId: string) {
  try {
    await requireAdmin();

    // Remove team_member role
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
    revalidatePath('/api/public/team');

    return {
      success: true,
      message: 'Team member removed successfully!',
    };
  } catch (error) {
    console.error('Error removing team member:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
