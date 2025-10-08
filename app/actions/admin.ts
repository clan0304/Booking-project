'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { clerkClient } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import type { UserRole } from '@/types/database';

/**
 * Update user roles (admin only)
 * Automatically syncs to Clerk metadata for JWT
 * NOTE: With database role checks, sync to Clerk is optional but good for consistency
 */
export async function updateUserRoles(
  userId: string, // database user ID
  newRoles: UserRole[]
) {
  try {
    // 1. Verify admin permission
    await requireAdmin();

    // Validate roles
    const validRoles: UserRole[] = ['client', 'team_member', 'admin'];
    const invalidRoles = newRoles.filter((role) => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      return {
        success: false,
        error: `Invalid roles: ${invalidRoles.join(', ')}`,
      };
    }

    // Ensure at least one role
    if (newRoles.length === 0) {
      return { success: false, error: 'User must have at least one role' };
    }

    // 2. Get user from database
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      console.error('Error fetching user:', fetchError);
      return { success: false, error: 'User not found' };
    }

    // 3. Update roles in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        roles: newRoles,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating roles in Supabase:', updateError);
      return { success: false, error: 'Failed to update roles in database' };
    }

    console.log(`✅ Updated roles in Supabase for user ${userId}:`, newRoles);

    // 4. Sync to Clerk (optional, but good for consistency with JWT if needed later)
    if (user.clerk_user_id) {
      try {
        const clerk = await clerkClient();
        await clerk.users.updateUserMetadata(user.clerk_user_id, {
          publicMetadata: {
            roles: newRoles,
          },
        });

        console.log(
          `✅ Synced roles to Clerk for user ${user.clerk_user_id}:`,
          newRoles
        );
      } catch (clerkError) {
        console.error('Error syncing roles to Clerk:', clerkError);
        // Don't fail the entire operation if Clerk sync fails
        console.warn('⚠️ Roles updated in database but Clerk sync failed');
      }
    } else {
      console.log('ℹ️ User not registered with Clerk, skipping metadata sync');
    }

    // 5. Revalidate admin pages
    revalidatePath('/admin/clients');
    revalidatePath(`/admin/clients/${userId}`);
    revalidatePath('/admin');

    return {
      success: true,
      message: 'Roles updated successfully! Changes are effective immediately.',
    };
  } catch (error) {
    console.error('Error updating user roles:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update user profile (admin only)
 */
export async function updateUserProfile(
  userId: string,
  data: {
    firstName: string;
    lastName?: string;
    phoneNumber?: string;
    birthday?: string;
    alertNote?: string;
    roles?: UserRole[];
  }
) {
  try {
    // Verify admin permission
    await requireAdmin();

    // Validate required fields
    if (!data.firstName || !data.firstName.trim()) {
      return { success: false, error: 'First name is required' };
    }

    // Get user from database
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return { success: false, error: 'User not found' };
    }

    // Update Supabase
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        first_name: data.firstName.trim(),
        last_name: data.lastName?.trim() || null,
        phone_number: data.phoneNumber?.trim() || null,
        birthday: data.birthday || null,
        alert_note: data.alertNote || null,
        ...(data.roles && { roles: data.roles }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user in Supabase:', updateError);
      return { success: false, error: 'Failed to update user' };
    }

    // Sync to Clerk if user is registered
    if (user.clerk_user_id) {
      try {
        const clerk = await clerkClient();

        // Update basic info
        await clerk.users.updateUser(user.clerk_user_id, {
          firstName: data.firstName.trim(),
          lastName: data.lastName?.trim() || '',
        });

        // Update roles in metadata if provided
        if (data.roles) {
          await clerk.users.updateUserMetadata(user.clerk_user_id, {
            publicMetadata: {
              roles: data.roles,
            },
          });
        }

        console.log('✅ Profile synced to Clerk');
      } catch (clerkError) {
        console.error('Error syncing to Clerk:', clerkError);
        console.warn('⚠️ Profile updated in database but Clerk sync failed');
      }
    }

    // Revalidate pages
    revalidatePath('/admin/clients');
    revalidatePath(`/admin/clients/${userId}`);
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'Profile updated successfully!',
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Create new client (admin only)
 */
export async function createClient(data: {
  email: string;
  firstName: string;
  lastName?: string;
  phoneNumber?: string;
  birthday?: string;
  alertNote?: string;
}) {
  try {
    await requireAdmin();

    // Validate required fields
    if (!data.email || !data.firstName) {
      return { success: false, error: 'Email and first name are required' };
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', data.email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return { success: false, error: 'Email already exists' };
    }

    // Create user
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: data.email.toLowerCase(),
        first_name: data.firstName.trim(),
        last_name: data.lastName?.trim() || null,
        phone_number: data.phoneNumber?.trim() || null,
        birthday: data.birthday || null,
        alert_note: data.alertNote || null,
        roles: ['client'],
        is_registered: false,
        onboarding_completed: true,
        clerk_user_id: null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error);
      return { success: false, error: 'Failed to create client' };
    }

    revalidatePath('/admin/clients');

    return {
      success: true,
      message: 'Client created successfully!',
      userId: newUser.id,
    };
  } catch (error) {
    console.error('Error creating client:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
