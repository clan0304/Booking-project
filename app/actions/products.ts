// app/actions/products.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseJWTClient } from '@/lib/supabase/jwt-client';
import { requireAuth, requireAdmin } from '@/lib/auth';

// ==========================================
// TYPES
// ==========================================

// Category without venue_id (now global)
export type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
};

// Category-Venue junction
export type CategoryVenue = {
  id: string;
  category_id: string;
  venue_id: string;
  is_active: boolean;
  created_at: string;
};

// Category with venue assignments
export type CategoryWithVenues = Category & {
  category_venues: CategoryVenue[];
};

// Product without venue_id and quantity (now in junction table)
export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

// Product-Venue junction with quantity
export type ProductVenue = {
  id: string;
  product_id: string;
  venue_id: string;
  quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Product with category and venue assignments
export type ProductWithDetails = Product & {
  category: Category | null;
  product_venues: ProductVenue[];
};

// Venue assignment input for create/update
export type VenueAssignment = {
  venue_id: string;
  is_active: boolean;
  quantity?: number; // Only for products
};

// ==========================================
// CATEGORY ACTIONS
// ==========================================

/**
 * Get all categories with their venue assignments
 * Optionally filter by venue
 */
export async function getCategories(
  venueId?: string
): Promise<{ data: CategoryWithVenues[] | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    const { data: categories, error } = await supabase
      .from('categories')
      .select(
        `
        *,
        category_venues(*)
      `
      )
      .order('name', { ascending: true });

    if (error) throw error;

    // If filtering by venue, only return categories that have that venue assignment
    if (venueId) {
      const filtered = (categories || []).filter((cat) =>
        cat.category_venues.some(
          (cv: CategoryVenue) => cv.venue_id === venueId && cv.is_active
        )
      );
      return { data: filtered as CategoryWithVenues[], error: null };
    }

    return { data: categories as CategoryWithVenues[], error: null };
  } catch (error) {
    console.error('Error fetching categories:', error);
    return { data: null, error: 'Failed to fetch categories' };
  }
}

/**
 * Get a single category by ID with venue assignments
 */
