// app/actions/products.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseJWTClient } from '@/lib/supabase/jwt-client';
import { requireAuth, requireAdmin } from '@/lib/auth';

// ==========================================
// TYPES
// ==========================================

export type Category = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  category_id: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductWithCategory = Product & {
  category: Category | null;
};

// ==========================================
// CATEGORY ACTIONS
// ==========================================

/**
 * Get all categories (optionally filtered by venue)
 * Uses JWT client - respects RLS policies
 */
export async function getCategories(
  venueId?: string
): Promise<{ data: Category[] | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    let query = supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false });

    if (venueId) {
      query = query.eq('venue_id', venueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching categories:', error);
    return { data: null, error: 'Failed to fetch categories' };
  }
}

/**
 * Create a new category
 * Admin only - enforced by RLS
 */
export async function createCategory(data: {
  venue_id: string;
  name: string;
  description?: string;
  color: string;
}): Promise<{ data: Category | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        venue_id: data.venue_id,
        name: data.name,
        description: data.description || null,
        color: data.color,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    return { data: category, error: null };
  } catch (error) {
    console.error('Error creating category:', error);
    return { data: null, error: 'Failed to create category' };
  }
}

/**
 * Update a category
 * Admin only - enforced by RLS
 */
export async function updateCategory(
  id: string,
  data: {
    name?: string;
    description?: string;
    color?: string;
  }
): Promise<{ data: Category | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const { data: category, error } = await supabase
      .from('categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    return { data: category, error: null };
  } catch (error) {
    console.error('Error updating category:', error);
    return { data: null, error: 'Failed to update category' };
  }
}

/**
 * Delete a category
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
 * Get all products with their categories (optionally filtered by venue)
 * Uses JWT client - respects RLS policies
 */
export async function getProducts(
  venueId?: string
): Promise<{ data: ProductWithCategory[] | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    let query = supabase
      .from('products')
      .select(
        `
        *,
        category:categories(*)
      `
      )
      .order('created_at', { ascending: false });

    if (venueId) {
      query = query.eq('venue_id', venueId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching products:', error);
    return { data: null, error: 'Failed to fetch products' };
  }
}

/**
 * Get a single product by ID
 */
export async function getProductById(
  id: string
): Promise<{ data: ProductWithCategory | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createSupabaseJWTClient();

    const { data, error } = await supabase
      .from('products')
      .select(
        `
        *,
        category:categories(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching product:', error);
    return { data: null, error: 'Failed to fetch product' };
  }
}

/**
 * Create a new product
 * Admin only - enforced by RLS
 */
export async function createProduct(data: {
  venue_id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  category_id?: string;
  image_url?: string;
}): Promise<{ data: Product | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        venue_id: data.venue_id,
        name: data.name,
        description: data.description || null,
        price: data.price,
        quantity: data.quantity,
        category_id: data.category_id || null,
        image_url: data.image_url || null,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    return { data: product, error: null };
  } catch (error) {
    console.error('Error creating product:', error);
    return { data: null, error: 'Failed to create product' };
  }
}

/**
 * Update a product
 * Admin only - enforced by RLS
 */
export async function updateProduct(
  id: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    quantity?: number;
    category_id?: string;
    image_url?: string;
  }
): Promise<{ data: Product | null; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createSupabaseJWTClient();

    const { data: product, error } = await supabase
      .from('products')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    return { data: product, error: null };
  } catch (error) {
    console.error('Error updating product:', error);
    return { data: null, error: 'Failed to update product' };
  }
}

/**
 * Delete a product
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
  venueId: string,
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
    const filename = `${venueId}/${timestamp}-${randomStr}.${ext}`;

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
