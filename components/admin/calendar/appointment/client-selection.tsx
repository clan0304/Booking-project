// components/admin/calendar/appointment/client-selection.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, ArrowLeft, UserPlus, User as UserIcon } from 'lucide-react';
import { ClientForm } from './client-form';
import {
  searchClientsForBooking,
  getRecentClients,
} from '@/app/actions/calendar-appointments';
import type { ClientSelectionType, ClientInfo } from './types';
import Image from 'next/image';

interface ClientSelectionProps {
  isOpen: boolean;
  venueId: string;
  onSelect: (client: ClientSelectionType) => void;
  onClose: () => void;
}

export function ClientSelection({
  isOpen,
  venueId,
  onSelect,
  onClose,
}: ClientSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClientInfo[]>([]);
  const [recentClients, setRecentClients] = useState<ClientInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [error, setError] = useState('');

  const loadRecentClients = useCallback(async () => {
    const result = await getRecentClients(venueId, 10);
    if (result.success) {
      setRecentClients(result.data || []);
    }
  }, [venueId]);

  // Load recent clients on mount
  useEffect(() => {
    if (isOpen) {
      loadRecentClients();
    }
  }, [isOpen, loadRecentClients]);

  // Search clients as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError('');

      const result = await searchClientsForBooking(searchQuery);

      if (result.success) {
        setSearchResults(result.data || []);
      } else {
        setError(result.error || 'Failed to search clients');
      }

      setIsSearching(false);
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectClient = (client: ClientInfo) => {
    onSelect({ type: 'existing', client });
  };

  const handleSelectWalkIn = () => {
    onSelect({ type: 'walkin' });
  };

  // CHANGED: Now receives full ClientInfo object and auto-selects the client
  const handleClientCreated = (client: ClientInfo) => {
    setShowClientForm(false);
    onSelect({ type: 'existing', client });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[55] overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        />

        {/* Panel */}
        <div className="fixed inset-y-0 left-0 w-full max-w-md bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-bold text-gray-900">
                Select a client
              </h2>
            </div>
          </div>

          {/* Search */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search client or leave empty"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Content */}
          <div
            className="overflow-y-auto"
            style={{ height: 'calc(100vh - 180px)' }}
          >
            {/* Error */}
            {error && (
              <div className="px-6 py-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="px-6 py-4 space-y-3 border-b border-gray-200">
              {/* Add New Client */}
              <button
                onClick={() => setShowClientForm(true)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">
                    Add new client
                  </div>
                  <div className="text-xs text-gray-500">
                    Create a new client record
                  </div>
                </div>
              </button>

              {/* Walk-In */}
              <button
                onClick={handleSelectWalkIn}
                className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Walk-In</div>
                  <div className="text-xs text-gray-500">
                    No client information needed
                  </div>
                </div>
              </button>
            </div>

            {/* Search Results or Recent Clients */}
            <div className="px-6 py-4">
              {isSearching ? (
                <div className="text-center py-8 text-gray-500">
                  Searching...
                </div>
              ) : searchQuery ? (
                <>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Search Results ({searchResults.length})
                  </h3>
                  {searchResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No clients found
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          {client.photo_url ? (
                            <Image
                              src={client.photo_url}
                              alt={client.first_name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium">
                              {client.first_name[0]}
                              {client.last_name?.[0] || ''}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {client.first_name} {client.last_name}
                            </div>
                            <div className="text-sm text-gray-500 truncate">
                              {client.email ||
                                client.phone_number ||
                                'No contact'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Recent Clients
                  </h3>
                  {recentClients.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No recent clients
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentClients.map((client) => (
                        <button
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          {client.photo_url ? (
                            <Image
                              src={client.photo_url}
                              alt={client.first_name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium">
                              {client.first_name[0]}
                              {client.last_name?.[0] || ''}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {client.first_name} {client.last_name}
                            </div>
                            <div className="text-sm text-gray-500 truncate">
                              {client.email ||
                                client.phone_number ||
                                'No contact'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client Form Modal */}
      {showClientForm && (
        <ClientForm
          isOpen={showClientForm}
          onSave={handleClientCreated}
          onCancel={() => setShowClientForm(false)}
        />
      )}
    </>
  );
}
