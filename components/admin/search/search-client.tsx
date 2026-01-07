// components/admin/search/search-client.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Calendar, User, MapPin } from 'lucide-react';
import Image from 'next/image';
import {
  globalSearch,
  type SearchClient,
  type SearchAppointment,
} from '@/app/actions/search';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Format time helper
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes}${ampm}`;
}

// Format date helper
function formatDate(dateStr: string): { day: string; weekday: string } {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate().toString().padStart(2, '0');
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  return { day, weekday };
}

// Get status badge styles
function getStatusBadge(status: string): {
  bg: string;
  text: string;
  label: string;
} {
  switch (status) {
    case 'confirmed':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' };
    case 'pending':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' };
    case 'cancelled':
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' };
    case 'completed':
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Completed' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  }
}

interface SearchClientProps {
  initialClients: SearchClient[];
  initialAppointments: SearchAppointment[];
}

export function SearchClient({
  initialClients,
  initialAppointments,
}: SearchClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    clients: SearchClient[];
    appointments: SearchAppointment[];
  }>({
    clients: [],
    appointments: [],
  });

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Perform search when query changes
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults({ clients: [], appointments: [] });
      return;
    }

    setIsSearching(true);
    try {
      const result = await globalSearch(query);
      if (result.success && result.data) {
        setSearchResults(result.data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const hasSearchResults = searchQuery.trim().length >= 2;
  const displayClients = hasSearchResults
    ? searchResults.clients
    : initialClients;
  const displayAppointments = hasSearchResults
    ? searchResults.appointments
    : initialAppointments;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Search Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-light text-gray-900 mb-4">
            What are you looking for?
          </h1>
          <p className="text-gray-500 mb-8">
            Search by client name, mobile, email or booking reference
          </p>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Start typing to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-14 pr-6 text-lg border-2 border-gray-200 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2">
                <div className="h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Appointments */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {hasSearchResults ? 'Appointments' : 'Upcoming appointments'}
            </h2>

            {displayAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {hasSearchResults
                    ? 'No appointments found'
                    : 'No upcoming appointments'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayAppointments.map((appointment) => {
                  const { day, weekday } = formatDate(
                    appointment.booking.booking_date
                  );
                  const statusBadge = getStatusBadge(appointment.status);

                  return (
                    <button
                      key={appointment.id}
                      onClick={() =>
                        router.push(
                          `/admin/calendar?date=${appointment.booking.booking_date}`
                        )
                      }
                      className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all text-left"
                    >
                      <div className="flex items-start gap-4">
                        {/* Date Badge */}
                        <div className="flex-shrink-0 w-14 text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {day}
                          </div>
                          <div className="text-xs text-gray-500 uppercase">
                            {weekday}
                          </div>
                        </div>

                        {/* Appointment Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                              {formatTime(appointment.start_time)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                            >
                              {statusBadge.label}
                            </span>
                          </div>

                          <p className="text-sm text-gray-900 font-medium truncate">
                            {appointment.booking.guest_first_name}{' '}
                            {appointment.booking.guest_last_name}
                          </p>

                          <p className="text-sm text-gray-500 truncate">
                            {appointment.service_name}
                          </p>

                          {appointment.team_member && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                              <User className="h-3 w-3" />
                              <span>
                                {appointment.team_member.first_name}{' '}
                                {appointment.team_member.last_name}
                              </span>
                            </div>
                          )}

                          {appointment.booking.venue && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                              <MapPin className="h-3 w-3" />
                              <span>{appointment.booking.venue.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clients */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {hasSearchResults ? 'Clients' : 'Clients (recently added)'}
            </h2>

            {displayClients.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <User className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {hasSearchResults ? 'No clients found' : 'No recent clients'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() =>
                      router.push(
                        `/admin/clients?search=${encodeURIComponent(
                          client.email || client.first_name
                        )}`
                      )
                    }
                    className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {client.photo_url ? (
                          <div className="relative h-12 w-12 rounded-full overflow-hidden">
                            <Image
                              src={client.photo_url}
                              alt={client.first_name}
                              fill
                              className="object-cover"
                              unoptimized={
                                !client.photo_url.includes('supabase')
                              }
                              onError={(e) => {
                                // Hide broken image, show fallback
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            {/* Fallback shown when image fails */}
                            <div className="absolute inset-0 h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center -z-10">
                              <span className="text-lg font-medium text-white">
                                {client.first_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                            <span className="text-lg font-medium text-white">
                              {client.first_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Client Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {client.first_name} {client.last_name}
                          </p>
                          {client.is_registered && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                              Registered
                            </span>
                          )}
                        </div>
                        {client.email && (
                          <p className="text-sm text-gray-500 truncate">
                            {client.email}
                          </p>
                        )}
                        {client.phone_number && (
                          <p className="text-sm text-gray-400 truncate">
                            {client.phone_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
