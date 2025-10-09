// app/admin/marketplace/page.tsx
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { MarketplaceClient } from '@/components/admin/marketplace/marketplace-client';
import type { Venue } from '@/types/database';

export default async function MarketplacePage() {
  await requireAdmin();

  // Fetch all venues
  const { data: venues, error } = await supabaseAdmin
    .from('venues')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching venues:', error);
  }

  return <MarketplaceClient initialVenues={(venues as Venue[]) || []} />;
}
