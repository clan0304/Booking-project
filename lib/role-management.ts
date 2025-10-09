// lib/role-management.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

/**
 * Update user roles in Supabase
 * Changes take effect immediately - no sync needed!
 */
export async function updateUserRoles(
  userId: string, // Supabase user ID
  newRoles: UserRole[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate roles
    const validRoles: UserRole[] = ['client', 'team_member', 'admin'];
    const invalidRoles = newRoles.filter((role) => !validRoles.includes(role));

    if (invalidRoles.length > 0) {
      return {
        success: false,
        error: `Invalid roles: ${invalidRoles.join(', ')}`,
      };
    }

    if (newRoles.length === 0) {
      return {
        success: false,
        error: 'User must have at least one role',
      };
    }

    // Remove duplicates
    const uniqueRoles = Array.from(new Set(newRoles));

    // Update Supabase (single source of truth)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        roles: uniqueRoles,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating roles in Supabase:', updateError);
      return {
        success: false,
        error: 'Failed to update roles in database',
      };
    }

    console.log(
      `✅ Updated roles for user ${userId}: ${uniqueRoles.join(', ')}`
    );

    return { success: true };
  } catch (error) {
    console.error('Error updating user roles:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Add a role to a user (keeps existing roles)
 */
export async function addRoleToUser(
  userId: string,
  roleToAdd: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current roles
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('roles')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return { success: false, error: 'User not found' };
    }

    // Add new role if not already present
    const currentRoles: UserRole[] = user.roles || ['client'];
    if (currentRoles.includes(roleToAdd)) {
      console.log(`User ${userId} already has role: ${roleToAdd}`);
      return { success: true };
    }

    const newRoles = [...currentRoles, roleToAdd];
    return await updateUserRoles(userId, newRoles);
  } catch (error) {
    console.error('Error adding role:', error);
    return { success: false, error: 'Failed to add role' };
  }
}

/**
 * Remove a role from a user
 */
export async function removeRoleFromUser(
  userId: string,
  roleToRemove: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current roles
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('roles')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return { success: false, error: 'User not found' };
    }

    // Explicitly type currentRoles to fix TypeScript error
    const currentRoles: UserRole[] = user.roles || ['client'];
    const newRoles = currentRoles.filter(
      (role: UserRole) => role !== roleToRemove
    );

    // Ensure user has at least one role
    if (newRoles.length === 0) {
      newRoles.push('client');
    }

    return await updateUserRoles(userId, newRoles);
  } catch (error) {
    console.error('Error removing role:', error);
    return { success: false, error: 'Failed to remove role' };
  }
}

/**
 * Check if a user has a specific role
 */
export async function userHasRole(
  userId: string,
  role: UserRole
): Promise<boolean> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('roles')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return false;
    }

    return user.roles?.includes(role) ?? false;
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
}

/**
 * Get all users with a specific role
 */
export async function getUsersByRole(
  role: UserRole
): Promise<
  Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string | null;
  }>
> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, first_name, last_name, roles')
      .contains('roles', [role]);

    if (error) {
      console.error('Error fetching users by role:', error);
      return [];
    }

    return users || [];
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return [];
  }
}
