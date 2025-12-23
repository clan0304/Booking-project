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

      {/* Main Content - No padding, children control their own layout */}
      <main className="ml-20 pt-16">{children}</main>
    </div>
  );
}
