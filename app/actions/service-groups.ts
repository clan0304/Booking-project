// app/actions/service-groups.ts
'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

// ============================================================================
// SERVICE GROUPS - CRUD Operations
// ============================================================================

/**
 * Get all service groups with their service counts and minimum prices
 */
export async function getServiceGroups() {
  await requireAdmin();

  const { data: groups, error } = await supabaseAdmin
    .from('service_groups')
    .select(
      `
      *,
      service_categories (
        id,
        name,
        color
      )
    `
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching service groups:', error);
    throw new Error('Failed to fetch service groups');
  }

  // Get service counts and min prices for each group
  const groupsWithDetails = await Promise.all(
    groups.map(async (group) => {
      // Get service count
      const { count } = await supabaseAdmin
        .from('service_group_items')
        .select('id', { count: 'exact', head: true })
        .eq('service_group_id', group.id);

      // Get minimum price using the database function
      const { data: minPriceData } = await supabaseAdmin.rpc(
        'get_service_group_min_price',
        {
          p_service_group_id: group.id,
        }
      );

      return {
        ...group,
        service_count: count || 0,
        min_price: minPriceData || 0,
      };
    })
  );

  return groupsWithDetails;
}

/**
 * Get a single service group by ID with all its services
 */
export async function getServiceGroupById(groupId: string) {
  await requireAdmin();

  // Get the group details
  const { data: group, error: groupError } = await supabaseAdmin
    .from('service_groups')
    .select(
      `
      *,
      service_categories (
        id,
        name,
        color
      )
    `
    )
    .eq('id', groupId)
    .single();

  if (groupError) {
    console.error('Error fetching service group:', groupError);
    throw new Error('Failed to fetch service group');
  }

  // Get services in this group using the database function
  const { data: services, error: servicesError } = await supabaseAdmin.rpc(
    'get_services_in_group',
    {
      p_service_group_id: groupId,
    }
  );

  if (servicesError) {
    console.error('Error fetching services in group:', servicesError);
    throw new Error('Failed to fetch services in group');
  }

  return {
    ...group,
    services: services || [],
  };
}

/**
 * Create a new service group
 */
export async function createServiceGroup(formData: {
  name: string;
  category_id?: string;
  description?: string;
  display_mode: 'modal' | 'list';
  display_order?: number;
  service_ids?: string[]; // Optional: services to add immediately
}) {
  const user = await requireAdmin();

  // Create the service group
  const { data: group, error: groupError } = await supabaseAdmin
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

  if (groupError) {
    console.error('Error creating service group:', groupError);
    throw new Error('Failed to create service group');
  }

  // Add services to the group if provided
  if (formData.service_ids && formData.service_ids.length > 0) {
    await addServicesToGroup(group.id, formData.service_ids);
  }

  revalidatePath('/admin/services');
  return group;
}

/**
 * Update an existing service group
 */
