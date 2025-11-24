// app/admin/calendar/page.tsx
import { CalendarClient } from '@/components/admin/calendar/calendar-client';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Venue {
  id: string;
  name: string;
}

async function getVenues(): Promise<Venue[]> {
  const { data, error } = await supabaseAdmin
    .from('venues')
    .select('id, name') // Only what we need!
    .eq('is_listed', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching venues:', error);
    return [];
  }

  return data || [];
}

export default async function CalendarPage() {
  await requireAdmin();

  // ✅ Fetch venues on server (fast, no client delay)
  const venues = await getVenues();

  return <CalendarClient initialVenues={venues} />;
}
