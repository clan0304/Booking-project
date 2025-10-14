// components/admin/clients/client-list-client.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Search,
  UserPlus,
  Edit,
  Trash2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { deleteClient } from '@/app/actions/clients';
import { AddClientModal } from './add-client-modal';
import { EditClientModal } from './edit-client-modal';

interface Client {
  id: string;
  clerk_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string | null;
  phone_number: string | null;
  birthday: string | null;
  photo_url: string | null;
  is_registered: boolean;
  alert_note: string | null;
  created_at: string;
  note_count: number;
}

interface ClientListClientProps {
  initialClients: Client[];
}

export function ClientListClient({ initialClients }: ClientListClientProps) {
  const router = useRouter();
  const [clients] = useState(initialClients);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'registered' | 'unregistered'
  >('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Filter clients
  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone_number?.includes(searchQuery);

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'registered' && client.is_registered) ||
      (filterStatus === 'unregistered' && !client.is_registered);

    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (
    clientId: string,
    name: string,
    isRegistered: boolean
  ) => {
    if (isRegistered) {
      alert('Cannot delete registered clients. They have an active account.');
      return;
    }

    if (!confirm(`Delete ${name}? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(clientId);
    const result = await deleteClient(clientId);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete client');
    }

    setActionLoading(null);
  };

  const totalClients = clients.length;
  const registeredCount = clients.filter((c) => c.is_registered).length;
  const unregisteredCount = clients.filter((c) => !c.is_registered).length;
  const withAlertsCount = clients.filter((c) => c.alert_note).length;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your salon clients
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            <UserPlus className="h-4 w-4" />
            Add Client
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Total Clients</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalClients}
            </p>
          </div>
          <div className="rounded-xl bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-700">Registered</p>
            <p className="mt-1 text-2xl font-bold text-green-900">
              {registeredCount}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-600">Unregistered</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {unregisteredCount}
            </p>
          </div>
          <div className="rounded-xl bg-orange-50 p-4 border border-orange-200">
            <p className="text-sm font-medium text-orange-700">With Alerts</p>
            <p className="mt-1 text-2xl font-bold text-orange-900">
              {withAlertsCount}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('registered')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === 'registered'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Registered
            </button>
            <button
              onClick={() => setFilterStatus('unregistered')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === 'unregistered'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Unregistered
            </button>
          </div>
        </div>

        {/* Clients Table */}
        <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
          <table className="w-full">
            {/* Table Header */}
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left w-12">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                  Client name
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                  Mobile number
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                  Reviews
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                  Sales
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                  <div className="flex items-center gap-1">
                    Created at
                    <button className="hover:text-gray-900">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </th>
                <th className="px-6 py-4 w-24"></th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-600"
                  >
                    {searchQuery
                      ? 'No clients found matching your search'
                      : 'No clients yet'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isLoading = actionLoading === client.id;

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Checkbox */}
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          aria-label={`Select ${client.first_name}`}
                        />
                      </td>

                      {/* Client Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-gray-100 flex-shrink-0">
                            {client.photo_url ? (
                              <Image
                                src={client.photo_url}
                                alt={client.first_name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-400 to-purple-600 text-white font-semibold text-sm">
                                {client.first_name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 text-sm">
                                {client.first_name} {client.last_name}
                              </p>
                              {client.alert_note && (
                                <span
                                  title={client.alert_note}
                                  className="inline-flex"
                                >
                                  <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                                </span>
                              )}
                              {client.note_count > 0 && (
                                <span className="flex items-center gap-1 text-xs text-blue-600">
                                  <FileText className="h-3 w-3" />
                                  {client.note_count}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {client.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Mobile Number */}
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {client.phone_number || '—'}
                      </td>

                      {/* Reviews */}
                      <td className="px-6 py-4 text-sm text-gray-500">—</td>

                      {/* Sales */}
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        £0.00
                      </td>

                      {/* Created At */}
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(client.created_at).toLocaleDateString(
                          'en-US',
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditingClient(client)}
                            disabled={isLoading}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Edit client"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          {!client.is_registered && (
                            <button
                              onClick={() =>
                                handleDelete(
                                  client.id,
                                  `${client.first_name} ${
                                    client.last_name || ''
                                  }`,
                                  client.is_registered
                                )
                              }
                              disabled={isLoading}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete client"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Info Notice */}
        <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-1">
            💡 About Client Types
          </p>
          <p className="text-xs text-blue-700">
            <strong>Registered clients</strong> have signed up and can log in to
            book appointments. <strong>Unregistered clients</strong> were added
            manually and can claim their account by signing up with the same
            email.
          </p>
        </div>
      </div>

      {/* Modals */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
        />
      )}
    </>
  );
}
