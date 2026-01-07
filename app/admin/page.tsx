// app/admin/page.tsx
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminDashboardClient } from '@/components/admin/dashboard/admin-dashboard-client';

export default async function AdminDashboardPage() {
  try {
    await requireStaff();
  } catch {
    redirect('/');
  }

  return (
    <AdminLayout>
      <AdminDashboardClient />
    </AdminLayout>
  );
}
