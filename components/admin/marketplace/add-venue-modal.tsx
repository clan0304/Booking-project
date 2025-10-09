'use client';

import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { createVenue } from '@/app/actions/venues';
import Image from 'next/image';
import type { Venue } from '@/types/database';

interface AddVenueModalProps {
  onClose: () => void;
  onSuccess: (venue: Venue) => void;
}

export function AddVenueModal({ onClose, onSuccess }: AddVenueModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
      const result = await createVenue(formData);

      if (result.success && result.data) {
        onSuccess(result.data);
      } else {
        setError(result.error || 'Failed to create venue');
      }
    } catch (err) {
      console.error('Error creating venue:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-semibold text-gray-900">Add New Venue</h2>
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[#6C5CE7] focus:outline-none focus:ring-1 focus:ring-[#6C5CE7]"
                placeholder="e.g., Hair By Hong Shop"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[#6C5CE7] focus:outline-none focus:ring-1 focus:ring-[#6C5CE7]"
                placeholder="e.g., 25 Station Street, Melbourne (Oakleigh), Victoria"
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
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[#6C5CE7] focus:outline-none focus:ring-1 focus:ring-[#6C5CE7]"
                placeholder="+61 3 9999 9999"
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
                defaultChecked
                className="h-4 w-4 rounded border-gray-300 text-[#6C5CE7] focus:ring-[#6C5CE7]"
              />
              <label htmlFor="isListed" className="text-sm text-gray-700">
                List this venue (make it publicly visible)
              </label>
            </div>

            {/* Info Box */}
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-100">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> A unique booking URL will be
                automatically generated based on the venue name (format:
                name-123456).
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
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#6C5CE7] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#5b4bc4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Venue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
