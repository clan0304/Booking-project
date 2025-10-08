// lib/auth.ts
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

/**
 * Get current user from Clerk
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return { userId };
}

/**
 * Get current user with roles from database
 * Returns null if not authenticated
 */
export async function getCurrentUserWithRoles() {
  const { userId } = await auth();
  if (!userId) return null;

  // Get roles from database (not JWT!)
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('roles')
    .eq('clerk_user_id', userId)
    .single();

  return {
    userId,
    roles: user?.roles || [],
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
 * Get current user with roles or redirect to sign-in
 * Use this when you need both auth and roles
 */
export async function requireAuthWithRoles() {
  const user = await getCurrentUserWithRoles();

  if (!user) {
    redirect('/sign-in');
  }

  return user;
}

/**
 * Check if user has specific role (from database)
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const user = await getCurrentUserWithRoles();
  return user?.roles.includes(role) ?? false;
}

/**
 * Check if user has any of the specified roles (from database)
 */
export async function hasAnyRole(roles: UserRole[]): Promise<boolean> {
  const user = await getCurrentUserWithRoles();
  return roles.some((role) => user?.roles.includes(role)) ?? false;
}

/**
 * Require user to have specific role (from database)
 * Redirects to /unauthorized if user doesn't have the role
 */
export async function requireRole(
  role: UserRole,
  redirectTo = '/unauthorized'
) {
  const user = await requireAuthWithRoles();

  if (!user.roles.includes(role)) {
    redirect(redirectTo);
  }

  return user;
}

/**
 * Require user to have any of the specified roles (from database)
 * Redirects to /unauthorized if user doesn't have any of the roles
 */
export async function requireAnyRole(
  roles: UserRole[],
  redirectTo = '/unauthorized'
) {
  const user = await requireAuthWithRoles();

  const hasRequiredRole = roles.some((role) => user.roles.includes(role));

  if (!hasRequiredRole) {
    redirect(redirectTo);
  }

  return user;
}

/**
 * Check if user is admin (from database)
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('admin');
}

/**
 * Check if user is team member or admin (from database)
 */
export async function isStaff(): Promise<boolean> {
  return hasAnyRole(['admin', 'team_member']);
}

/**
 * Require admin access (from database)
 * Redirects to /unauthorized if not admin
 */
export async function requireAdmin() {
  return requireRole('admin');
}

/**
 * Require staff (admin or team_member) access (from database)
 * Redirects to /unauthorized if not staff
 */
export async function requireStaff() {
  return requireAnyRole(['admin', 'team_member']);
}
