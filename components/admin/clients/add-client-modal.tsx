// components/admin/clients/add-client-modal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, AlertTriangle } from 'lucide-react';
import { createClient } from '@/app/actions/clients';
import Image from 'next/image';
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  formatPhoneNumber,
  getPhonePlaceholder,
  getPhoneMaxLength,
  toE164,
} from '@/lib/phone-utils';

// Client data returned on success
export interface CreatedClientData {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  photo_url: string | null;
}

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (client: CreatedClientData) => void; // Optional callback with created client data
}

export function AddClientModal({
  isOpen,
  onClose,
  onSuccess,
}: AddClientModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Phone number state
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Get current country config
  const currentPlaceholder = getPhonePlaceholder(countryCode);
  const currentMaxLength = getPhoneMaxLength(countryCode);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value, countryCode);
    setPhoneNumber(formatted);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCountryCode(e.target.value);
    setPhoneNumber(''); // Reset phone when country changes
  };

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

      setPhoto(file);
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

    // Replace phone number with E.164 format if provided
    if (phoneNumber.trim()) {
      formData.set('phoneNumber', toE164(phoneNumber, countryCode));
    } else {
      formData.delete('phoneNumber');
    }

    if (photo) {
      formData.append('photo', photo);
    }

    const result = await createClient(formData);

    if (result.success && result.data) {
      router.refresh();

      // If onSuccess callback provided, call it with the client data
      if (onSuccess) {
        onSuccess({
          id: result.data.id,
          first_name: result.data.first_name,
          last_name: result.data.last_name,
          email: result.data.email,
          phone_number: result.data.phone_number,
          photo_url: result.data.photo_url,
        });
      }

      onClose();
    } else {
      setError(result.error || 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add New Client</h2>
            <p className="mt-1 text-sm text-gray-600">
              Add a client manually (they can claim their account later)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Profile Photo <span className="text-gray-500">(Optional)</span>
              </label>
              {photoPreview ? (
                <div className="space-y-3">
                  <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-gray-200">
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
                      setPhoto(null);
                      setPhotoPreview(null);
                    }}
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                    Remove photo
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 hover:border-gray-400 transition-colors">
                  <Upload className="h-10 w-10 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload photo
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, WEBP up to 5MB
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </label>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Email <span className="text-gray-500">(Optional)</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="client@example.com"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank if client doesn&apos;t have email
              </p>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-900 mb-2"
                >
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="John"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-900 mb-2"
                >
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="Doe"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Phone Number
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={handleCountryChange}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 px-2 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black text-sm max-w-[140px]"
                >
                  {COUNTRY_CODES.map((country, index) => (
                    <option
                      key={`${country.code}-${country.country}-${index}`}
                      value={country.code}
                    >
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder={currentPlaceholder}
                  maxLength={currentMaxLength + 4}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  disabled={isSubmitting}
                />
              </div>
              {countryCode === '+61' && (
                <p className="mt-1 text-xs text-gray-500">
                  Enter mobile number without the leading 0
                </p>
              )}
            </div>

            {/* Birthday */}
            <div>
              <label
                htmlFor="birthday"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Birthday
              </label>
              <input
                type="date"
                id="birthday"
                name="birthday"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                disabled={isSubmitting}
              />
            </div>

            {/* Alert Note */}
            <div>
              <label
                htmlFor="alertNote"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Alert Note
                </span>
              </label>
              <textarea
                id="alertNote"
                name="alertNote"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Any important notes about this client (allergies, preferences, etc.)"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                This note will be shown as a warning when booking
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Client'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
