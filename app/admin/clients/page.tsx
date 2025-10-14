// app/admin/clients/page.tsx
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ClientListClient } from '@/components/admin/clients';

export default async function ClientsPage() {
  await requireAdmin();

  // Fetch all clients with note counts
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
      created_at
    `
    )
    .contains('roles', ['client'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching clients:', error);
  }

  // Get note counts separately (Supabase aggregation)
  const clientsWithNoteCounts = await Promise.all(
    (clients || []).map(async (client) => {
      const { count } = await supabaseAdmin
        .from('client_notes')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id);

      return {
        ...client,
        note_count: count || 0,
      };
    })
  );

  return <ClientListClient initialClients={clientsWithNoteCounts} />;
}
