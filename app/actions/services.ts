// app/actions/services.ts
'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

// =====================================================
// TYPES
// =====================================================

/**
 * Service category info from database
 */
interface ServiceCategoryInfo {
  name: string;
  color: string;
}

/**
 * Custom pricing info for team member
 */
interface ServiceTeamMemberInfo {
  team_member_id: string;
  custom_price: number | null;
  custom_duration_minutes: number | null;
}

/**
 * Raw service data from Supabase query
 */
interface RawServiceFromDB {
  id: string;
  name: string;
  type: 'service' | 'bundle';
  duration_minutes: number;
  price: number | null;
  service_categories: ServiceCategoryInfo | ServiceCategoryInfo[] | null;
  service_team_members: ServiceTeamMemberInfo | ServiceTeamMemberInfo[];
}

/**
 * Transformed service for client consumption
 */
interface AvailableService {
  id: string;
  name: string;
  type: 'service' | 'bundle';
  base_duration: number;
  base_price: number | null;
  service_categories: {
    name: string;
    color: string;
  } | null;
}

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
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching services:', error);
    throw new Error('Failed to fetch services');
  }

  return data || [];
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

export async function createService(formData: {
  name: string;
  category_id?: string;
  description?: string;
  type: 'service' | 'bundle';
  price_type: 'fixed' | 'from';
  price: number;
  duration_minutes: number;
  venue_ids?: string[];
  team_member_ids?: string[];
}) {
  const user = await requireAuth();

  // Create service
  const { data: service, error: serviceError } = await supabaseAdmin
    .from('services')
    .insert({
      name: formData.name.trim(),
      category_id: formData.category_id || null,
      description: formData.description?.trim() || null,
      type: formData.type,
      price_type: formData.price_type,
      price: formData.price,
      duration_minutes: formData.duration_minutes,
      is_bookable: true, // All services are now bookable
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

export async function updateService(
  serviceId: string,
  formData: {
    name: string;
    category_id?: string;
    description?: string;
    price_type: 'fixed' | 'from';
    price: number;
    duration_minutes: number;
    venue_ids?: string[];
    team_member_ids?: string[];
  }
) {
  await requireAuth();

  const { data, error } = await supabaseAdmin
    .from('services')
    .update({
      name: formData.name.trim(),
      category_id: formData.category_id || null,
      description: formData.description?.trim() || null,
      price_type: formData.price_type,
      price: formData.price,
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

  // Check if service is part of any bundles
  const { count: bundleCount } = await supabaseAdmin
    .from('bundle_items')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', serviceId);

  if (bundleCount && bundleCount > 0) {
    throw new Error(
      'Cannot delete service that is part of a bundle. Remove from bundles first.'
    );
  }

  // Check if service is in any service groups
  const { count: groupCount } = await supabaseAdmin
    .from('service_group_items')
    .select('id', { count: 'exact', head: true })
    .eq('service_id', serviceId);

  if (groupCount && groupCount > 0) {
    throw new Error(
      'Cannot delete service that belongs to service groups. Remove from groups first.'
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

// =====================================================
// SERVICE GROUPS
// =====================================================

export async function getServiceGroups() {
  const { data, error } = await supabaseAdmin
    .from('service_groups')
    .select(
      `
      *,
      category:service_categories(id, name, color)
    `
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching service groups:', error);
    throw new Error('Failed to fetch service groups');
  }

  return data || [];
}

export async function getServiceGroupById(groupId: string) {
  const { data, error } = await supabaseAdmin
    .from('service_groups')
    .select(
      `
      *,
      category:service_categories(id, name, color)
    `
    )
    .eq('id', groupId)
    .single();

  if (error) {
    console.error('Error fetching service group:', error);
    throw new Error('Failed to fetch service group');
  }

  return data;
}

export async function getServicesInGroup(groupId: string) {
  const { data, error } = await supabaseAdmin.rpc('get_services_in_group', {
    p_service_group_id: groupId,
  });

  if (error) {
    console.error('Error fetching services in group:', error);
    throw new Error('Failed to fetch services in group');
  }

  return data || [];
}

export async function getServiceGroupsForService(serviceId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    'get_service_groups_for_service',
    {
      p_service_id: serviceId,
    }
  );

  if (error) {
    console.error('Error fetching groups for service:', error);
    throw new Error('Failed to fetch groups for service');
  }

  return data || [];
}

export async function createServiceGroup(formData: {
  name: string;
  category_id?: string;
  description?: string;
  display_mode: 'modal' | 'list';
  display_order?: number;
}) {
  const user = await requireAuth();

  const { data, error } = await supabaseAdmin
    .from('service_groups')
    .insert({
      name: formData.name.trim(),
      category_id: formData.category_id || null,
      description: formData.description?.trim() || null,
      display_mode: formData.display_mode,
      display_order: formData.display_order || 0,
      created_by: user.supabaseUserId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating service group:', error);
    throw new Error('Failed to create service group');
  }

  revalidatePath('/admin/services');
  return data;
}

export async function updateServiceGroup(
  groupId: string,
  formData: {
    name: string;
    category_id?: string;
    description?: string;
    display_mode: 'modal' | 'list';
    display_order?: number;
  }
) {
  await requireAuth();

  const { data, error } = await supabaseAdmin
    .from('service_groups')
    .update({
      name: formData.name.trim(),
      category_id: formData.category_id || null,
      description: formData.description?.trim() || null,
      display_mode: formData.display_mode,
      display_order: formData.display_order || 0,
    })
    .eq('id', groupId)
    .select()
    .single();

  if (error) {
    console.error('Error updating service group:', error);
    throw new Error('Failed to update service group');
  }

  revalidatePath('/admin/services');
  return data;
}

export async function deleteServiceGroup(groupId: string) {
  await requireAuth();

  // Soft delete by setting is_active to false
  const { error } = await supabaseAdmin
    .from('service_groups')
    .update({ is_active: false })
    .eq('id', groupId);

  if (error) {
    console.error('Error deleting service group:', error);
    throw new Error('Failed to delete service group');
  }

  revalidatePath('/admin/services');
}

export async function addServiceToGroup(
  groupId: string,
  serviceId: string,
  displayOrder?: number
) {
  await requireAuth();

  const { error } = await supabaseAdmin.from('service_group_items').insert({
    service_group_id: groupId,
    service_id: serviceId,
    display_order: displayOrder || 0,
  });

  if (error) {
    console.error('Error adding service to group:', error);
    throw new Error('Failed to add service to group');
  }

  revalidatePath('/admin/services');
}

export async function removeServiceFromGroup(
  groupId: string,
  serviceId: string
) {
  await requireAuth();

  const { error } = await supabaseAdmin
    .from('service_group_items')
    .delete()
    .eq('service_group_id', groupId)
    .eq('service_id', serviceId);

  if (error) {
    console.error('Error removing service from group:', error);
    throw new Error('Failed to remove service from group');
  }

  revalidatePath('/admin/services');
}

export async function updateServiceGroupOrder(
  groupId: string,
  serviceOrders: { serviceId: string; displayOrder: number }[]
) {
  await requireAuth();

  // Update each service's display order
  const updates = serviceOrders.map(({ serviceId, displayOrder }) =>
    supabaseAdmin
      .from('service_group_items')
      .update({ display_order: displayOrder })
      .eq('service_group_id', groupId)
      .eq('service_id', serviceId)
  );

  const results = await Promise.all(updates);

  const hasError = results.some((result) => result.error);
  if (hasError) {
    console.error('Error updating service group order');
    throw new Error('Failed to update service group order');
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
    throw new Error('Failed to reset to default');
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
    .select('id, first_name, last_name, photo_url')
    .contains('roles', ['team_member'])
    .order('first_name', { ascending: true });

  if (error) {
    console.error('Error fetching team members:', error);
    throw new Error('Failed to fetch team members');
  }

  return data || [];
}

// =====================================================
// BOOKING-RELATED QUERIES
// =====================================================

/**
 * Get available services for booking (filtered by venue and team member)
 * Used in booking flow
 */
export async function getAvailableServices(
  venueId: string,
  teamMemberId: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('services')
      .select(
        `
        id,
        name,
        type,
        duration_minutes,
        price,
        service_categories (
          name,
          color
        ),
        service_team_members!inner (
          team_member_id,
          custom_price,
          custom_duration_minutes
        )
      `
      )
      .eq('is_active', true)
      .eq('is_bookable', true)
      .eq('service_team_members.team_member_id', teamMemberId)
      .eq('service_team_members.is_active', true);

    if (error) {
      console.error('Supabase error:', error);
      throw new Error('Failed to fetch services from database');
    }

    // Filter services that are assigned to this venue
    const { data: venueServices } = await supabaseAdmin
      .from('service_venues')
      .select('service_id')
      .eq('venue_id', venueId)
      .eq('is_active', true);

    const venueServiceIds = new Set(
      venueServices?.map((vs) => vs.service_id) || []
    );

    // Transform and filter the data
    const services: AvailableService[] = (data as RawServiceFromDB[])
      .filter((service) => venueServiceIds.has(service.id))
      .map((service) => {
        // Handle service_categories being array or single object
        const category = Array.isArray(service.service_categories)
          ? service.service_categories[0]
          : service.service_categories;

        return {
          id: service.id,
          name: service.name,
          type: service.type,
          base_duration: service.duration_minutes,
          base_price: service.price,
          service_categories: category
            ? {
                name: category.name,
                color: category.color,
              }
            : null,
        };
      });

    return { success: true, services };
  } catch (error) {
    console.error('Error in getAvailableServices:', error);
    return {
      success: false,
      services: [],
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch available services',
    };
  }
}
