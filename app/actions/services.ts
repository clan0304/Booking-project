// app/actions/services.ts
'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

// =====================================================
// SERVICE CATEGORIES
// =====================================================

export async function getCategories() {
  const { data, error } = await supabaseAdmin
    .from('service_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories');
  }

  return data || [];
}

export async function createCategory(formData: {
  name: string;
  description?: string;
  color: string;
}) {
  await requireAuth();

  const { data, error } = await supabaseAdmin
    .from('service_categories')
    .insert({
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      color: formData.color,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    throw new Error('Failed to create category');
  }

  revalidatePath('/admin/services');
  return data;
}

export async function updateCategory(
  categoryId: string,
  formData: {
    name: string;
    description?: string;
    color: string;
  }
) {
  await requireAuth();

  const { data, error } = await supabaseAdmin
    .from('service_categories')
    .update({
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      color: formData.color,
    })
    .eq('id', categoryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating category:', error);
    throw new Error('Failed to update category');
  }

  revalidatePath('/admin/services');
  return data;
}

export async function deleteCategory(categoryId: string) {
  await requireAuth();

  // Check if category has services
  const { count } = await supabaseAdmin
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('is_active', true);

  if (count && count > 0) {
    throw new Error('Cannot delete category with active services');
  }

  const { error } = await supabaseAdmin
    .from('service_categories')
    .delete()
    .eq('id', categoryId);

  if (error) {
    console.error('Error deleting category:', error);
    throw new Error('Failed to delete category');
  }

  revalidatePath('/admin/services');
}

// =====================================================
// SERVICES
// =====================================================

export async function getServices() {
  const { data, error } = await supabaseAdmin
    .from('services')
    .select(
      `
      *,
      category:service_categories(id, name, color),
      service_venues(venue_id, venues(id, name)),
      service_team_members(team_member_id, custom_price, custom_duration_minutes, users(id, first_name, last_name, photo_url))
    `
    )
    .is('parent_service_id', null)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching services:', error);
    throw new Error('Failed to fetch services');
  }

  // Calculate display price for variant groups
  const servicesWithPrices = await Promise.all(
    (data || []).map(async (service) => {
      if (service.type === 'variant_group') {
        const { data: minPrice } = await supabaseAdmin.rpc(
          'get_variant_min_price',
          {
            p_parent_service_id: service.id,
          }
        );
        return { ...service, display_price: minPrice || 0 };
      }
      return { ...service, display_price: service.price };
    })
  );

  return servicesWithPrices;
}

export async function getServiceById(serviceId: string) {
  const { data, error } = await supabaseAdmin
    .from('services')
    .select(
      `
      *,
      category:service_categories(id, name, color),
      service_venues(id, venue_id, is_active, venues(id, name)),
      service_team_members(
        id, 
        team_member_id, 
        custom_price, 
        custom_duration_minutes, 
        is_active,
        users(id, first_name, last_name, photo_url)
      )
    `
    )
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error('Error fetching service:', error);
    throw new Error('Failed to fetch service');
  }

  return data;
}

