// lib/auth.ts
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

/**
 * Get current user's auth info with roles from Supabase
 * Returns null if not authenticated
 *
 * ARCHITECTURE: Clerk for Authentication, Supabase for Authorization
 * - Clerk: Handles sign in/up, provides userId
 * - Supabase: Single source of truth for roles and permissions
 */
export async function getCurrentUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Fetch roles from Supabase (single source of truth)
  // Use maybeSingle() to handle cases where user doesn't exist yet
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, roles')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user roles:', error);
    return null;
  }

  // If user doesn't exist in Supabase yet (webhook hasn't run)
  if (!user) {
    console.warn(
      `User ${userId} signed in to Clerk but not found in Supabase yet`
    );
    return null;
  }

  return {
    userId, // Clerk user ID
    supabaseUserId: user.id, // Supabase user ID
    roles: user.roles || ['client'],
  };
}

/**
 * Get current user or redirect to sign-in
 * Use this when authentication is required
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return user;
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.roles.includes(role) ?? false;
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  const user = await getCurrentUser();
  return roles.some((role) => user?.roles.includes(role)) ?? false;
}

/**
 * Require user to have specific role, or redirect
 */
export async function requireRole(
  role: UserRole,
  redirectTo = '/unauthorized'
) {
  const user = await requireAuth();

  if (!user.roles.includes(role)) {
    redirect(redirectTo);
  }

  return user;
}

/**
 * Require user to have any of the specified roles, or redirect
 */
export async function requireAnyRole(
  roles: UserRole[],
  redirectTo = '/unauthorized'
) {
  const user = await requireAuth();

  const hasRequiredRole = roles.some((role) => user.roles.includes(role));

  if (!hasRequiredRole) {
    redirect(redirectTo);
  }

  return user;
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('admin');
}

/**
 * Check if user is team member or admin
 */
export async function isStaff(): Promise<boolean> {
  return hasAnyRole(['admin', 'team_member']);
}

/**
 * Require admin access or redirect
 */
export async function requireAdmin() {
  return requireRole('admin');
}

/**
 * Require staff (admin or team_member) access or redirect
 */
export async function requireStaff() {
  return requireAnyRole(['admin', 'team_member']);
}

/**
 * Get user roles by Clerk user ID
 * Useful for quick role checks without full user object
 */
export async function getUserRoles(clerkUserId: string): Promise<UserRole[]> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('roles')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user roles:', error);
    return ['client']; // Default fallback
  }

  if (!user) {
    console.warn(`User ${clerkUserId} not found in Supabase`);
    return ['client']; // Default fallback
  }

  return user.roles || ['client'];
}
