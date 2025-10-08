'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Sync roles from Supabase to Clerk metadata
 * This ensures JWT claims match database roles
 */
export async function syncRolesToClerk() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get user roles from Supabase
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('roles')
      .eq('clerk_user_id', userId)
      .single();

    if (error || !user) {
      console.error('Error fetching user from Supabase:', error);
      return { success: false, error: 'User not found' };
    }

    // Update Clerk metadata with roles from Supabase
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        roles: user.roles,
      },
    });

    return { success: true, roles: user.roles };
  } catch (error) {
    console.error('Error syncing roles:', error);
    return { success: false, error: 'Failed to sync roles' };
  }
}
