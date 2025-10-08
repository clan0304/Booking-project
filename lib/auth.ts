// lib/auth.ts
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { UserRole } from '@/types/database';

/**
 * Get current user's auth info
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return null;
  }

  const roles =
    (sessionClaims?.metadata as { roles?: UserRole[] })?.roles || [];

  return {
    userId,
    roles,
    sessionClaims,
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
