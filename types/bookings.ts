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
  type: 'service' | 'bundle';
  price_type: 'fixed' | 'from';
  duration_minutes: number;
  price: number;
  is_active: boolean;
  is_bookable: boolean;
  category_id: string | null;

  service_categories: ServiceCategory | null;
}
export interface ServiceGroup {
  id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  display_mode: 'modal' | 'list';
  display_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceGroupItem {
  id: string;
  service_group_id: string;
  service_id: string;
  display_order: number;
  created_at: string;
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
  teamMemberPhotoUrl?: string | null; // Added for Fresha-style UI
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
  // Payment method ID (saved card for cancellation protection)
  paymentMethodId?: string;
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

export interface CancellationPolicy {
  id: string;
  venue_id: string;
  notice_hours: number;
  fee_percentage: number;
  fee_fixed_amount: number | null;
  is_active: boolean;
}
