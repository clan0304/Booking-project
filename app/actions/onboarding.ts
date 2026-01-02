// app/actions/onboarding.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Phone validation regex patterns by country
const PHONE_PATTERNS: Record<string, { pattern: RegExp; description: string }> =
  {
    '+61': {
      pattern: /^\+614\d{8}$/,
      description: 'Australian mobile number (+614XXXXXXXX)',
    },
    '+1': {
      pattern: /^\+1\d{10}$/,
      description: 'US/Canada number (+1XXXXXXXXXX)',
    },
    '+44': {
      pattern: /^\+44\d{10}$/,
      description: 'UK number (+44XXXXXXXXXX)',
    },
    '+64': {
      pattern: /^\+64\d{8,9}$/,
      description: 'New Zealand number (+64XXXXXXXX)',
    },
    '+65': {
      pattern: /^\+65\d{8}$/,
      description: 'Singapore number (+65XXXXXXXX)',
    },
  };

function validatePhoneNumber(phone: string): {
  valid: boolean;
  error?: string;
} {
  if (!phone) {
    return { valid: false, error: 'Phone number is required' };
  }

  // Extract country code
  const countryCode = Object.keys(PHONE_PATTERNS).find((code) =>
    phone.startsWith(code)
  );

  if (!countryCode) {
    return { valid: false, error: 'Invalid country code' };
  }

  const pattern = PHONE_PATTERNS[countryCode];
  if (!pattern.pattern.test(phone)) {
    return {
      valid: false,
      error: `Invalid phone format. Expected: ${pattern.description}`,
    };
  }

  return { valid: true };
}

export async function completeOnboarding(formData: FormData) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get form data
    const firstName = formData.get('firstName') as string | null;
    const lastName = formData.get('lastName') as string | null;
    const phoneNumber = formData.get('phoneNumber') as string | null;
    const photoFile = formData.get('photo') as File | null;

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

    // Build update object with only provided fields
    const updateData: Record<string, string | boolean> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and add first name if provided
    if (firstName !== null) {
      const trimmedFirstName = firstName.trim();
      if (!trimmedFirstName) {
        return { success: false, error: 'First name is required' };
      }
      updateData.first_name = trimmedFirstName;
    }

    // Validate and add last name if provided
    if (lastName !== null) {
      const trimmedLastName = lastName.trim();
      if (!trimmedLastName) {
        return { success: false, error: 'Last name is required' };
      }
      updateData.last_name = trimmedLastName;
    }

    // Validate and add phone number if provided
    if (phoneNumber !== null) {
      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.valid) {
        return { success: false, error: phoneValidation.error };
      }
      updateData.phone_number = phoneNumber;
    }

    // Final validation: ensure all required fields will be present after update
    const finalFirstName = updateData.first_name || user.first_name;
    const finalLastName = updateData.last_name || user.last_name;
    const finalPhoneNumber = updateData.phone_number || user.phone_number;

    if (
      !finalFirstName ||
      (typeof finalFirstName === 'string' && !finalFirstName.trim())
    ) {
      return { success: false, error: 'First name is required' };
    }
    if (
      !finalLastName ||
      (typeof finalLastName === 'string' && !finalLastName.trim())
    ) {
      return { success: false, error: 'Last name is required' };
    }
    if (
      !finalPhoneNumber ||
      (typeof finalPhoneNumber === 'string' && !finalPhoneNumber.trim())
    ) {
      return { success: false, error: 'Phone number is required' };
    }

    // Handle photo upload
    let photoUrl = user.photo_url; // Keep existing photo if no new one

    if (photoFile && photoFile.size > 0) {
      // Validate file
      if (photoFile.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Photo must be less than 5MB' };
      }

      if (!photoFile.type.startsWith('image/')) {
        return { success: false, error: 'File must be an image' };
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

    // Add photo URL and onboarding status to update
    if (photoUrl) {
      updateData.photo_url = photoUrl;
    }
    updateData.onboarding_completed = true;

    // Update user in database
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
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