export async function getCategoryById(
  id: string
): Promise<{ data: CategoryWithVenues | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase
      .from('categories')
      .select(
        `
        *,
        category_venues(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;

    return { data: data as CategoryWithVenues, error: null };
  } catch (error) {
    console.error('Error fetching category:', error);
    return { data: null, error: 'Failed to fetch category' };
  }
}

/**
 * Create a new category with venue assignments
 * Admin only - enforced by RLS
 */
export async function createCategory(data: {
  name: string;
  description?: string;
  color: string;
  venue_assignments: VenueAssignment[];
}): Promise<{ data: Category | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    // Create category
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        name: data.name,
        description: data.description || null,
        color: data.color,
      })
      .select()
      .single();

    if (categoryError) throw categoryError;

    // Create venue assignments
    if (data.venue_assignments.length > 0) {
      const assignments = data.venue_assignments.map((va) => ({
        category_id: category.id,
        venue_id: va.venue_id,
        is_active: va.is_active,
      }));

      const { error: assignmentError } = await supabase
        .from('category_venues')
        .insert(assignments);

      if (assignmentError) {
        console.error('Error creating venue assignments:', assignmentError);
        // Rollback: delete the category
        await supabase.from('categories').delete().eq('id', category.id);
        throw assignmentError;
      }
    }

    revalidatePath('/admin/products');
    return { data: category, error: null };
  } catch (error) {
    console.error('Error creating category:', error);
    return { data: null, error: 'Failed to create category' };
  }
}

/**
 * Update a category and its venue assignments
 * Admin only - enforced by RLS
 */
export async function updateCategory(
  id: string,
  data: {
    name?: string;
    description?: string;
    color?: string;
    venue_assignments?: VenueAssignment[];
  }
): Promise<{ data: Category | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    // Update category fields
    const updateFields: Record<string, unknown> = {};
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined)
      updateFields.description = data.description || null;
    if (data.color !== undefined) updateFields.color = data.color;

    let category;
    if (Object.keys(updateFields).length > 0) {
      const { data: updatedCategory, error } = await supabase
        .from('categories')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      category = updatedCategory;
    } else {
      // Just fetch current category if no fields to update
      const { data: currentCategory, error } = await supabase
        .from('categories')
        .select()
        .eq('id', id)
        .single();

      if (error) throw error;
      category = currentCategory;
    }

    // Update venue assignments if provided
    if (data.venue_assignments !== undefined) {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('category_venues')
        .delete()
        .eq('category_id', id);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (data.venue_assignments.length > 0) {
        const assignments = data.venue_assignments.map((va) => ({
          category_id: id,
          venue_id: va.venue_id,
          is_active: va.is_active,
        }));

        const { error: insertError } = await supabase
          .from('category_venues')
          .insert(assignments);

        if (insertError) throw insertError;
      }
    }

    revalidatePath('/admin/products');
    return { data: category, error: null };
  } catch (error) {
    console.error('Error updating category:', error);
    return { data: null, error: 'Failed to update category' };
  }
}

/**
 * Delete a category (cascade deletes venue assignments)
 * Admin only - enforced by RLS
 */
export async function deleteCategory(
  id: string
): Promise<{ error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const { error } = await supabase.from('categories').delete().eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/products');
    return { error: null };
  } catch (error) {
    console.error('Error deleting category:', error);
    return { error: 'Failed to delete category' };
  }
}

// ==========================================
// PRODUCT ACTIONS
// ==========================================

/**
 * Get all products with their categories and venue assignments
 * Optionally filter by venue
 */
export async function getProducts(
  venueId?: string
): Promise<{ data: ProductWithDetails[] | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    const { data: products, error } = await supabase
      .from('products')
      .select(
        `
        *,
        category:categories(*),
        product_venues(*)
      `
      )
      .order('name', { ascending: true });

    if (error) throw error;

    // If filtering by venue, only return products that have that venue assignment
    if (venueId) {
      const filtered = (products || []).filter((prod) =>
        prod.product_venues.some(
          (pv: ProductVenue) => pv.venue_id === venueId && pv.is_active
        )
      );
      return { data: filtered as ProductWithDetails[], error: null };
    }

    return { data: products as ProductWithDetails[], error: null };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { data: null, error: 'Failed to fetch products' };
  }
}

/**
 * Get a single product by ID with details
 */
export async function getProductById(
  id: string
): Promise<{ data: ProductWithDetails | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase
      .from('products')
      .select(
        `
        *,
        category:categories(*),
        product_venues(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;

    return { data: data as ProductWithDetails, error: null };
  } catch (error) {
    console.error('Error fetching product:', error);
    return { data: null, error: 'Failed to fetch product' };
  }
}

/**
 * Create a new product with venue assignments
 * Admin only - enforced by RLS
 */
export async function createProduct(data: {
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  image_url?: string;
  venue_assignments: VenueAssignment[];
}): Promise<{ data: Product | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    // Create product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name: data.name,
        description: data.description || null,
        price: data.price,
        category_id: data.category_id || null,
        image_url: data.image_url || null,
      })
      .select()
      .single();

    if (productError) throw productError;

    // Create venue assignments with quantities
    if (data.venue_assignments.length > 0) {
      const assignments = data.venue_assignments.map((va) => ({
        product_id: product.id,
        venue_id: va.venue_id,
        quantity: va.quantity || 0,
        is_active: va.is_active,
      }));

      const { error: assignmentError } = await supabase
        .from('product_venues')
        .insert(assignments);

      if (assignmentError) {
        console.error('Error creating venue assignments:', assignmentError);
        // Rollback: delete the product
        await supabase.from('products').delete().eq('id', product.id);
        throw assignmentError;
      }
    }

    revalidatePath('/admin/products');
    return { data: product, error: null };
  } catch (error) {
    console.error('Error creating product:', error);
    return { data: null, error: 'Failed to create product' };
  }
}

/**
 * Update a product and its venue assignments
 * Admin only - enforced by RLS
 */
export async function updateProduct(
  id: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    category_id?: string | null;
    image_url?: string | null;
    venue_assignments?: VenueAssignment[];
  }
): Promise<{ data: Product | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    // Update product fields
    const updateFields: Record<string, unknown> = {};
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined)
      updateFields.description = data.description || null;
    if (data.price !== undefined) updateFields.price = data.price;
    if (data.category_id !== undefined)
      updateFields.category_id = data.category_id || null;
    if (data.image_url !== undefined)
      updateFields.image_url = data.image_url || null;

    let product;
    if (Object.keys(updateFields).length > 0) {
      const { data: updatedProduct, error } = await supabase
        .from('products')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      product = updatedProduct;
    } else {
      // Just fetch current product if no fields to update
      const { data: currentProduct, error } = await supabase
        .from('products')
        .select()
        .eq('id', id)
        .single();

      if (error) throw error;
      product = currentProduct;
    }

    // Update venue assignments if provided
    if (data.venue_assignments !== undefined) {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('product_venues')
        .delete()
        .eq('product_id', id);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (data.venue_assignments.length > 0) {
        const assignments = data.venue_assignments.map((va) => ({
          product_id: id,
          venue_id: va.venue_id,
          quantity: va.quantity || 0,
          is_active: va.is_active,
        }));

        const { error: insertError } = await supabase
          .from('product_venues')
          .insert(assignments);

        if (insertError) throw insertError;
      }
    }

    revalidatePath('/admin/products');
    return { data: product, error: null };
  } catch (error) {
    console.error('Error updating product:', error);
    return { data: null, error: 'Failed to update product' };
  }
}

/**
 * Update product quantity for a specific venue
 * Admin only - enforced by RLS
 */
