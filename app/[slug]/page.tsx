// app/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { BookingFlow } from '@/components/public/bookings/booking-flow';
import type { Service, ServiceCategory } from '@/types/bookings';
import Image from 'next/image';

interface PageProps {
  params: Promise<{
    slug: string;
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
  // Note: Using actual column names from database
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
  // Supabase returns service_categories as array, we need single object
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
  // Supabase returns users as array, we need single object
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

export default async function VenueBookingPage({ params }: PageProps) {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);

  if (!venue) {
    notFound();
  }

  const [services, teamMembers, authenticatedUser] = await Promise.all([
    getVenueServices(venue.id),
    getVenueTeamMembers(venue.id),
    getAuthenticatedUserData(),
  ]);

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
              <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{venue.address}</p>
              {venue.phone_number && (
                <p className="text-sm text-gray-600">{venue.phone_number}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BookingFlow
          venue={venue}
          services={services}
          teamMembers={teamMembers}
          authenticatedUser={authenticatedUser}
        />
      </main>
    </div>
  );
}
