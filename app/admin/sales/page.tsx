// app/admin/sales/page.tsx
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/admin/admin-layout';
import { SalesClient } from '@/components/admin/sales/sales-client';

export default async function SalesPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/');
  }

  // Fetch all venues for filtering (admins can view sales from any venue)
  const { data: venues } = await supabaseAdmin
    .from('venues')
    .select('id, name')
    .order('name');

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <SalesClient venues={venues || []} />
      </div>
    </AdminLayout>
  );
}