export async function getServiceVariants(parentServiceId: string) {
  const { data, error } = await supabaseAdmin
    .from('services')
    .select('*')
    .eq('parent_service_id', parentServiceId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('price', { ascending: true });

  if (error) {
    console.error('Error fetching variants:', error);
    throw new Error('Failed to fetch variants');
  }

  return data || [];
}

export async function createService(formData: {
  name: string;
  category_id?: string;
  description?: string;
  type: 'service' | 'bundle' | 'variant_group';
  price_type: 'fixed' | 'from';
  price?: number;
  duration_minutes: number;
  venue_ids?: string[];
  team_member_ids?: string[];
}) {
  const user = await requireAuth();

  // For variant_group, price should be NULL (calculated from variants)
  const servicePrice =
    formData.type === 'variant_group' ? null : formData.price;

  // Create service
  const { data: service, error: serviceError } = await supabaseAdmin
    .from('services')
    .insert({
      name: formData.name.trim(),
      category_id: formData.category_id || null,
      description: formData.description?.trim() || null,
      type: formData.type,
      price_type: formData.price_type,
      price: servicePrice,
      duration_minutes: formData.duration_minutes,
      is_bookable: formData.type !== 'variant_group', // variant groups are not bookable
      created_by: user.supabaseUserId,
    })
    .select()
    .single();

  if (serviceError) {
    console.error('Error creating service:', serviceError);
    throw new Error('Failed to create service');
  }

  // Assign to venues if provided
  if (formData.venue_ids && formData.venue_ids.length > 0) {
    await assignServiceVenues(service.id, formData.venue_ids);
  }

  // Assign to team members if provided
  if (formData.team_member_ids && formData.team_member_ids.length > 0) {
    await assignServiceTeamMembers(service.id, formData.team_member_ids);
  }

  revalidatePath('/admin/services');
  return service;
}

export async function createVariant(formData: {
  name: string;
  parent_service_id: string;
  price: number;
  duration_minutes: number;
  category_id?: string;
}) {
  const user = await requireAuth();

  const { data, error } = await supabaseAdmin
    .from('services')
    .insert({
      name: formData.name.trim(),
      parent_service_id: formData.parent_service_id,
      category_id: formData.category_id || null,
      type: 'service',
      price_type: 'fixed',
      price: formData.price,
      duration_minutes: formData.duration_minutes,
      is_bookable: true,
      created_by: user.supabaseUserId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating variant:', error);
    throw new Error('Failed to create variant');
  }

  revalidatePath('/admin/services');
  return data;
}

export async function updateService(
  serviceId: string,
  formData: {
    name: string;
    category_id?: string;
    description?: string;
    price_type: 'fixed' | 'from';
    price?: number;
    duration_minutes: number;
    venue_ids?: string[];
    team_member_ids?: string[];
  }
) {
  await requireAuth();

  // Get service type to check if it's a variant_group
  const { data: existingService } = await supabaseAdmin
    .from('services')
    .select('type')
    .eq('id', serviceId)
    .single();

  // For variant_group, price should remain NULL
  const servicePrice =
    existingService?.type === 'variant_group' ? null : formData.price;

  const { data, error } = await supabaseAdmin
    .from('services')
    .update({
      name: formData.name.trim(),
      category_id: formData.category_id || null,
      description: formData.description?.trim() || null,
      price_type: formData.price_type,
      price: servicePrice,
      duration_minutes: formData.duration_minutes,
    })
    .eq('id', serviceId)
    .select()
    .single();

  if (error) {
    console.error('Error updating service:', error);
    throw new Error('Failed to update service');
  }

  // Update venue assignments if provided
  if (formData.venue_ids !== undefined) {
    await assignServiceVenues(serviceId, formData.venue_ids);
  }

  // Update team member assignments if provided
  if (formData.team_member_ids !== undefined) {
    await assignServiceTeamMembers(serviceId, formData.team_member_ids);
  }

  revalidatePath('/admin/services');
  return data;
}

export async function deleteService(serviceId: string) {
  await requireAuth();

  // Check if this is a variant group with variants
  const { count } = await supabaseAdmin
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('parent_service_id', serviceId)
    .eq('is_active', true);

  if (count && count > 0) {
    throw new Error(
      'Cannot delete variant group with active variants. Delete variants first.'
    );
  }

  // Soft delete by setting is_active to false
  const { error } = await supabaseAdmin
    .from('services')
    .update({ is_active: false })
    .eq('id', serviceId);

  if (error) {
    console.error('Error deleting service:', error);
    throw new Error('Failed to delete service');
  }

  revalidatePath('/admin/services');
}

export async function deleteVariant(variantId: string) {
  await requireAuth();

  // Soft delete
  const { error } = await supabaseAdmin
    .from('services')
    .update({ is_active: false })
    .eq('id', variantId);

  if (error) {
    console.error('Error deleting variant:', error);
    throw new Error('Failed to delete variant');
  }

  revalidatePath('/admin/services');
}

// =====================================================
// SERVICE VENUE ASSIGNMENTS
// =====================================================

export async function assignServiceVenues(
  serviceId: string,
  venueIds: string[]
) {
  await requireAuth();

  // Get current assignments
  const { data: currentAssignments } = await supabaseAdmin
    .from('service_venues')
    .select('venue_id')
    .eq('service_id', serviceId);

  const currentVenueIds = currentAssignments?.map((a) => a.venue_id) || [];

  // Determine what to add and remove
  const toAdd = venueIds.filter((id) => !currentVenueIds.includes(id));
  const toRemove = currentVenueIds.filter((id) => !venueIds.includes(id));

  // Add new assignments
  if (toAdd.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('service_venues')
      .insert(
        toAdd.map((venueId) => ({
          service_id: serviceId,
          venue_id: venueId,
        }))
      );

    if (insertError) {
      console.error('Error adding venue assignments:', insertError);
      throw new Error('Failed to assign venues');
    }
  }

  // Remove old assignments
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('service_venues')
      .delete()
      .eq('service_id', serviceId)
      .in('venue_id', toRemove);

    if (deleteError) {
      console.error('Error removing venue assignments:', deleteError);
      throw new Error('Failed to remove venues');
    }
  }

  revalidatePath('/admin/services');
}

// =====================================================
// SERVICE TEAM MEMBER ASSIGNMENTS
// =====================================================

export async function assignServiceTeamMembers(
  serviceId: string,
  teamMemberIds: string[]
) {
  await requireAuth();

  // Get current assignments
  const { data: currentAssignments } = await supabaseAdmin
    .from('service_team_members')
    .select('team_member_id')
    .eq('service_id', serviceId);

  const currentTeamMemberIds =
    currentAssignments?.map((a) => a.team_member_id) || [];

  // Determine what to add and remove
  const toAdd = teamMemberIds.filter(
    (id) => !currentTeamMemberIds.includes(id)
  );
  const toRemove = currentTeamMemberIds.filter(
    (id) => !teamMemberIds.includes(id)
  );

  // Add new assignments (with NULL custom pricing = use defaults)
  if (toAdd.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('service_team_members')
      .insert(
        toAdd.map((teamMemberId) => ({
          service_id: serviceId,
          team_member_id: teamMemberId,
          custom_price: null,
          custom_duration_minutes: null,
        }))
      );

    if (insertError) {
      console.error('Error adding team member assignments:', insertError);
      throw new Error('Failed to assign team members');
    }
  }

  // Remove old assignments
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('service_team_members')
      .delete()
      .eq('service_id', serviceId)
      .in('team_member_id', toRemove);

    if (deleteError) {
      console.error('Error removing team member assignments:', deleteError);
      throw new Error('Failed to remove team members');
    }
  }

  revalidatePath('/admin/services');
}

