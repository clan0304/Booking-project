// types/bookings.ts

export interface ServiceCategory {
  id: string;
  name: string;
  display_order: number;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  type: 'service' | 'variant_group' | 'bundle';
  price_type: 'fixed' | 'from';
  duration_minutes: number;
  price: number;
  is_active: boolean;
  is_bookable: boolean;
  category_id: string | null;
  parent_service_id: string | null;
  service_categories: ServiceCategory | null;
}

export interface TeamMemberInfo {
  position: string | null;
  bio: string | null;
  specialties: string[] | null;
  is_active: boolean;
}

export interface UserInfo {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  team_members: TeamMemberInfo[];
}

export interface TeamMember {
  team_member_id: string;
  users: UserInfo;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  phone_number: string | null;
  photo_url: string | null;
  slug: string;
}

export interface SelectedAppointment {
  serviceId: string;
  serviceName: string;
  variantId?: string | null;
  teamMemberId: string;
  teamMemberName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  price: number;
  notes?: string;
}

export interface BookingData {
  venueId: string;
  appointments: SelectedAppointment[];
  bookingDate: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  notes?: string;
}
