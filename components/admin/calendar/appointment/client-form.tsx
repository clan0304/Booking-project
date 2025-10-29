// components/admin/calendar/appointment/client-form.tsx
'use client';

import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { createClient } from '@/app/actions/clients';
import type { ClientInfo } from './types';
import Image from 'next/image';

interface ClientFormProps {
  isOpen: boolean;
  onSave: (client: ClientInfo) => void; // CHANGED: Pass full ClientInfo instead of just clientId
  onCancel: () => void;
}

export function ClientForm({ isOpen, onSave, onCancel }: ClientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('File must be an image');
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

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const formData = new FormData(e.currentTarget);

      // Add photo if selected
      if (photo) {
        formData.set('photo', photo);
      }

      const result = await createClient(formData);

      if (result.success && result.data) {
        // CHANGED: Pass full client object instead of just ID
        onSave({
          id: result.data.id,
          first_name: result.data.first_name,
          last_name: result.data.last_name,
          email: result.data.email,
          phone_number: result.data.phone_number,
          photo_url: result.data.photo_url,
        });
      } else {
        setError(result.error || 'Failed to create client');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Add New Client
                </h2>
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Photo Upload */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  {photoPreview ? (
                    <div className="relative">
                      <Image
                        src={photoPreview}
                        alt="Client photo preview"
                        width={96}
                        height={96}
                        className="w-24 h-24 rounded-full object-cover border-4 border-purple-100"
                      />
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                      <Upload className="h-8 w-8 text-gray-400" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">Optional - Max 5MB</p>
              </div>

              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  First name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g. John"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Last name
                </label>
                <input
                  type="text"
                  name="lastName"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g. Hancock"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="example@domain.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional - for sending confirmations
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Phone
                </label>
                <div className="flex gap-2">
                  <select
                    name="countryCode"
                    defaultValue="+61"
                    disabled={isSubmitting}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="+61">+61</option>
                    <option value="+1">+1</option>
                    <option value="+44">+44</option>
                  </select>
                  <input
                    type="tel"
                    name="phoneNumber"
                    disabled={isSubmitting}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="412 345 678"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Optional - recommended if no email
                </p>
              </div>

              {/* Birthday */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Birthday
                </label>
                <input
                  type="date"
                  name="birthday"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional - for birthday specials
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Save Client'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
