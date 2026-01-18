// app/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { BookingFlow } from '@/components/public/bookings/booking-flow';
import {
  VenueTeamSection,
  VenueReviewsSection,
} from '@/components/public/venue';
import {
  getPublicVenueTeamMembers,
  getPublicVenueReviews,
} from '@/app/actions/public-venue';
import type { Service, ServiceCategory } from '@/types/bookings';
import type {
  PublicTeamMember,
  PublicReview,
  VenueReviewStats,
} from '@/app/actions/public-venue';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Phone, Star, Calendar } from 'lucide-react';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    book?: string;
  }>;
}

interface TeamMemberInfo {
  position: string | null;
  bio: string | null;
  specialties: string[] | null;
  is_active: boolean;
}

interface UserInfo {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  team_members: TeamMemberInfo[];
}

interface RawAssignment {
  team_member_id: string;
  users: UserInfo[] | UserInfo;
}

interface TransformedAssignment {
  team_member_id: string;
  users: UserInfo;
}

interface AuthenticatedUser {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string | null;
}

async function getVenueBySlug(slug: string) {
  const { data: venue, error } = await supabaseAdmin
    .from('venues')
    .select('*')
    .eq('slug', slug)
    .eq('is_listed', true)
    .single();

  if (error || !venue) {
    return null;
  }

  return venue;
}

async function getVenueServices(venueId: string): Promise<Service[]> {
  // First, get service IDs that are assigned to this venue
  const { data: venueServices, error: venueServicesError } = await supabaseAdmin
    .from('service_venues')
    .select('service_id')
    .eq('venue_id', venueId)
    .eq('is_active', true);

  if (venueServicesError) {
    console.error('Error fetching venue services:', venueServicesError);
    return [];
  }

  if (!venueServices || venueServices.length === 0) {
    return [];
  }

  const serviceIds = venueServices.map((vs) => vs.service_id);

  // Then fetch the full service details
  const { data: services, error } = await supabaseAdmin
    .from('services')
    .select(
      `
      id,
      name,
      description,
      type,
      price_type,
      duration_minutes,
      price,
      is_active,
      is_bookable,
      category_id,
      service_categories (
        id,
        name,
        display_order
      )
    `
    )
    .in('id', serviceIds)
    .eq('is_active', true)
    .eq('is_bookable', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching services:', error);
    return [];
  }

  if (!services) {
    return [];
  }

  // Transform the data to match our interface
  const transformedServices: Service[] = services.map(
    (service: {
      id: string;
      name: string;
      description: string | null;
      type: 'service' | 'bundle';
      price_type: 'fixed' | 'from';
      duration_minutes: number;
      price: number;
      is_active: boolean;
      is_bookable: boolean;
      category_id: string | null;
      service_categories: ServiceCategory[] | ServiceCategory | null;
    }) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      type: service.type,
      price_type: service.price_type,
      duration_minutes: service.duration_minutes,
      price: service.price,
      is_active: service.is_active,
      is_bookable: service.is_bookable,
      category_id: service.category_id,
      service_categories: Array.isArray(service.service_categories)
        ? service.service_categories[0] || null
        : service.service_categories,
    })
  );

  return transformedServices;
}

async function getVenueTeamMembers(
  venueId: string
): Promise<TransformedAssignment[]> {
  // Get team members assigned to this venue
  const { data: assignments, error } = await supabaseAdmin
    .from('team_member_venues')
    .select(
      `
      team_member_id,
      users!inner (
        id,
        first_name,
        last_name,
        photo_url,
        team_members!inner (
          position,
          bio,
          specialties,
          is_active
        )
      )
    `
    )
    .eq('venue_id', venueId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }

  // Transform the data to match our interface
  const transformedAssignments: TransformedAssignment[] = (
    (assignments as RawAssignment[]) || []
  ).map((assignment) => ({
    team_member_id: assignment.team_member_id,
    users: Array.isArray(assignment.users)
      ? assignment.users[0]
      : assignment.users,
  }));

  return transformedAssignments;
}

async function getAuthenticatedUserData(): Promise<AuthenticatedUser | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  // Fetch full user data from Supabase
  const { data: userData, error } = await supabaseAdmin
    .from('users')
    .select('id, first_name, last_name, email, phone_number')
    .eq('id', currentUser.supabaseUserId)
    .single();

  if (error || !userData) {
    console.error('Error fetching user data:', error);
    return null;
  }

  return userData as AuthenticatedUser;
}

