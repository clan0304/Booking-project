// components/admin/calendar/appointment/sections/client-profile-view.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  Calendar,
  Receipt,
  FileText,
  Star,
  ChevronDown,
  Phone,
  Mail,
  MessageSquare,
  StickyNote,
  Pencil,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  getClientAppointmentHistory,
  getClientNotes,
  getClientAppointmentNotes,
  addClientNote,
  updateClientNote,
  deleteClientNote,
} from '@/app/actions/client-profile';

// Types
interface ClientAppointment {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  venue: {
    name: string;
  } | null;
  appointments: Array<{
    id: string;
    service_name: string;
    start_time: string;
    duration_minutes: number;
    price: number;
    team_member: {
      first_name: string;
      last_name: string | null;
    } | null;
  }>;
  payment_status: string | null;
  total_price: number | null;
  internal_notes: string | null;
  notes: string | null;
}

interface ClientNote {
  id: string;
  note: string;
  created_at: string;
  created_by_name: string | null;
}

interface AppointmentNote {
  id: string;
  booking_date: string;
  notes: string | null;
  internal_notes: string | null;
  team_member_name: string | null;
}

type ProfileTab = 'appointments' | 'sales' | 'memo' | 'reviews';
type AppointmentFilter =
  | 'all'
  | 'booked'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';
type MemoSubTab = 'client' | 'appointment';

interface ClientProfileViewProps {
  clientId: string;
  clientName: string;
  clientInitials: string;
  clientPhoto: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  onBack: () => void;
  onSelectBooking?: (bookingId: string) => void;
}