export async function updateProductVenueQuantity(
  productId: string,
  venueId: string,
  quantity: number
): Promise<{ error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const { error } = await supabase
      .from('product_venues')
      .update({ quantity })
      .eq('product_id', productId)
      .eq('venue_id', venueId);

    if (error) throw error;

    revalidatePath('/admin/products');
    return { error: null };
  } catch (error) {
    console.error('Error updating product quantity:', error);
    return { error: 'Failed to update quantity' };
  }
}

/**
 * Delete a product (cascade deletes venue assignments)
 * Admin only - enforced by RLS
 */
export async function deleteProduct(
  id: string
): Promise<{ error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/products');
    return { error: null };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { error: 'Failed to delete product' };
  }
}

// ==========================================
// IMAGE UPLOAD ACTIONS
// ==========================================

/**
 * Upload product image to Supabase Storage
 * Admin only - enforced by storage RLS
 * Uses FormData to handle file upload through Server Actions
 */
export async function uploadProductImage(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const file = formData.get('file') as File;

    if (!file) {
      return { url: null, error: 'No file provided' };
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: 'File size must be less than 5MB' };
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { url: null, error: 'File must be an image' };
    }

    // Convert file to array buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const ext = file.name.split('.').pop();
    const filename = `products/${timestamp}-${randomStr}.${ext}`;

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filename, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('product-images').getPublicUrl(data.path);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('Error uploading image:', error);
    return { url: null, error: 'Failed to upload image' };
  }
}

/**
 * Delete product image from Supabase Storage
 * Admin only - enforced by storage RLS
 */
export async function deleteProductImage(
  imageUrl: string
): Promise<{ error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    // Extract path from URL
    const url = new URL(imageUrl);
    const path = url.pathname.split('/product-images/')[1];

    if (!path) {
      return { error: 'Invalid image URL' };
    }

    const { error } = await supabase.storage
      .from('product-images')
      .remove([path]);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting image:', error);
    return { error: 'Failed to delete image' };
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get product stock for a specific venue
 */
export async function getProductStockByVenue(
  venueId: string
): Promise<{
  data: Array<{ product: Product; quantity: number }> | null;
  error: string | null;
}> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase
      .from('product_venues')
      .select(
        `
        quantity,
        product:products(*)
      `
      )
      .eq('venue_id', venueId)
      .eq('is_active', true);

    if (error) throw error;

    const result = (data || []).map((item) => ({
      product: item.product as unknown as Product,
      quantity: item.quantity,
    }));

    return { data: result, error: null };
  } catch (error) {
    console.error('Error fetching product stock:', error);
    return { data: null, error: 'Failed to fetch product stock' };
  }
}

/**
 * Get categories available for a specific venue
 */
export async function getCategoriesByVenue(
  venueId: string
): Promise<{ data: Category[] | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase
      .from('category_venues')
      .select(
        `
        category:categories(*)
      `
      )
      .eq('venue_id', venueId)
      .eq('is_active', true);

    if (error) throw error;

    const categories = (data || [])
      .map((item) => item.category as unknown as Category)
      .filter(Boolean);

    return { data: categories, error: null };
  } catch (error) {
    console.error('Error fetching venue categories:', error);
    return { data: null, error: 'Failed to fetch categories' };
  }
}

/**
 * Bulk update stock quantities for a venue
 */
export async function bulkUpdateStock(
  venueId: string,
  updates: Array<{ product_id: string; quantity: number }>
): Promise<{ error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    // Update each product's quantity
    for (const update of updates) {
      const { error } = await supabase
        .from('product_venues')
        .update({ quantity: update.quantity })
        .eq('product_id', update.product_id)
        .eq('venue_id', venueId);

      if (error) throw error;
    }

    revalidatePath('/admin/products');
    return { error: null };
  } catch (error) {
    console.error('Error bulk updating stock:', error);
    return { error: 'Failed to update stock' };
  }
}

/**
 * Decrement product stock after a sale
 * Used by checkout flow after successful payment
 */
export async function decrementProductStock(
  venueId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<{ error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    for (const item of items) {
      // Get current quantity
      const { data: current, error: fetchError } = await supabase
        .from('product_venues')
        .select('quantity')
        .eq('product_id', item.productId)
        .eq('venue_id', venueId)
        .single();

      if (fetchError) {
        console.error('Error fetching product stock:', fetchError);
        continue; // Don't fail entire operation
      }

      // Calculate new quantity (don't go below 0)
      const newQuantity = Math.max(0, (current?.quantity || 0) - item.quantity);

      // Update quantity
      const { error: updateError } = await supabase
        .from('product_venues')
        .update({ quantity: newQuantity })
        .eq('product_id', item.productId)
        .eq('venue_id', venueId);

      if (updateError) {
        console.error('Error updating product stock:', updateError);
      }
    }

    revalidatePath('/admin/products');
    return { error: null };
  } catch (error) {
    console.error('Error decrementing product stock:', error);
    return { error: 'Failed to update stock' };
  }
}
