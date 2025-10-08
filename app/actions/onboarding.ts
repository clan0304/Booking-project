'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function completeOnboarding(formData: FormData) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get form data
    const phoneNumber = formData.get('phoneNumber') as string;
    const photoFile = formData.get('photo') as File | null;

    if (!phoneNumber) {
      return { success: false, error: 'Phone number is required' };
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

    let photoUrl = user.photo_url; // Keep existing photo if no new one

    // Upload photo if provided
    if (photoFile && photoFile.size > 0) {
      // Validate file
      if (photoFile.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Photo must be less than 5MB' };
      }

      if (!photoFile.type.startsWith('image/')) {
        return { success: false, error: 'File must be an image' };
      }

      // Generate unique filename
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('user-photos')
        .upload(filePath, photoFile, {
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

    // Update user in database
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        phone_number: phoneNumber,
        photo_url: photoUrl,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return { success: false, error: 'Failed to complete onboarding' };
    }

    return { success: true };
  } catch (error) {
    console.error('Onboarding error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