export function ClientProfileView({
  clientId,
  clientName,
  clientInitials,
  clientPhoto,
  clientEmail,
  clientPhone,
  onBack,
  onSelectBooking,
}: ClientProfileViewProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ProfileTab>('appointments');
  const [appointmentFilter, setAppointmentFilter] =
    useState<AppointmentFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [appointments, setAppointments] = useState<ClientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Memo tab state
  const [memoSubTab, setMemoSubTab] = useState<MemoSubTab>('client');
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [appointmentNotes, setAppointmentNotes] = useState<AppointmentNote[]>(
    []
  );
  const [isMemoLoading, setIsMemoLoading] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Edit/Delete note state
  const [editingNote, setEditingNote] = useState<ClientNote | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeNoteMenu, setActiveNoteMenu] = useState<string | null>(null);

  // Generate gradient colors for avatar
  const getGradientColors = (name: string): string => {
    const colors: string[] = [
      '#8B5CF6, #EC4899',
      '#3B82F6, #8B5CF6',
      '#10B981, #3B82F6',
      '#F59E0B, #EF4444',
      '#EC4899, #EF4444',
      '#6366F1, #8B5CF6',
    ];
    const index: number = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Format date for display
  const formatDisplayDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  // Format time for display
  const formatTime12Hour = (time: string): string => {
    const [hour, min] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour =
      hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum;
    return `${displayHour}:${min}${period}`;
  };

  // Get month/year group header
  const getMonthYear = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  };

  // Load appointments
  useEffect(() => {
    const loadAppointments = async () => {
      setIsLoading(true);
      try {
        const result = await getClientAppointmentHistory(clientId);
        if (result.success && result.data) {
          setAppointments(result.data);
        }
      } catch (error) {
        console.error('Error loading appointments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeTab === 'appointments' && clientId) {
      loadAppointments();
    }
  }, [clientId, activeTab]);

  // Load memo/notes
  useEffect(() => {
    const loadMemoData = async () => {
      setIsMemoLoading(true);
      try {
        const [clientNotesResult, appointmentNotesResult] = await Promise.all([
          getClientNotes(clientId),
          getClientAppointmentNotes(clientId),
        ]);

        if (clientNotesResult.success && clientNotesResult.data) {
          setClientNotes(clientNotesResult.data);
        }
        if (appointmentNotesResult.success && appointmentNotesResult.data) {
          setAppointmentNotes(appointmentNotesResult.data);
        }
      } catch (error) {
        console.error('Error loading memo data:', error);
      } finally {
        setIsMemoLoading(false);
      }
    };

    if (activeTab === 'memo' && clientId) {
      loadMemoData();
    }
  }, [clientId, activeTab]);

  // Format date for notes display
  const formatNoteDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  // Format time for notes display
  const formatNoteTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  // Get month/year for notes grouping
  const getNotesMonthYear = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  };

  // Group client notes by month
  const groupClientNotesByMonth = (
    notes: ClientNote[]
  ): Map<string, ClientNote[]> => {
    const grouped = new Map<string, ClientNote[]>();
    notes.forEach((note) => {
      const monthYear = getNotesMonthYear(note.created_at);
      if (!grouped.has(monthYear)) {
        grouped.set(monthYear, []);
      }
      grouped.get(monthYear)!.push(note);
    });
    return grouped;
  };

  // Group appointment notes by month
  const groupAppointmentNotesByMonth = (
    notes: AppointmentNote[]
  ): Map<string, AppointmentNote[]> => {
    const grouped = new Map<string, AppointmentNote[]>();
    notes.forEach((note) => {
      const monthYear = getNotesMonthYear(note.booking_date);
      if (!grouped.has(monthYear)) {
        grouped.set(monthYear, []);
      }
      grouped.get(monthYear)!.push(note);
    });
    return grouped;
  };

  // Handle add note
  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;

    setIsAddingNote(true);
    try {
      const result = await addClientNote(clientId, newNoteText.trim());
      if (result.success) {
        // Reload notes
        const clientNotesResult = await getClientNotes(clientId);
        if (clientNotesResult.success && clientNotesResult.data) {
          setClientNotes(clientNotesResult.data);
        }
        setNewNoteText('');
        setShowAddNoteModal(false);
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setIsAddingNote(false);
    }
  };

  // Handle edit note
  const handleEditNote = async () => {
    if (!editingNote || !editNoteText.trim()) return;

    setIsProcessing(true);
    try {
      const result = await updateClientNote(
        editingNote.id,
        editNoteText.trim()
      );
      if (result.success) {
        // Reload notes
        const clientNotesResult = await getClientNotes(clientId);
        if (clientNotesResult.success && clientNotesResult.data) {
          setClientNotes(clientNotesResult.data);
        }
        setEditingNote(null);
        setEditNoteText('');
      }
    } catch (error) {
      console.error('Error editing note:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle delete note
  const handleDeleteNote = async () => {
    if (!deletingNoteId) return;

    setIsProcessing(true);
    try {
      const result = await deleteClientNote(deletingNoteId);
      if (result.success) {
        // Reload notes
        const clientNotesResult = await getClientNotes(clientId);
        if (clientNotesResult.success && clientNotesResult.data) {
          setClientNotes(clientNotesResult.data);
        }
        setDeletingNoteId(null);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Open edit modal
  const openEditModal = (note: ClientNote) => {
    setEditingNote(note);
    setEditNoteText(note.note);
    setActiveNoteMenu(null);
  };

  // Open delete confirmation
  const openDeleteConfirm = (noteId: string) => {
    setDeletingNoteId(noteId);
    setActiveNoteMenu(null);
  };

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    if (appointmentFilter === 'all') return true;
    return apt.status === appointmentFilter;
  });

  // Group appointments by month
  const groupedAppointments = filteredAppointments.reduce((groups, apt) => {
    const monthYear = getMonthYear(apt.booking_date);
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(apt);
    return groups;
  }, {} as Record<string, ClientAppointment[]>);

  // Get status badge style
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-gray-100 text-gray-700',
      confirmed: 'bg-green-100 text-green-700',
      booked: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-red-100 text-red-700',
      no_show: 'bg-orange-100 text-orange-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  // Get filter label
  const getFilterLabel = (filter: AppointmentFilter): string => {
    const labels: Record<AppointmentFilter, string> = {
      all: 'All',
      booked: 'Booked',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    return labels[filter];
  };

  // Tabs configuration
  const tabs: {
    id: ProfileTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      id: 'appointments',
      label: 'Appointments',
      icon: <Calendar className="w-4 h-4" />,
      count: appointments.length,
    },
    { id: 'sales', label: 'Sales', icon: <Receipt className="w-4 h-4" /> },
    {
      id: 'memo',
      label: 'Memo',
      icon: <FileText className="w-4 h-4" />,
      count: clientNotes.length + appointmentNotes.length,
    },
    { id: 'reviews', label: 'Reviews', icon: <Star className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with back button */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Client Profile</h2>
      </div>

      {/* Client Info Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          {clientPhoto ? (
            <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={clientPhoto}
                alt={clientName}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${getGradientColors(
                  clientName
                )})`,
              }}
            >
              {clientInitials}
            </div>
          )}

          {/* Name & Contact */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg">
              {clientName}
            </h3>
            {clientEmail && (
              <p className="text-sm text-gray-500 truncate">{clientEmail}</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {clientPhone && (
              <a
                href={`tel:${clientPhone}`}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title="Call"
              >
                <Phone className="w-4 h-4 text-gray-600" />
              </a>
            )}
            {clientEmail && (
              <a
                href={`mailto:${clientEmail}`}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title="Email"
              >
                <Mail className="w-4 h-4 text-gray-600" />
              </a>
            )}
            <button
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Message"
            >
              <MessageSquare className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'appointments' && (
          <div>
            {/* Filter Bar */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {/* Quick Filter Pills */}
                <button
                  onClick={() => setAppointmentFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    appointmentFilter === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setAppointmentFilter('booked')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    appointmentFilter === 'booked'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Booked
                </button>
                <button
                  onClick={() => setAppointmentFilter('confirmed')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    appointmentFilter === 'confirmed'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Confirmed
                </button>

                {/* More dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 transition-colors ${
                      ['completed', 'cancelled', 'no_show'].includes(
                        appointmentFilter
                      )
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {['completed', 'cancelled', 'no_show'].includes(
                      appointmentFilter
                    )
                      ? getFilterLabel(appointmentFilter)
                      : 'More'}
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showFilterDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowFilterDropdown(false)}
                      />
                      <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                        {(
                          [
                            'completed',
                            'cancelled',
                            'no_show',
                          ] as AppointmentFilter[]
                        ).map((filter) => (
                          <button
                            key={filter}
                            onClick={() => {
                              setAppointmentFilter(filter);
                              setShowFilterDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                              appointmentFilter === filter
                                ? 'text-purple-600 font-medium'
                                : 'text-gray-700'
                            }`}
                          >
                            {getFilterLabel(filter)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Appointments List */}
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mb-2"></div>
                <p className="text-gray-500 text-sm">Loading appointments...</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No appointments found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(groupedAppointments).map(
                  ([monthYear, monthAppointments]) => (
                    <div key={monthYear}>
                      {/* Month Header */}
                      <div className="px-4 py-2 bg-gray-50">
                        <h4 className="text-sm font-semibold text-gray-700">
                          {monthYear}
                        </h4>
                      </div>

                      {/* Appointments in this month */}
                      {monthAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => onSelectBooking?.(apt.id)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Calendar Icon */}
                            <div className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                              <Calendar className="w-4 h-4 text-gray-400" />
                            </div>

                            {/* Appointment Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900">
                                  Appointment
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(
                                    apt.status
                                  )}`}
                                >
                                  {apt.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mb-2">
                                {formatDisplayDate(apt.booking_date)}{' '}
                                {formatTime12Hour(apt.start_time)}
                                {apt.venue && ` · ${apt.venue.name}`}
                              </p>

                              {/* Services */}
                              {apt.appointments.map((service) => (
                                <div
                                  key={service.id}
                                  className="flex items-center justify-between py-1"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {service.service_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatTime12Hour(service.start_time)} ·{' '}
                                      {service.duration_minutes}min
                                      {service.team_member &&
                                        ` · ${service.team_member.first_name}`}
                                    </p>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    A$ {service.price.toFixed(2)}
                                  </span>
                                </div>
                              ))}

                              {/* Notes Section */}
                              {(apt.notes || apt.internal_notes) && (
                                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                  {/* Client Booking Notes */}
                                  {apt.notes && (
                                    <div className="relative group/notes">
                                      <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                                        <MessageSquare className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-blue-700 mb-0.5">
                                            Client note
                                          </p>
                                          <p className="text-xs text-blue-600 line-clamp-2">
                                            {apt.notes}
                                          </p>
                                        </div>
                                      </div>
                                      {/* Hover popup for full content */}
                                      <div className="absolute left-0 right-0 bottom-full mb-2 z-50 opacity-0 invisible group-hover/notes:opacity-100 group-hover/notes:visible transition-all duration-200 pointer-events-none">
                                        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-h-48 overflow-y-auto">
                                          <div className="flex items-center gap-2 mb-2">
                                            <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                                              Client Note
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                            {apt.notes}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Internal Notes */}
                                  {apt.internal_notes && (
                                    <div className="relative group/internal">
                                      <div className="flex items-start gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                        <StickyNote className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-gray-600 mb-0.5">
                                            Internal note
                                          </p>
                                          <p className="text-xs text-gray-600 line-clamp-2">
                                            {apt.internal_notes}
                                          </p>
                                        </div>
                                      </div>
                                      {/* Hover popup for full content */}
                                      <div className="absolute left-0 right-0 bottom-full mb-2 z-50 opacity-0 invisible group-hover/internal:opacity-100 group-hover/internal:visible transition-all duration-200 pointer-events-none">
                                        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-h-48 overflow-y-auto">
                                          <div className="flex items-center gap-2 mb-2">
                                            <StickyNote className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                              Internal Note
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                            {apt.internal_notes}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Action Buttons */}
                              {apt.status === 'completed' && (
                                <div className="flex items-center gap-2 mt-3">
                                  <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    View sale
                                  </button>
                                  <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    Rebook
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="p-8 text-center">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Sales history coming soon</p>
          </div>
        )}

        {activeTab === 'memo' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Header with Add button */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Notes</h3>
              <button
                onClick={() => setShowAddNoteModal(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
              >
                Add
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 px-4 py-3 border-b border-gray-100">
              <button
                onClick={() => setMemoSubTab('client')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  memoSubTab === 'client'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Client notes
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    memoSubTab === 'client'
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {clientNotes.length}
                </span>
              </button>
              <button
                onClick={() => setMemoSubTab('appointment')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  memoSubTab === 'appointment'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Internal notes
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    memoSubTab === 'appointment'
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {appointmentNotes.length}
                </span>
              </button>
            </div>

            {/* Notes content */}
            <div className="flex-1 overflow-y-auto">
              {isMemoLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                </div>
              ) : memoSubTab === 'client' ? (
                // Client Notes (staff-only notes about the client)
                clientNotes.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No client notes yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add notes about this client that only staff can see
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {Array.from(groupClientNotesByMonth(clientNotes)).map(
                      ([monthYear, monthNotes]) => (
                        <div key={monthYear}>
                          {/* Month Header */}
                          <div className="px-4 py-2 bg-gray-50">
                            <h4 className="text-sm font-semibold text-gray-700">
                              {monthYear}
                            </h4>
                          </div>

                          {/* Notes in this month */}
                          {monthNotes.map((note) => (
                            <div key={note.id} className="p-4">
                              <div className="flex items-start gap-3">
                                {/* Timeline dot */}
                                <div className="w-2 h-2 mt-2 rounded-full bg-gray-400 flex-shrink-0"></div>

                                {/* Note content */}
                                <div className="flex-1 bg-gray-50 rounded-xl p-4 relative group">
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm text-gray-500 mb-2">
                                      {formatNoteDate(note.created_at)}{' '}
                                      {formatNoteTime(note.created_at)}
                                      {note.created_by_name &&
                                        ` · ${note.created_by_name}`}
                                    </p>

                                    {/* More menu button */}
                                    <div className="relative">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveNoteMenu(
                                            activeNoteMenu === note.id
                                              ? null
                                              : note.id
                                          );
                                        }}
                                        className="p-1 rounded-lg hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <MoreVertical className="w-4 h-4 text-gray-500" />
                                      </button>

                                      {/* Dropdown menu */}
                                      {activeNoteMenu === note.id && (
                                        <>
                                          <div
                                            className="fixed inset-0 z-40"
                                            onClick={() =>
                                              setActiveNoteMenu(null)
                                            }
                                          />
                                          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                                            <button
                                              onClick={() =>
                                                openEditModal(note)
                                              }
                                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                            >
                                              <Pencil className="w-4 h-4" />
                                              Edit
                                            </button>
                                            <button
                                              onClick={() =>
                                                openDeleteConfirm(note.id)
                                              }
                                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                              Delete
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-gray-900 whitespace-pre-wrap">
                                    {note.note}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )
              ) : // Internal Notes (from appointments)
              appointmentNotes.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No internal notes yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Internal notes from appointments will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Array.from(
                    groupAppointmentNotesByMonth(appointmentNotes)
                  ).map(([monthYear, monthNotes]) => (
                    <div key={monthYear}>
                      {/* Month Header */}
                      <div className="px-4 py-2 bg-gray-50">
                        <h4 className="text-sm font-semibold text-gray-700">
                          {monthYear}
                        </h4>
                      </div>

                      {/* Notes in this month */}
                      {monthNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() => onSelectBooking?.(note.id)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Timeline dot */}
                            <div className="w-2 h-2 mt-2 rounded-full bg-gray-400 flex-shrink-0"></div>

                            {/* Note content */}
                            <div className="flex-1 bg-gray-50 rounded-xl p-4">
                              <p className="text-sm text-gray-500 mb-2">
                                {formatNoteDate(
                                  note.booking_date + 'T00:00:00'
                                )}
                                {note.team_member_name &&
                                  ` · ${note.team_member_name}`}
                              </p>
                              <p className="text-gray-900 whitespace-pre-wrap">
                                {note.internal_notes}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Note Modal */}
            {showAddNoteModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Add Client Note
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    This note is only visible to staff members.
                  </p>
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Enter note about this client..."
                    className="w-full h-32 p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => {
                        setShowAddNoteModal(false);
                        setNewNoteText('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                      disabled={isAddingNote}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      disabled={!newNoteText.trim() || isAddingNote}
                      className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAddingNote ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Note Modal */}
            {editingNote && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Edit Note
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Update the client note.
                  </p>
                  <textarea
                    value={editNoteText}
                    onChange={(e) => setEditNoteText(e.target.value)}
                    placeholder="Enter note about this client..."
                    className="w-full h-32 p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => {
                        setEditingNote(null);
                        setEditNoteText('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                      disabled={isProcessing}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditNote}
                      disabled={!editNoteText.trim() || isProcessing}
                      className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingNoteId && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Delete Note
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Are you sure you want to delete this note? This action
                    cannot be undone.
                  </p>
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => setDeletingNoteId(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                      disabled={isProcessing}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteNote}
                      disabled={isProcessing}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-full hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="p-8 text-center">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Reviews coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