export async function updateServiceGroup(
  groupId: string,
  formData: {
    name?: string;
    category_id?: string;
    description?: string;
    display_mode?: 'modal' | 'list';
    display_order?: number;
  }
) {
  await requireAdmin();

  const updateData: {
    name?: string;
    category_id?: string | null;
    description?: string | null;
    display_mode?: 'modal' | 'list';
    display_order?: number;
  } = {};

  if (formData.name !== undefined) updateData.name = formData.name.trim();
  if (formData.category_id !== undefined)
    updateData.category_id = formData.category_id || null;
  if (formData.description !== undefined)
    updateData.description = formData.description?.trim() || null;
  if (formData.display_mode !== undefined)
    updateData.display_mode = formData.display_mode;
  if (formData.display_order !== undefined)
    updateData.display_order = formData.display_order;

  const { data, error } = await supabaseAdmin
    .from('service_groups')
    .update(updateData)
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

/**
 * Delete a service group (soft delete)
 */
export async function deleteServiceGroup(groupId: string) {
  await requireAdmin();

  // Soft delete - set is_active to false
  const { error } = await supabaseAdmin
    .from('service_groups')
    .update({ is_active: false })
    .eq('id', groupId);

  if (error) {
    console.error('Error deleting service group:', error);
    throw new Error('Failed to delete service group');
  }

  revalidatePath('/admin/services');
  return true;
}

// ============================================================================
// SERVICE GROUP ITEMS - Managing services within groups
// ============================================================================

/**
 * Get services in a specific group
 */
export async function getServicesInGroup(groupId: string) {
  await requireAdmin();

  const { data: services, error } = await supabaseAdmin.rpc(
    'get_services_in_group',
    {
      p_service_group_id: groupId,
    }
  );

  if (error) {
    console.error('Error fetching services in group:', error);
    throw new Error('Failed to fetch services in group');
  }

  return services || [];
}

/**
 * Add multiple services to a group
 */
export async function addServicesToGroup(
  groupId: string,
  serviceIds: string[]
) {
  await requireAdmin();

  // Get the current max display order
  const { data: maxOrderData } = await supabaseAdmin
    .from('service_group_items')
    .select('display_order')
    .eq('service_group_id', groupId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single();

  const startOrder = maxOrderData ? maxOrderData.display_order + 1 : 0;

  // Create items for each service
  const items = serviceIds.map((serviceId, index) => ({
    service_group_id: groupId,
    service_id: serviceId,
    display_order: startOrder + index,
  }));

  const { error } = await supabaseAdmin
    .from('service_group_items')
    .insert(items);

  if (error) {
    // Handle duplicate entry errors (service already in group)
    if (error.code === '23505') {
      throw new Error('One or more services are already in this group');
    }
    console.error('Error adding services to group:', error);
    throw new Error('Failed to add services to group');
  }

  revalidatePath('/admin/services');
  return true;
}

/**
 * Remove a service from a group
 */
export async function removeServiceFromGroup(
  groupId: string,
  serviceId: string
) {
  await requireAdmin();

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
  return true;
}

/**
 * Update the display order of services within a group
 */
export async function updateServiceGroupOrder(
  groupId: string,
  serviceOrders: { serviceId: string; order: number }[]
) {
  await requireAdmin();

  // Update each service's display order
  const updates = serviceOrders.map(({ serviceId, order }) =>
    supabaseAdmin
      .from('service_group_items')
      .update({ display_order: order })
      .eq('service_group_id', groupId)
      .eq('service_id', serviceId)
  );

  const results = await Promise.all(updates);

  // Check for errors
  const errors = results.filter((result) => result.error);
  if (errors.length > 0) {
    console.error('Error updating service order:', errors);
    throw new Error('Failed to update service order');
  }

  revalidatePath('/admin/services');
  return true;
}

/**
 * Get all services available to add to a group (not already in the group)
 */
export async function getAvailableServicesForGroup(groupId: string) {
  await requireAdmin();

  // Get all active services
  const { data: allServices, error: servicesError } = await supabaseAdmin
    .from('services')
    .select(
      `
      id,
      name,
      price,
      duration_minutes,
      type,
      service_categories (
        id,
        name,
        color
      )
    `
    )
    .eq('is_active', true)
    .eq('type', 'service') // Only regular services, not bundles
    .order('name', { ascending: true });

  if (servicesError) {
    console.error('Error fetching services:', servicesError);
    throw new Error('Failed to fetch services');
  }

  // Get services already in this group
  const { data: groupServices, error: groupError } = await supabaseAdmin
    .from('service_group_items')
    .select('service_id')
    .eq('service_group_id', groupId);

  if (groupError) {
    console.error('Error fetching group services:', groupError);
    throw new Error('Failed to fetch group services');
  }

  const groupServiceIds = new Set(
    groupServices?.map((item) => item.service_id) || []
  );

  // Filter out services already in the group
  const availableServices = allServices?.filter(
    (service) => !groupServiceIds.has(service.id)
  );

  return availableServices || [];
}
