// components/admin/calendar/appointment/types.ts
/**
 * Type definitions for calendar appointment creation
 * Updated: Removed variant support (migrated to Service Groups)
 */

export interface ClientInfo {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  photo_url: string | null;
  alert_note?: string | null;
}

export interface SelectedService {
  serviceId: string;
  serviceName: string;
  duration: number; // minutes
  price: number;
  categoryColor?: string | null;
}

export interface NewClientData {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  birthday?: string;
}

export type ClientSelectionType =
  | { type: 'existing'; client: ClientInfo }
  | { type: 'walkin' }
  | { type: 'new'; data: NewClientData }
  | null;
