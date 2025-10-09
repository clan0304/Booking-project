// components/admin/admin-layout.tsx
import { AdminSidebar } from './sidebar';
import { AdminNavbar } from './navbar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <AdminNavbar />

      {/* Main Content */}
      <main className="ml-20 pt-16">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
