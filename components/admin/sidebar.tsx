// components/admin/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  Tag,
  Smile,
  BookOpen,
  User,
  Megaphone,
  Users,
  TrendingUp,
  LayoutGrid,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', icon: Home, label: 'Home', exact: true },
  { href: '/admin/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/admin/services', icon: Tag, label: 'Services' },
  { href: '/admin/clients', icon: Smile, label: 'Clients' },
  { href: '/admin/bookings', icon: BookOpen, label: 'Bookings' },
  { href: '/admin/profile', icon: User, label: 'Profile' },
  { href: '/admin/marketplace', icon: Megaphone, label: 'Marketplace' },
  { href: '/admin/team', icon: Users, label: 'Team' },
  { href: '/admin/analytics', icon: TrendingUp, label: 'Analytics' },
  { href: '/admin/more', icon: LayoutGrid, label: 'More' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-20 bg-[#0a0a0a] flex flex-col items-center py-6">
      {navItems.map((item, index) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group relative flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200',
              index === 0 && 'mb-4',
              isActive
                ? 'bg-[#6C5CE7] text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon className="h-6 w-6" />

            {/* Tooltip */}
            <span className="absolute left-full ml-4 w-max rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 pointer-events-none">
              {item.label}
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </span>
          </Link>
        );
      })}
    </aside>
  );
}
