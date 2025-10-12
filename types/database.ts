// types/database.ts

export type UserRole = 'client' | 'team_member' | 'admin';

// Your database tables (matches the actual database structure)
export interface User {
  id: string;
  clerk_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string | null;
  phone_number: string | null;
  birthday: string | null;
  photo_url: string | null;
  roles: UserRole[];
  is_registered: boolean;
  onboarding_completed: boolean;
  alert_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientNote {
  id: string;
  client_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface TeamMember {
  id: string;
  user_id: string;
  position: string | null;
  bio: string | null;
  specialties: string[] | null;
  is_active: boolean;
  hire_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  phone_number: string | null;
  photo_url: string | null;
  slug: string;
  is_listed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VenueOperatingHours {
  id: string;
  venue_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string | null; // HH:MM format
  end_time: string | null; // HH:MM format
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberVenue {
  id: string;
  team_member_id: string;
  venue_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  team_member_id: string;
  venue_id: string;
  shift_date: string; // YYYY-MM-DD format
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface VenueClosedDay {
  id: string;
  venue_id: string;
  closed_date: string; // YYYY-MM-DD format
  reason: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null; // e.g., "WEEKLY:0" for Sunday
  created_at: string;
  created_by: string | null;
}
