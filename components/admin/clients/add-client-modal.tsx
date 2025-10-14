// components/admin/clients/add-client-modal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, AlertTriangle } from 'lucide-react';
import { createClient } from '@/app/actions/clients';
import Image from 'next/image';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddClientModal({ isOpen, onClose }: AddClientModalProps) {
  const router = useRouter();
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

    if (photo) {
      formData.append('photo', photo);
    }

    const result = await createClient(formData);

    if (result.success) {
      router.refresh();
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
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="client@example.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                Client can later sign up with this email to claim their account
              </p>
            </div>

            {/* First Name */}
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
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Jane"
              />
            </div>

            {/* Last Name */}
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
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Doe"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Mobile Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="+61 400 000 000"
              />
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
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {/* Alert Note */}
            <div>
              <label
                htmlFor="alertNote"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Alert Note
                </span>
              </label>
              <textarea
                id="alertNote"
                name="alertNote"
                rows={3}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Important notes (allergies, preferences, warnings...)"
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be highlighted in the client list for quick visibility
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-black px-4 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add Client'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
