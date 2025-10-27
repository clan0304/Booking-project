// types/calendar.ts
// Type definitions for admin calendar components

/**
 * Venue information from calendar bookings
 */
export interface CalendarVenue {
  id: string;
  name: string;
  address: string;
}

/**
 * Team member information for calendar display
 */
export interface CalendarTeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

export interface CalendarServiceCategory {
  id: string;
  name: string;
  color: string;
}

export interface CalendarService {
  id: string;
  name: string;
  category_id: string | null;
  service_categories:
    | CalendarServiceCategory
    | CalendarServiceCategory[]
    | null;
}

/**
 * Appointment details from calendar bookings
 */
export interface CalendarAppointment {
  id: string;
  service_id: string;
  service_name: string;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  duration_minutes: number;
  price: number;
  status: string;
  notes: string | null;
  team_member_id: string;
  team_member?: CalendarTeamMember | null;
  services?: CalendarService | null;
  category_color?: string | null; // Computed from service category
}
/**
 * Complete booking group with all nested data
 * Note: Supabase can return venues as either array or single object
 */
export interface CalendarBooking {
  id: string;
  venue_id: string;
  guest_first_name: string;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  booking_date: string; // YYYY-MM-DD format
  total_appointments: number;
  total_price: number;
  status: string;
  notes: string | null;
  internal_notes: string | null;
  booking_source: string;
  created_at: string;
  client_id: string | null;
  venues: CalendarVenue[] | CalendarVenue | null;
  appointments: CalendarAppointment[];
}
/**
 * Appointment with parent booking reference
 * Used for displaying appointment cards
 */
export interface AppointmentWithBooking extends CalendarAppointment {
  booking: CalendarBooking;
}

/**
 * Appointments grouped by team member (for day view)
 */
export interface AppointmentsByMember {
  member: CalendarTeamMember;
  appointments: AppointmentWithBooking[];
}
/**
 * Appointments grouped by team member and date (for week view)
 */
export interface AppointmentsByMemberAndDate {
  member: CalendarTeamMember;
  appointmentsByDate: Map<string, AppointmentWithBooking[]>;
}

/**
 * Week day information for calendar grid
 */
export interface WeekDay {
  date: string; // YYYY-MM-DD format
  dayOfWeek: number; // 0-6, where 0=Sunday
  dayName: string; // Short name (Mon, Tue, etc.)
}

/**
 * Calendar view type
 */
export type CalendarViewType = 'day' | 'week';

/**
 * Venue filter option
 */
export interface VenueOption {
  id: string;
  name: string;
}

/**
 * Team member filter option
 */
export interface TeamMemberOption {
  id: string;
  first_name: string;
  last_name: string;
}

/**
 * Calendar filters state
 */
export interface CalendarFilters {
  viewType: CalendarViewType;
  selectedVenue: string; // 'all' or venue ID
  selectedTeamMember: string; // 'all' or team member ID
  currentDate: string; // YYYY-MM-DD format (for day view)
  currentWeekStart: string; // YYYY-MM-DD format (for week view)
}

/**
 * Appointment position and size for calendar grid
 */
export interface AppointmentStyle {
  top: number; // pixels from top
  height: number; // height in pixels
}

/**
 * Blocked time period (when staff is unavailable during shift)
 */
export interface BlockedTime {
  id: string;
  team_member_id: string;
  venue_id: string;
  blocked_date: string; // YYYY-MM-DD format
  start_time: string; // HH:MM:SS format
  end_time: string; // HH:MM:SS format
  reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Blocked times grouped by date for calendar display
 */
export interface BlockedTimesByDate {
  [date: string]: BlockedTime[];
}

/**
 * Blocked times grouped by team member and date
 */
export interface BlockedTimesByMemberAndDate {
  [teamMemberId: string]: {
    [date: string]: BlockedTime[];
  };
}
