'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { MapPin, Phone, MoreVertical, Star } from 'lucide-react';
import type { Venue } from '@/types/database';

interface VenueCardProps {
  venue: Venue;
  onEdit: () => void;
}

export function VenueCard({ venue, onEdit }: VenueCardProps) {
  const [imageError, setImageError] = useState(false);
  const [bookingUrl, setBookingUrl] = useState(`/${venue.slug}`);

  useEffect(() => {
    // Set full URL only on client side after hydration
    setBookingUrl(`${window.location.origin}/${venue.slug}`);
  }, [venue.slug]);

  return (
    <div className="group overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 transition-all hover:shadow-md">
      <div className="flex gap-4 p-4">
        {/* Venue Photo */}
        <div className="relative h-32 w-40 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {venue.photo_url && !imageError ? (
            <Image
              src={venue.photo_url}
              alt={venue.name}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <MapPin className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>

        {/* Venue Info */}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                  {venue.name}
                </h3>
                <div className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">5.0</span>
                  <span className="text-gray-400">(0)</span>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  venue.is_listed
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {venue.is_listed ? 'Listed' : 'Unlisted'}
              </span>
            </div>

            <div className="mt-2 space-y-1.5">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{venue.address}</span>
              </div>

              {venue.phone_number && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{venue.phone_number}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={onEdit}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              Manage
            </button>

            <button
              onClick={onEdit}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              Profile
            </button>

            <button
              onClick={onEdit}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Booking URL (shown on hover) */}
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="text-xs text-gray-500">
          Booking URL:{' '}
          <span className="font-mono text-gray-700">{bookingUrl}</span>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Updated{' '}
          {new Date(venue.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>
    </div>
  );
}