// =====================================================
// CUSTOM PRICING PER TEAM MEMBER
// =====================================================

export async function updateTeamMemberCustomPricing(
  serviceId: string,
  teamMemberId: string,
  customPrice: number | null,
  customDuration: number | null
) {
  await requireAuth();

  const { error } = await supabaseAdmin
    .from('service_team_members')
    .update({
      custom_price: customPrice,
      custom_duration_minutes: customDuration,
    })
    .eq('service_id', serviceId)
    .eq('team_member_id', teamMemberId);

  if (error) {
    console.error('Error updating custom pricing:', error);
    throw new Error('Failed to update custom pricing');
  }

  revalidatePath('/admin/services');
}

export async function resetTeamMemberToDefault(
  serviceId: string,
  teamMemberId: string
) {
  await requireAuth();

  const { error } = await supabaseAdmin
    .from('service_team_members')
    .update({
      custom_price: null,
      custom_duration_minutes: null,
    })
    .eq('service_id', serviceId)
    .eq('team_member_id', teamMemberId);

  if (error) {
    console.error('Error resetting to default:', error);
    throw new Error('Failed to reset pricing to default');
  }

  revalidatePath('/admin/services');
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export async function getAllVenues() {
  const { data, error } = await supabaseAdmin
    .from('venues')
    .select('id, name')
    .eq('is_listed', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching venues:', error);
    throw new Error('Failed to fetch venues');
  }

  return data || [];
}

export async function getAllTeamMembers() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, first_name, last_name, photo_url, roles')
    .contains('roles', ['team_member'])
    .order('first_name', { ascending: true });

  if (error) {
    console.error('Error fetching team members:', error);
    throw new Error('Failed to fetch team members');
  }

  return data || [];
}
