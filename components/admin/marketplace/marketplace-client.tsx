'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, ArrowUpDown } from 'lucide-react';
import { PageHeader } from '@/components/admin';
import { VenueCard } from './venue-card';
import { AddVenueModal } from './add-venue-modal';
import { EditVenueModal } from './edit-venue-modal';
import type { Venue } from '@/types/database';

interface MarketplaceClientProps {
  initialVenues: Venue[];
}

type FilterType = 'all' | 'listed' | 'unlisted';
type SortType = 'newest' | 'oldest' | 'name';

export function MarketplaceClient({ initialVenues }: MarketplaceClientProps) {
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);

  // Filter and sort venues
  const filteredVenues = useMemo(() => {
    let result = [...venues];

    // Apply filter
    if (filter === 'listed') {
      result = result.filter((v) => v.is_listed);
    } else if (filter === 'unlisted') {
      result = result.filter((v) => !v.is_listed);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(query) ||
          v.address.toLowerCase().includes(query)
      );
    }

    // Apply sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else if (sortBy === 'oldest') {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      } else {
        return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [venues, filter, searchQuery, sortBy]);

  const listedCount = venues.filter((v) => v.is_listed).length;
  const unlistedCount = venues.filter((v) => !v.is_listed).length;

  const handleVenueCreated = (newVenue: Venue) => {
    setVenues((prev) => [newVenue, ...prev]);
    setShowAddModal(false);
  };

  const handleVenueUpdated = (updatedVenue: Venue) => {
    setVenues((prev) =>
      prev.map((v) => (v.id === updatedVenue.id ? updatedVenue : v))
    );
    setEditingVenue(null);
  };

  const handleVenueDeleted = (venueId: string) => {
    setVenues((prev) => prev.filter((v) => v.id !== venueId));
    setEditingVenue(null);
  };

  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Manage your venues and locations"
        action={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[#6C5CE7] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5b4bc4]"
          >
            <Plus className="h-4 w-4" />
            Add Venue
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Status Tabs */}
        <div className="flex rounded-full bg-black p-1">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All <span className="ml-1.5 text-xs">({venues.length})</span>
          </button>
          <button
            onClick={() => setFilter('listed')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              filter === 'listed'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Listed <span className="ml-1.5 text-xs">({listedCount})</span>
          </button>
          <button
            onClick={() => setFilter('unlisted')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              filter === 'unlisted'
                ? 'bg-white text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Unlisted <span className="ml-1.5 text-xs">({unlistedCount})</span>
          </button>
        </div>
      </div>

      {/* Search and Sort */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 w-full rounded-full border border-gray-200 bg-white pl-12 pr-4 text-sm focus:border-[#6C5CE7] focus:outline-none focus:ring-1 focus:ring-[#6C5CE7]"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const sorts: SortType[] = ['newest', 'oldest', 'name'];
              const currentIndex = sorts.indexOf(sortBy);
              setSortBy(sorts[(currentIndex + 1) % sorts.length]);
            }}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300"
          >
            <ArrowUpDown className="h-4 w-4" />
            Sort by:{' '}
            {sortBy === 'newest'
              ? 'Newest'
              : sortBy === 'oldest'
              ? 'Oldest'
              : 'Name'}
          </button>
        </div>
      </div>

      {/* Venues Grid */}
      {filteredVenues.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center border border-gray-100">
          <p className="text-gray-500">
            {searchQuery
              ? 'No venues found matching your search.'
              : 'No venues yet. Add your first venue to get started!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              onEdit={() => setEditingVenue(venue)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddVenueModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleVenueCreated}
        />
      )}

      {editingVenue && (
        <EditVenueModal
          venue={editingVenue}
          onClose={() => setEditingVenue(null)}
          onSuccess={handleVenueUpdated}
          onDelete={handleVenueDeleted}
        />
      )}
    </>
  );
}
