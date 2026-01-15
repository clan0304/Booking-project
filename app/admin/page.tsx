// app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { supabaseAdmin } from '@/lib/supabase/server';
import { MapPin, Calendar } from 'lucide-react';
import { PublicLayout } from '@/components/public';

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
  const venues = await getListedVenues();

  return (
    <PublicLayout>
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
              Hair Salon Booking System
            </h1>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Professional salon management made simple. Book your appointment
              at any of our locations.
            </p>

            <div className="mt-8">
              <Link
                href="#locations"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Calendar className="w-5 h-5" />
                Book an Appointment
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Venues Section */}
      <div
        id="locations"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Our Locations</h2>
          <p className="mt-2 text-gray-600">
            Choose a location to book your appointment
          </p>
        </div>

        {venues.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
              >
                {/* Venue Image */}
                <div className="relative h-48 bg-gray-100">
                  {venue.photo_url ? (
                    <Image
                      src={venue.photo_url}
                      alt={venue.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                      <span className="text-5xl font-bold text-purple-300">
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
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Venues Available
            </h3>
            <p className="text-gray-600">
              Check back soon for available booking locations.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>© {new Date().getFullYear()} Hair Salon. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </PublicLayout>
  );
}
