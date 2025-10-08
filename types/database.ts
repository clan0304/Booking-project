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
