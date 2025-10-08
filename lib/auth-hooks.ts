// lib/auth-hooks.ts
'use client';
import { useUser } from '@clerk/nextjs';

export function useCurrentUserRoles() {
  const { user } = useUser();
  return (user?.publicMetadata?.roles as string[]) || [];
}

export function useIsAdmin() {
  const roles = useCurrentUserRoles();
  return roles.includes('admin');
}
