'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get form data
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const birthday = formData.get('birthday') as string;
    const photoFile = formData.get('photo') as File | null;

    // Validate required fields
    if (!firstName || !firstName.trim()) {
      return { success: false, error: 'First name is required' };
    }

    // Get user from database
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('clerk_user_id', userId)
      .single();

    if (fetchError || !user) {
      console.error('Error fetching user:', fetchError);
      return { success: false, error: 'User not found' };
    }

    let photoUrl = user.photo_url;

    // Upload new photo if provided
    if (photoFile && photoFile.size > 0) {
      // Validate file
      if (photoFile.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Photo must be less than 5MB' };
      }

      if (!photoFile.type.startsWith('image/')) {
        return { success: false, error: 'File must be an image' };
      }

      // Delete old photo if exists
      if (user.photo_url) {
        const oldPath = user.photo_url.split(
          '/storage/v1/object/public/user-photos/'
        )[1];
        if (oldPath) {
          await supabaseAdmin.storage.from('user-photos').remove([oldPath]);
        }
      }

      // Convert File to Buffer for Supabase upload
      const arrayBuffer = await photoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generate unique filename
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('user-photos')
        .upload(filePath, buffer, {
          contentType: photoFile.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        return { success: false, error: 'Failed to upload photo' };
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('user-photos')
        .getPublicUrl(filePath);

      photoUrl = urlData.publicUrl;
    }

    // Update Supabase
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        first_name: firstName.trim(),
        last_name: lastName?.trim() || null,
        phone_number: phoneNumber?.trim() || null,
        birthday: birthday || null,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user in Supabase:', updateError);
      return { success: false, error: 'Failed to update profile' };
    }

    // Update Clerk
    try {
      const client = await clerkClient();
      await client.users.updateUser(userId, {
        firstName: firstName.trim(),
        lastName: lastName?.trim() || '',
        ...(photoUrl && { publicMetadata: { photo_url: photoUrl } }),
      });

      // Also update Clerk profile image if photo changed
      if (photoUrl && photoUrl !== user.photo_url) {
        await client.users.updateUser(userId, {
          publicMetadata: {
            ...((await client.users.getUser(userId)).publicMetadata || {}),
            photo_url: photoUrl,
          },
        });
      }

      console.log('✅ Profile synced to Clerk');
    } catch (clerkError) {
      console.error('Error updating Clerk:', clerkError);
      // Don't fail the request if Clerk sync fails - Supabase is source of truth
      console.warn('Profile updated in Supabase but Clerk sync failed');
    }

    // Revalidate relevant pages
    revalidatePath('/dashboard');
    revalidatePath('/profile');

    return { success: true };
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function deleteProfilePhoto() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get user from database
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('clerk_user_id', userId)
      .single();

    if (fetchError || !user) {
      return { success: false, error: 'User not found' };
    }

    // Delete photo from storage if exists
    if (user.photo_url) {
      const photoPath = user.photo_url.split(
        '/storage/v1/object/public/user-photos/'
      )[1];
      if (photoPath) {
        await supabaseAdmin.storage.from('user-photos').remove([photoPath]);
      }
    }

    // Update Supabase
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        photo_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error removing photo from Supabase:', updateError);
      return { success: false, error: 'Failed to remove photo' };
    }

    // Update Clerk
    try {
      const client = await clerkClient();
      const currentUser = await client.users.getUser(userId);
      const currentMetadata = currentUser.publicMetadata || {};

      await client.users.updateUser(userId, {
        publicMetadata: {
          ...currentMetadata,
          photo_url: null,
        },
      });

      console.log('✅ Photo removal synced to Clerk');
    } catch (clerkError) {
      console.error('Error updating Clerk:', clerkError);
    }

    revalidatePath('/dashboard');
    revalidatePath('/profile');

    return { success: true };
  } catch (error) {
    console.error('Photo deletion error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
