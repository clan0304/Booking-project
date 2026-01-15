// components/public/navbar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignInButton, SignOutButton, useUser } from '@clerk/nextjs';
import {
  Menu,
  X,
  User,
  Calendar,
  LogOut,
  ChevronDown,
  Scissors,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Locations', href: '/#locations' },
  { name: 'My Bookings', href: '/dashboard', requiresAuth: true },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const { isSignedIn, user, isLoaded } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-500 rounded-lg flex items-center justify-center">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:block">
              Hair Salon
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              // Skip auth-required links if not signed in
              if (item.requiresAuth && !isSignedIn) return null;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Right Section - Auth */}
          <div className="flex items-center gap-3">
            {/* Desktop Auth */}
            <div className="hidden md:block">
              {!isLoaded ? (
                // Loading state
                <div className="w-20 h-9 bg-gray-100 rounded-lg animate-pulse" />
              ) : isSignedIn ? (
                // User Menu
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt={user.firstName || 'User'}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-purple-600" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {user?.firstName || 'Account'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />

                      {/* Menu */}
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                        {/* User Info */}
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">
                            {user?.firstName} {user?.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user?.primaryEmailAddress?.emailAddress}
                          </p>
                        </div>

                        {/* Menu Items */}
                        <div className="py-1">
                          <Link
                            href="/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <User className="w-4 h-4 text-gray-400" />
                            My Profile
                          </Link>
                          <Link
                            href="/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Calendar className="w-4 h-4 text-gray-400" />
                            My Bookings
                          </Link>
                        </div>

                        {/* Sign Out */}
                        <div className="border-t border-gray-100 pt-1">
                          <SignOutButton>
                            <button className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                              <LogOut className="w-4 h-4" />
                              Sign Out
                            </button>
                          </SignOutButton>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // Sign In Button
                <SignInButton mode="modal">
                  <button className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                    Sign In
                  </button>
                </SignInButton>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navigation.map((item) => {
              if (item.requiresAuth && !isSignedIn) return null;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'block px-4 py-3 rounded-lg text-base font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Mobile Auth Section */}
          <div className="px-4 py-3 border-t border-gray-200">
            {isSignedIn ? (
              <div className="space-y-2">
                {/* User Info */}
                <div className="flex items-center gap-3 px-4 py-2">
                  {user?.imageUrl ? (
                    <Image
                      src={user.imageUrl}
                      alt={user.firstName || 'User'}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </div>

                {/* Mobile Menu Links */}
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <User className="w-5 h-5 text-gray-400" />
                  My Profile
                </Link>

                <SignOutButton>
                  <button className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg">
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                </SignOutButton>
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="w-full px-4 py-3 bg-gray-900 text-white text-base font-medium rounded-lg hover:bg-gray-800 transition-colors">
                  Sign In
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
