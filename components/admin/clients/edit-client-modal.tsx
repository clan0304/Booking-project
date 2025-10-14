// components/admin/clients/edit-client-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, AlertTriangle } from 'lucide-react';
import { updateClient, deleteClientPhoto } from '@/app/actions/clients';
import Image from 'next/image';

interface Client {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  phone_number: string | null;
  birthday: string | null;
  photo_url: string | null;
  alert_note: string | null;
  is_registered: boolean;
}

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
}

export function EditClientModal({ client, onClose }: EditClientModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    client.photo_url
  );
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);

  // Reset state when client changes
  useEffect(() => {
    setPhotoPreview(client.photo_url);
    setPhoto(null);
    setError('');
  }, [client]);

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

  const handleRemovePhoto = async () => {
    if (!client.photo_url) {
      setPhotoPreview(null);
      setPhoto(null);
      return;
    }

    if (!confirm('Remove profile photo?')) return;

    setIsRemovingPhoto(true);
    const result = await deleteClientPhoto(client.id);

    if (result.success) {
      setPhotoPreview(null);
      setPhoto(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to remove photo');
    }

    setIsRemovingPhoto(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    if (photo) {
      formData.append('photo', photo);
    }

    const result = await updateClient(client.id, formData);

    if (result.success) {
      router.refresh();
      onClose();
    } else {
      setError(result.error || 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Client</h2>
            <p className="mt-1 text-sm text-gray-600">
              Update client information
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
                Profile Photo
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
                    onClick={handleRemovePhoto}
                    disabled={isRemovingPhoto || isSubmitting}
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    {isRemovingPhoto ? 'Removing...' : 'Remove photo'}
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

            {/* Email (Read-only) */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={client.email}
                disabled
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-500 bg-gray-50"
              />
              <p className="mt-1 text-xs text-orange-600">
                ⚠️ Email cannot be changed
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
                defaultValue={client.first_name}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                defaultValue={client.last_name || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                defaultValue={client.phone_number || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                defaultValue={client.birthday || ''}
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
                defaultValue={client.alert_note || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Important notes (allergies, preferences, warnings...)"
              />
            </div>

            {/* Registration Status Info */}
            {client.is_registered && (
              <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                <p className="text-sm font-medium text-green-900 mb-1">
                  ✅ Registered Client
                </p>
                <p className="text-xs text-green-700">
                  This client has a registered account and can log in to book
                  appointments.
                </p>
              </div>
            )}

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
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
