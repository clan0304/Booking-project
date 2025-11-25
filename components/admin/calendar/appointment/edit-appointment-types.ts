// components/admin/calendar/appointment/edit-appointment-types.ts

import type { BookingGroupWithAppointments } from '@/types/calendar';

// =====================================================
// MODAL STEP TYPES
// =====================================================

export type ModalStep = 'view' | 'edit' | 'payment';

export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'
  | 'no_show';

// =====================================================
// SERVICE & TEAM MEMBER TYPES
// =====================================================

export interface Service {
  id: string;
  name: string;
  base_duration: number;
  base_price: number | null;
  service_categories: {
    name: string;
    color: string;
  } | null;
}

export interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

export interface TeamMemberAssignment {
  id: string;
  is_active: boolean;
  users:
    | {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        photo_url: string | null;
      }
    | {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        photo_url: string | null;
      }[];
}

export interface EditingAppointment {
  id: string;
  serviceId: string;
  serviceName: string;
  teamMemberId: string;
  startTime: string;
  duration: number;
  price: number;
  categoryColor?: string;
}

// =====================================================
// MAIN MODAL PROPS
// =====================================================

export interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingGroupWithAppointments;
  onSuccess: () => void;
  initialStep?: ModalStep;
  allowEdit?: boolean;
}

// =====================================================
// VIEW MODE PROPS
// =====================================================

export interface ViewModeProps {
  booking: BookingGroupWithAppointments;
  editingAppointments: Map<string, EditingAppointment>;
  availableTeamMembers: TeamMember[];
  bookingStatus: BookingStatus;
  showStatusDropdown: boolean;
  showMoreMenu: boolean;
  bookingNotes: string;
  allowEdit: boolean;

  // Handlers
  onStatusChange: (status: BookingStatus) => void;
  onToggleStatusDropdown: () => void;
  onToggleMoreMenu: () => void;
  onCheckout: () => void;
  onToggleEdit: () => void;
  onDeleteBooking: () => void;
  onDeleteAppointment: (appointmentId: string) => Promise<void>;
  onClose: () => void;

  // Helper functions
  formatDate: (dateStr: string) => string;
  formatTime: (time: string) => string;
  getPriceDisplay: (price: number) => string;
  getClientName: () => string;
  getClientInitials: () => string;
  getTotalPrice: () => number;
  getStatusLabel: (status: BookingStatus) => string;
}

// =====================================================
// EDIT MODE PROPS
// =====================================================

export interface EditModeProps {
  booking: BookingGroupWithAppointments;
  editingAppointments: Map<string, EditingAppointment>;
  expandedAppointmentId: string | null;
  availableTeamMembers: TeamMember[];
  teamMembersLoading: boolean;
  availableServices: Map<string, Service[]>;
  servicesLoading: Set<string>;
  showTeamMemberDropdown: string | null;
  showTimeDropdown: string | null;
  showDurationDropdown: string | null;
  bookingNotes: string;
  internalNotes: string;
  isSubmitting: boolean;
  isDeleting: boolean;

  // Handlers
  onToggleAppointment: (id: string) => void;
  onUpdateAppointmentField: <K extends keyof EditingAppointment>(
    id: string,
    field: K,
    value: EditingAppointment[K]
  ) => void;
  onTeamMemberChange: (
    appointmentId: string,
    teamMemberId: string
  ) => Promise<void>;
  onDeleteAppointment: (id: string) => Promise<void>;
  onSaveAll: () => Promise<void>;
  onDeleteBooking: () => Promise<void>;
  onShowServicePicker: (appointmentId: string | 'add-new') => void;
  onBack: () => void;
  onClose: () => void;

  // State setters
  setShowTeamMemberDropdown: (id: string | null) => void;
  setShowTimeDropdown: (id: string | null) => void;
  setShowDurationDropdown: (id: string | null) => void;
  setBookingNotes: (notes: string) => void;
  setInternalNotes: (notes: string) => void;

  // Helpers
  getTeamMember: (id: string) => TeamMember | undefined;
  getService: (teamMemberId: string, serviceId: string) => Service | undefined;
  formatTime: (time: string) => string;
  getDurationDisplay: (minutes: number) => string;
  generateTimeSlots: () => string[];
  generateDurationOptions: () => number[];
}

// =====================================================
// PAYMENT MODE PROPS
// =====================================================

export interface PaymentModeProps {
  booking: BookingGroupWithAppointments;
  editingAppointments: Map<string, EditingAppointment>;
  totalPrice: number;

  // Handlers
  onBack: () => void;
  onClose: () => void;

  // Helpers
  getPriceDisplay: (price: number) => string;
}
