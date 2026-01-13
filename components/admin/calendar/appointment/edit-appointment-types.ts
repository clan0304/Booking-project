// components/admin/calendar/appointment/edit-appointment-types.ts

import type { ReactNode } from 'react';
import type { BookingGroupWithAppointments } from '@/types/calendar';

// =====================================================
// MODAL STEP TYPES
// =====================================================

export type ModalStep = 'view' | 'edit' | 'edit-single' | 'payment';

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

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
  onSelectBooking?: (bookingId: string) => void;
}

// =====================================================
// VIEW MODE PROPS
// =====================================================
//
// NOTES LAYOUT:
// ┌──────────────────┬──────────────────────────────────┐
// │ LEFT SIDEBAR     │ RIGHT SIDE                       │
// │ (Client Info)    │ (Booking Details)                │
// │                  │                                  │
// │ • Client photo   │ • Services list                  │
// │ • Name, contact  │ • Products list                  │
// │ • Client type    │ • Notes section:                 │
// │ • ⚠️ Alert note  │   - Client note (if online)     │
// │   (EDITABLE)     │   - Internal notes (EDITABLE)   │
// └──────────────────┴──────────────────────────────────┘
//
// Notes are editable directly in VIEW mode:
// - Client Alert: Saves to users.alert_note
// - Internal Notes: Saves to booking_groups.internal_notes

export interface ViewModeProps {
  booking: BookingGroupWithAppointments;
  editingAppointments: Map<string, EditingAppointment>;
  availableTeamMembers: TeamMember[];
  availableServices: Map<string, Service[]>;
  bookingStatus: BookingStatus;
  showStatusDropdown: boolean;
  showMoreMenu: boolean;

  // Notes - see layout diagram above
  bookingNotes: string; // Client's note from online booking (RIGHT SIDE, read-only)
  internalNotes: string; // Staff notes for this booking (RIGHT SIDE, EDITABLE)
  clientAlertNote: string | null; // Warning about the client (LEFT SIDEBAR, EDITABLE)

  allowEdit: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;

  // Handlers
  onStatusChange: (status: BookingStatus) => void;
  onToggleStatusDropdown: () => void;
  onToggleMoreMenu: () => void;
  onCheckout: () => Promise<void>;
  onViewSale: () => void;
  onSave: () => Promise<void>;
  onToggleEdit: () => void;
  onShowServicePicker: () => void;
  onEditAppointment: (appointmentId: string) => void;
  onDeleteBooking: () => void;
  onDeleteAppointment: (appointmentId: string) => Promise<void>;
  onRebook: () => void;
  onClose: () => void;

  // Notes change handlers (optional - component saves directly to DB)
  onInternalNotesChange?: (notes: string) => void;
  onClientAlertChange?: (alert: string | null) => void;

  // Navigation handler for client profile view
  onSelectBooking?: (bookingId: string) => void;

  // Helper functions
  formatDate: (dateStr: string) => string;
  formatTime: (time: string) => string;
  getPriceDisplay: (price: number) => string;
  getClientName: () => string;
  getClientInitials: () => string;
  getTotalPrice: () => number;
  getStatusLabel: (status: BookingStatus) => string;

  // Products section (optional - rendered from parent)
  productsSection?: ReactNode;
}

// =====================================================
// EDIT MODE PROPS
// =====================================================
// Edit mode is focused on SERVICE changes (time, duration, team member, price)
// Notes editing is handled in VIEW mode directly

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

  // Notes - displayed read-only for reference
  bookingNotes: string; // Client's note from online booking (read-only)
  internalNotes: string; // Staff notes (read-only in edit mode)
  clientAlertNote: string | null; // Client alert (read-only in edit mode)

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
  onDeleteBooking: () => void;
  onShowServicePicker: (appointmentId: string | 'add-new') => void;
  onBack: () => void;
  onClose: () => void;

  // State setters
  setShowTeamMemberDropdown: (id: string | null) => void;
  setShowTimeDropdown: (id: string | null) => void;
  setShowDurationDropdown: (id: string | null) => void;
  setInternalNotes: (notes: string) => void; // Still needed for parent state sync

  // Helpers
  getTeamMember: (teamMemberId: string) => TeamMember | undefined;
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
  onSuccess: () => void;
}

// =====================================================
// SINGLE EDIT MODE PROPS
// =====================================================

export interface SingleEditModeProps {
  appointment: EditingAppointment;
  appointmentId: string;
  teamMember: TeamMember | undefined;
  availableTeamMembers: TeamMember[];
  availableServices: Map<string, Service[]>;
  teamMembersLoading: boolean;
  showTeamMemberDropdown: string | null;
  showTimeDropdown: string | null;
  showDurationDropdown: string | null;
  isSaving: boolean;
  canDelete: boolean;

  // Handlers
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
  onShowServicePicker: (appointmentId: string) => void;
  onSave: () => void;
  onBack: () => void;
  onClose: () => void;

  // State setters
  setShowTeamMemberDropdown: (id: string | null) => void;
  setShowTimeDropdown: (id: string | null) => void;
  setShowDurationDropdown: (id: string | null) => void;

  // Helpers
  formatTime: (time: string) => string;
  getDurationDisplay: (minutes: number) => string;
  generateTimeSlots: () => string[];
  generateDurationOptions: () => number[];
}
