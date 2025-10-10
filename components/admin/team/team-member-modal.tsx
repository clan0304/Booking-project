// components/admin/team/team-member-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addTeamMember, updateTeamMember } from '@/app/actions/team-members';
import Image from 'next/image';
import { X, Upload } from 'lucide-react';

// Type for team member data passed to modal
interface TeamMemberData {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  photo_url: string | null;
  position: string | null;
  bio: string | null;
}

interface TeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  teamMember?: TeamMemberData;
}

export function TeamMemberModal({
  isOpen,
  onClose,
  mode,
  teamMember,
}: TeamMemberModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    teamMember?.photo_url || null
  );

  // Reset form when modal opens/closes or teamMember changes
  useEffect(() => {
    if (!isOpen) {
      setPhoto(null);
      setPhotoPreview(teamMember?.photo_url || null);
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, teamMember]);

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

    let result;
    if (mode === 'edit' && teamMember) {
      result = await updateTeamMember(teamMember.id, formData);
    } else {
      result = await addTeamMember(formData);
    }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'add' ? 'Add Team Member' : 'Edit Team Member'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {mode === 'add'
                ? 'Add a new member to your salon team'
                : 'Update team member information'}
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

        {/* Form - Scrollable Content + Fixed Footer */}
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
              <p className="mt-2 text-xs text-gray-500">
                ✅ This photo will be visible on the public booking page
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
                defaultValue={teamMember?.first_name || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="John"
              />
              <p className="mt-1 text-xs text-gray-500">
                ✅ This will be shown on public booking page
              </p>
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
                defaultValue={teamMember?.last_name || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Doe"
              />
              <p className="mt-1 text-xs text-gray-500">
                🔒 Private - admin only
              </p>
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
                required={mode === 'add'}
                disabled={isSubmitting || mode === 'edit'}
                defaultValue={teamMember?.email || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="john@example.com"
              />
              {mode === 'edit' && (
                <p className="mt-1 text-xs text-orange-600">
                  ⚠️ Email cannot be changed after creation
                </p>
              )}
              {mode === 'add' && (
                <p className="mt-1 text-xs text-gray-500">
                  🔒 Private - admin only
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                disabled={isSubmitting}
                defaultValue={teamMember?.phone_number || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="+1 (555) 000-0000"
              />
              <p className="mt-1 text-xs text-gray-500">
                🔒 Private - admin only
              </p>
            </div>

            {/* Position */}
            <div>
              <label
                htmlFor="position"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Position
              </label>
              <input
                type="text"
                id="position"
                name="position"
                disabled={isSubmitting}
                defaultValue={teamMember?.position || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Hair Stylist"
              />
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                disabled={isSubmitting}
                defaultValue={teamMember?.bio || ''}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                placeholder="Brief bio about the team member..."
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Privacy Notice */}
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-1">
                Privacy Protection
              </p>
              <p className="text-xs text-blue-700">
                Only <strong>first name</strong> and <strong>photo</strong> will
                be visible on the public booking page. All other information
                (last name, email, phone) remains private and is only accessible
                to admins.
              </p>
            </div>
          </div>

          {/* Footer - Fixed at bottom, inside form */}
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
                {isSubmitting
                  ? mode === 'add'
                    ? 'Adding...'
                    : 'Saving...'
                  : mode === 'add'
                  ? 'Add Team Member'
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
