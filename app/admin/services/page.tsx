// app/admin/services/page.tsx
import { requireAdmin } from '@/lib/auth';
import { getServices, getCategories } from '@/app/actions/services';
import { ServiceListClient } from '@/components/admin/services';

export default async function ServicesPage() {
  await requireAdmin();

  const [services, categories] = await Promise.all([
    getServices(),
    getCategories(),
  ]);

  return (
    <ServiceListClient
      initialServices={services}
      initialCategories={categories}
    />
  );
}
