// app/actions/clients.ts
'use server';

import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Get all clients with stats
 */
export async function getAllClients() {
  try {
    await requireAdmin();

    const { data: clients, error } = await supabaseAdmin
      .from('users')
      .select(
        `
        id,
        clerk_user_id,
        email,
        first_name,
        last_name,
        phone_number,
        birthday,
        photo_url,
        is_registered,
        alert_note,
        created_at,
        client_notes(count)
      `
      )
      .eq('roles', ['client'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      return { success: false, error: 'Failed to fetch clients' };
    }

    return { success: true, data: clients || [] };
  } catch (error) {
    console.error('Error getting clients:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Create a new client (manually by admin)
 */
export async function createClient(formData: FormData) {
  try {
    await requireAdmin();

    // Get form data
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const firstName = (formData.get('firstName') as string)?.trim();
    const lastName = (formData.get('lastName') as string)?.trim();
    const phoneNumber = (formData.get('phoneNumber') as string)?.trim();
    const birthday = formData.get('birthday') as string;
    const alertNote = (formData.get('alertNote') as string)?.trim();
    const photoFile = formData.get('photo') as File | null;

    // Validate required fields
    if (!email) {
      return { success: false, error: 'Email is required' };
    }

    if (!firstName) {
      return { success: false, error: 'First name is required' };
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return { success: false, error: 'Email already exists' };
    }

    let photoUrl: string | null = null;

    // Upload photo if provided
    if (photoFile && photoFile.size > 0) {
      if (photoFile.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Photo must be less than 5MB' };
      }

      if (!photoFile.type.startsWith('image/')) {
        return { success: false, error: 'File must be an image' };
      }

      const arrayBuffer = await photoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileExt = photoFile.name.split('.').pop();
      const fileName = `client-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `clients/${fileName}`;

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

      const { data: urlData } = supabaseAdmin.storage
        .from('user-photos')
        .getPublicUrl(filePath);

      photoUrl = urlData.publicUrl;
    }

    // Create client
    const { data: newClient, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName || null,
        phone_number: phoneNumber || null,
        birthday: birthday || null,
        alert_note: alertNote || null,
        photo_url: photoUrl,
        roles: ['client'],
        is_registered: false,
        onboarding_completed: true,
        clerk_user_id: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating client:', insertError);
      return { success: false, error: 'Failed to create client' };
    }

    revalidatePath('/admin/clients');

    return {
      success: true,
      message: 'Client created successfully!',
      data: newClient,
    };
  } catch (error) {
    console.error('Error creating client:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update an existing client
 */
export async function updateClient(clientId: string, formData: FormData) {
  try {
    await requireAdmin();

    const firstName = (formData.get('firstName') as string)?.trim();
    const lastName = (formData.get('lastName') as string)?.trim();
    const phoneNumber = (formData.get('phoneNumber') as string)?.trim();
    const birthday = formData.get('birthday') as string;
    const alertNote = (formData.get('alertNote') as string)?.trim();
    const photoFile = formData.get('photo') as File | null;

    if (!firstName) {
      return { success: false, error: 'First name is required' };
    }

    // Get existing client
    const { data: client, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', clientId)
      .single();

    if (fetchError || !client) {
      return { success: false, error: 'Client not found' };
    }

    let photoUrl = client.photo_url;

    // Upload new photo if provided
    if (photoFile && photoFile.size > 0) {
      if (photoFile.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Photo must be less than 5MB' };
      }

      if (!photoFile.type.startsWith('image/')) {
        return { success: false, error: 'File must be an image' };
      }

      // Delete old photo if exists
      if (client.photo_url) {
        const oldPath = client.photo_url.split(
          '/storage/v1/object/public/user-photos/'
        )[1];
        if (oldPath) {
          await supabaseAdmin.storage.from('user-photos').remove([oldPath]);
        }
      }

      const arrayBuffer = await photoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileExt = photoFile.name.split('.').pop();
      const fileName = `client-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `clients/${fileName}`;

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

      const { data: urlData } = supabaseAdmin.storage
        .from('user-photos')
        .getPublicUrl(filePath);

      photoUrl = urlData.publicUrl;
    }

    // Update client
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName || null,
        phone_number: phoneNumber || null,
        birthday: birthday || null,
        alert_note: alertNote || null,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Error updating client:', updateError);
      return { success: false, error: 'Failed to update client' };
    }

    revalidatePath('/admin/clients');

    return {
      success: true,
      message: 'Client updated successfully!',
    };
  } catch (error) {
    console.error('Error updating client:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete a client
 */
export async function deleteClient(clientId: string) {
  try {
    await requireAdmin();

    // Get client to check for photo
    const { data: client, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('photo_url, is_registered, clerk_user_id')
      .eq('id', clientId)
      .single();

    if (fetchError || !client) {
      return { success: false, error: 'Client not found' };
    }

    // If client is registered (has Clerk account), we should NOT delete
    // Instead, just remove the 'client' role
    if (client.is_registered && client.clerk_user_id) {
      return {
        success: false,
        error:
          'Cannot delete registered client. Please remove their client role instead.',
      };
    }

    // Delete photo if exists
    if (client.photo_url) {
      const photoPath = client.photo_url.split(
        '/storage/v1/object/public/user-photos/'
      )[1];
      if (photoPath) {
        await supabaseAdmin.storage.from('user-photos').remove([photoPath]);
      }
    }

    // Delete client (only for unregistered clients)
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', clientId);

    if (deleteError) {
      console.error('Error deleting client:', deleteError);
      return { success: false, error: 'Failed to delete client' };
    }

    revalidatePath('/admin/clients');

    return {
      success: true,
      message: 'Client deleted successfully!',
    };
  } catch (error) {
    console.error('Error deleting client:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete client photo
 */
export async function deleteClientPhoto(clientId: string) {
  try {
    await requireAdmin();

    const { data: client, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('photo_url')
      .eq('id', clientId)
      .single();

    if (fetchError || !client) {
      return { success: false, error: 'Client not found' };
    }

    // Delete photo from storage if exists
    if (client.photo_url) {
      const photoPath = client.photo_url.split(
        '/storage/v1/object/public/user-photos/'
      )[1];
      if (photoPath) {
        await supabaseAdmin.storage.from('user-photos').remove([photoPath]);
      }
    }

    // Update client record
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        photo_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('Error removing photo:', updateError);
      return { success: false, error: 'Failed to remove photo' };
    }

    revalidatePath('/admin/clients');

    return { success: true };
  } catch (error) {
    console.error('Error deleting photo:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
