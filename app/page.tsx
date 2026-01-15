// app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser } from '@/lib/auth';
import { SignOutButton } from '@clerk/nextjs';
import { supabaseAdmin } from '@/lib/supabase/server';
import { MapPin, Calendar } from 'lucide-react';

interface Venue {
  id: string;
  name: string;
  address: string;
  phone_number: string | null;
  photo_url: string | null;
  slug: string;
  is_listed: boolean;
}

async function getListedVenues(): Promise<Venue[]> {
  const { data: venues, error } = await supabaseAdmin
    .from('venues')
    .select('id, name, address, phone_number, photo_url, slug, is_listed')
    .eq('is_listed', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching venues:', error);
    return [];
  }

  return venues || [];
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const venues = await getListedVenues();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center pt-20 pb-12 px-4">
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
                  className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800 transition-colors"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/admin"
                  className="rounded-lg border-2 border-black px-6 py-3 text-black hover:bg-black hover:text-white transition-colors"
                >
                  Admin Panel
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-lg border-2 border-black px-6 py-3 text-black hover:bg-black hover:text-white transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {user && (
            <div className="mt-8">
              <p className="text-sm text-gray-500 mb-3">You are signed in</p>
              <SignOutButton>
                <button className="rounded-lg border-2 border-gray-300 px-6 py-2 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                  Sign Out
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>

      {/* Venues Section */}
      {venues.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Our Locations</h2>
            <p className="mt-2 text-gray-600">
              Book your appointment at any of our venues
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow group"
              >
                {/* Venue Image */}
                <div className="relative h-48 bg-gray-200">
                  {venue.photo_url ? (
                    <Image
                      src={venue.photo_url}
                      alt={venue.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                      <span className="text-4xl font-bold text-purple-300">
                        {venue.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Venue Info */}
                <div className="p-5">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {venue.name}
                  </h3>

                  <div className="flex items-start gap-2 text-sm text-gray-600 mb-4">
                    <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400" />
                    <span className="line-clamp-2">{venue.address}</span>
                  </div>

                  {/* Book Now Button */}
                  <Link
                    href={`/${venue.slug}`}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    Book Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Venues Message */}
      {venues.length === 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-20">
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Venues Available
            </h3>
            <p className="text-gray-600">
              Check back soon for available booking locations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
