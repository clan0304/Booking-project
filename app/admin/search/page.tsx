// app/admin/search/page.tsx
import { requireStaff } from '@/lib/auth';
import {
  getRecentClients,
  getUpcomingAppointments,
} from '@/app/actions/search';
import { SearchClient } from '@/components/admin/search';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SearchPage() {
  await requireStaff();

  // Fetch initial data in parallel
  const [clientsResult, appointmentsResult] = await Promise.all([
    getRecentClients(),
    getUpcomingAppointments(),
  ]);

  return (
    <SearchClient
      initialClients={clientsResult.data || []}
      initialAppointments={appointmentsResult.data || []}
    />
  );
}
