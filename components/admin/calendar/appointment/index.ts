// components/admin/calendar/appointment/index.ts
export { CreateAppointmentModal } from './create-appointment-modal';
export { EditAppointmentModal } from './edit-appointment-modal';
export { ClientSelection } from './client-selection';
export { ServiceSelection } from './service-selection';
export { ClientForm } from './client-form';
export { ProductPicker, ProductQuantityEditor } from './product-picker';

// Re-export types
export type {
  ClientInfo,
  SelectedService,
  NewClientData,
  ClientSelectionType,
} from './types';

export type { SelectedProduct } from './product-picker';
