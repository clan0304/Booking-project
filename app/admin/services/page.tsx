// app/admin/services/page.tsx
import { requireAdmin } from '@/lib/auth';
import { getServices, getCategories } from '@/app/actions/services';
import { getServiceGroups } from '@/app/actions/service-groups';
import { ServiceListClient } from '@/components/admin/services';

// ✅ Force dynamic rendering - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ServicesPage() {
  await requireAdmin();

  const [services, categories, serviceGroups] = await Promise.all([
    getServices(),
    getCategories(),
    getServiceGroups(),
  ]);

  return (
    <ServiceListClient
      initialServices={services}
      initialCategories={categories}
      initialServiceGroups={serviceGroups}
    />
  );
}
