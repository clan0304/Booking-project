// app/unauthorized/page.tsx
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">403</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-700">
          Access Denied
        </h2>
        <p className="mt-2 text-gray-600">
          You don&apos;t have permission to access this page.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Only administrators and team members can access the admin panel.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
