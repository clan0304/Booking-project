// components/public/public-layout.tsx
import { PublicNavbar } from './navbar';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      <main>{children}</main>
    </div>
  );
}
