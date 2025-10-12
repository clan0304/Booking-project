'use client';

import { useState } from 'react';
import { Check, ChevronDown, Building2 } from 'lucide-react';
import type { Venue } from '@/types/database';

interface VenueSelectorProps {
  venues: Venue[];
  selectedVenueId: string | null;
  onVenueChange: (venueId: string) => void;
}

export function VenueSelector({
  venues,
  selectedVenueId,
  onVenueChange,
}: VenueSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);

  if (venues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-500">
        <Building2 className="h-4 w-4" />
        <span>No venues available</span>
      </div>
    );
  }

  // If only one venue, show it without dropdown
  if (venues.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2">
        <Building2 className="h-5 w-5 text-gray-600" />
        <span className="font-medium text-gray-900">{venues[0].name}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 hover:bg-gray-50 transition-colors"
      >
        <Building2 className="h-5 w-5 text-gray-600" />
        <span className="font-medium text-gray-900">
          {selectedVenue?.name || 'Select Venue'}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-2">
              <div className="mb-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Select Venue
              </div>
              <div className="space-y-1">
                {venues.map((venue) => (
                  <button
                    key={venue.id}
                    onClick={() => {
                      onVenueChange(venue.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                      venue.id === selectedVenueId
                        ? 'bg-purple-50 text-purple-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{venue.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {venue.address}
                      </div>
                    </div>
                    {venue.id === selectedVenueId && (
                      <Check className="h-4 w-4 text-purple-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
