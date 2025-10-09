// app/admin/layout.tsx
import { requireStaff } from '@/lib/auth';
import { AdminLayout } from '@/components/admin/admin-layout';

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify staff access (admin or team_member)
  await requireStaff();

  return <AdminLayout>{children}</AdminLayout>;
}
