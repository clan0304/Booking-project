'use client';

import { useState } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { updateVenue, deleteVenue } from '@/app/actions/venues';
import Image from 'next/image';
import type { Venue } from '@/types/database';

interface EditVenueModalProps {
  venue: Venue;
  onClose: () => void;
  onSuccess: (venue: Venue) => void;
  onDelete: (venueId: string) => void;
}

export function EditVenueModal({
  venue,
  onClose,
  onSuccess,
  onDelete,
}: EditVenueModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    venue.photo_url
  );

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    try {
      const result = await updateVenue(venue.id, formData);

      if (result.success && result.data) {
        onSuccess(result.data);
      } else {
        setError(result.error || 'Failed to update venue');
      }
    } catch (err) {
      console.error('Error updating venue:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      const result = await deleteVenue(venue.id);

      if (result.success) {
        onDelete(venue.id);
      } else {
        setError(result.error || 'Failed to delete venue');
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error('Error deleting venue:', err);
      setError('An unexpected error occurred');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const bookingUrl = `${
    typeof window !== 'undefined' ? window.location.origin : 'localhost:3000'
  }/${venue.slug}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-semibold text-gray-900">Edit Venue</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(100vh-16rem)] overflow-y-auto px-6 py-6"
        >
          <div className="space-y-5">
            {/* Venue Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Venue Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={venue.name}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[#6C5CE7] focus:outline-none focus:ring-1 focus:ring-[#6C5CE7]"
              />
            </div>

            {/* Address */}
            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="address"
                name="address"
                required
                rows={3}
                defaultValue={venue.address}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[#6C5CE7] focus:outline-none focus:ring-1 focus:ring-[#6C5CE7]"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="phoneNumber"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Phone Number <span className="text-gray-500">(Optional)</span>
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                defaultValue={venue.phone_number || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[#6C5CE7] focus:outline-none focus:ring-1 focus:ring-[#6C5CE7]"
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Venue Photo <span className="text-gray-500">(Optional)</span>
              </label>
              {photoPreview ? (
                <div className="relative">
                  <div className="relative h-48 w-full overflow-hidden rounded-lg">
                    <Image
                      src={photoPreview}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      const input = document.getElementById(
                        'photo'
                      ) as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-700"
                  >
                    Remove photo
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-colors hover:border-gray-400 hover:bg-gray-100">
                  <Upload className="h-10 w-10 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-700">
                    Click to upload photo
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    PNG, JPG, WEBP up to 5MB
                  </p>
                  <input
                    type="file"
                    id="photo"
                    name="photo"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Listing Status */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isListed"
                name="isListed"
                value="true"
                defaultChecked={venue.is_listed}
                className="h-4 w-4 rounded border-gray-300 text-[#6C5CE7] focus:ring-[#6C5CE7]"
              />
              <label htmlFor="isListed" className="text-sm text-gray-700">
                List this venue (make it publicly visible)
              </label>
            </div>

            {/* Booking URL Display */}
            <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Booking URL
              </label>
              <p className="text-sm font-mono text-gray-900 break-all">
                {bookingUrl}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                This URL is auto-generated and cannot be changed.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            {/* Delete Button */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting || isDeleting}
              className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete Venue
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="rounded-lg bg-[#6C5CE7] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5b4bc4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Venue?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete <strong>{venue.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