export default async function VenueBookingPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { book } = await searchParams;
  const venue = await getVenueBySlug(slug);

  if (!venue) {
    notFound();
  }

  // Check if we're in booking mode
  const isBookingMode = book === 'true';

  // Fetch all data in parallel
  const [
    services,
    teamMembersForBooking,
    authenticatedUser,
    publicTeamResult,
    publicReviewsResult,
  ] = await Promise.all([
    getVenueServices(venue.id),
    getVenueTeamMembers(venue.id),
    getAuthenticatedUserData(),
    getPublicVenueTeamMembers(venue.id),
    getPublicVenueReviews(venue.id, { limit: 10 }),
  ]);

  const publicTeamMembers: PublicTeamMember[] = publicTeamResult.success
    ? publicTeamResult.data || []
    : [];

  const publicReviews: PublicReview[] = publicReviewsResult.success
    ? publicReviewsResult.data || []
    : [];

  const reviewStats: VenueReviewStats =
    publicReviewsResult.success && publicReviewsResult.stats
      ? publicReviewsResult.stats
      : { average_rating: 0, total_reviews: 0 };

  const totalReviews = publicReviewsResult.success
    ? publicReviewsResult.total || 0
    : 0;

  // If in booking mode, render only the booking flow
  if (isBookingMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4">
              {venue.photo_url && (
                <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    src={venue.photo_url}
                    alt={venue.name}
                    className="h-full w-full object-cover"
                    fill
                  />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {venue.name}
                </h1>
                <p className="text-sm text-gray-600 mt-1">{venue.address}</p>
                {venue.phone_number && (
                  <p className="text-sm text-gray-600">{venue.phone_number}</p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Booking Flow */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <BookingFlow
            venue={venue}
            services={services}
            teamMembers={teamMembersForBooking}
            authenticatedUser={authenticatedUser}
          />
        </main>
      </div>
    );
  }

  // Landing page mode
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Venue Photo */}
            <div className="relative h-24 w-24 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
              {venue.photo_url ? (
                <Image
                  src={venue.photo_url}
                  alt={venue.name}
                  className="object-cover"
                  fill
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                  <span className="text-3xl font-bold text-purple-300">
                    {venue.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Venue Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900">{venue.name}</h1>

              {/* Rating */}
              {reviewStats.total_reviews > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= Math.round(reviewStats.average_rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-gray-200 text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold text-gray-900">
                    {reviewStats.average_rating.toFixed(1)}
                  </span>
                  <span className="text-gray-500">
                    ({reviewStats.total_reviews.toLocaleString()} reviews)
                  </span>
                </div>
              )}

              {/* Address & Phone */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3 text-gray-600">
                {venue.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{venue.address}</span>
                  </div>
                )}
                {venue.phone_number && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{venue.phone_number}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Book Now Button */}
            <Link
              href={`/${slug}?book=true`}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
            >
              <Calendar className="w-5 h-5" />
              Book Now
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Team Section */}
        <VenueTeamSection teamMembers={publicTeamMembers} />

        {/* Reviews Section */}
        <VenueReviewsSection
          venueId={venue.id}
          initialReviews={publicReviews}
          initialTotal={totalReviews}
          stats={reviewStats}
        />

        {/* Bottom CTA - Only show if no team/reviews above */}
        {publicTeamMembers.length === 0 && reviewStats.total_reviews === 0 && (
          <div className="py-12 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Ready to book your appointment?
            </h2>
            <Link
              href={`/${slug}?book=true`}
              className="inline-flex items-center gap-2 px-8 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors"
            >
              <Calendar className="w-5 h-5" />
              Book Now
            </Link>
          </div>
        )}

        {/* Floating Book Button - Always visible on mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 sm:hidden">
          <Link
            href={`/${slug}?book=true`}
            className="flex items-center justify-center gap-2 w-full py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors"
          >
            <Calendar className="w-5 h-5" />
            Book Now
          </Link>
        </div>
      </main>

      {/* Spacer for mobile floating button */}
      <div className="h-20 sm:hidden" />
    </div>
  );
}
