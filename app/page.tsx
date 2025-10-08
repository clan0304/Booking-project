// app/page.tsx
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900">
          Hair Salon Booking System
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Professional salon management made simple
        </p>

        <div className="mt-8 flex gap-4 justify-center">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/admin"
                className="rounded-lg border-2 border-black px-6 py-3 text-black hover:bg-black hover:text-white"
              >
                Admin Panel
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800"
              >
                Sign In
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border-2 border-black px-6 py-3 text-black hover:bg-black hover:text-white"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {user && (
          <div className="mt-8">
            <p className="text-sm text-gray-500">You are signed in</p>
          </div>
        )}
      </div>
    </div>
  );
}
