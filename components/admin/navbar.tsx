// components/admin/navbar.tsx
'use client';

import { Search, Bell, ShoppingBag, MessageSquare } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export function AdminNavbar() {
  return (
    <nav className="fixed top-0 right-0 left-20 z-30 h-16 bg-white border-b border-gray-200">
      <div className="flex h-full items-center justify-between px-6">
        {/* Logo */}
        <Link href="/admin" className="flex items-center">
          <span className="text-2xl font-bold text-gray-900">fresha</span>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100">
            <Search className="h-5 w-5" />
          </button>

          {/* Notifications */}
          <button className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              1
            </span>
          </button>

          {/* Shopping Bag */}
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100">
            <ShoppingBag className="h-5 w-5" />
          </button>

          {/* Messages */}
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100">
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* User Profile */}
          <div className="ml-2">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>
    </nav>
  );
}
