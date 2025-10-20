// components/public/bookings/index.ts
export { BookingFlow } from './booking-flow';
export { ServiceSelection } from './service-selection';
export { TeamMemberSelection } from './team-member-selection';
export { DateTimeSelection } from './date-time-selection';
export { GuestInformation } from './guest-information';
export { BookingSummary } from './booking-summary';

// Re-export types for convenience
export type {
  Service,
  ServiceCategory,
  TeamMember,
  TeamMemberInfo,
  UserInfo,
  Venue,
  SelectedAppointment,
  BookingData,
} from '@/types/bookings';
