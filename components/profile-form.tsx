// components/profile-form.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile, deleteProfilePhoto } from '@/app/actions/profile';
import Image from 'next/image';
import Link from 'next/link';
import type { User } from '@/types/database';
import {
  COUNTRY_CODES,
  parsePhoneNumber,
  formatPhoneNumber,
  validatePhoneNumber,
  getPhonePlaceholder,
  getPhoneMaxLength,
  toE164,
} from '@/lib/phone-utils';

interface ProfileFormProps {
  user: User;
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();

  // Parse existing phone number
  const parsedPhone = parsePhoneNumber(user.phone_number);

  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [countryCode, setCountryCode] = useState(parsedPhone.countryCode);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(
    user.photo_url
  );
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  // Get current country config
  const currentPlaceholder = getPhonePlaceholder(countryCode);
  const currentMaxLength = getPhoneMaxLength(countryCode);

  // Format the existing phone number on mount
  useEffect(() => {
    if (parsedPhone.localNumber) {
      const formatted = formatPhoneNumber(
        parsedPhone.localNumber,
        parsedPhone.countryCode
      );
      setPhoneNumber(formatted);
    }
  }, [parsedPhone.localNumber, parsedPhone.countryCode]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value, countryCode);
    setPhoneNumber(formatted);

    // Clear phone error on change
    if (fieldErrors.phoneNumber) {
      setFieldErrors((prev) => ({ ...prev, phoneNumber: '' }));
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCountryCode(e.target.value);
    // Reset phone number when country changes
    setPhoneNumber('');
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo must be less than 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      setNewPhoto(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    const result = await deleteProfilePhoto();

    if (result.success) {
      setCurrentPhotoUrl(null);
      setPhotoPreview(null);
      setNewPhoto(null);
      setSuccessMessage('Photo removed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      router.refresh();
    } else {
      setError(result.error || 'Failed to remove photo');
    }

    setIsSubmitting(false);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    // Validate phone if provided (optional in profile edit)
    const phoneError = validatePhoneNumber(phoneNumber, countryCode, false);
    if (phoneError) {
      errors.phoneNumber = phoneError;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('firstName', firstName.trim());
      formData.append('lastName', lastName.trim());

      // Format phone number in E.164 format
      if (phoneNumber.trim()) {
        formData.append('phoneNumber', toE164(phoneNumber, countryCode));
      } else {
        formData.append('phoneNumber', '');
      }

      formData.append('birthday', birthday);

      if (newPhoto) {
        formData.append('photo', newPhoto);
      }

      const result = await updateProfile(formData);

      if (result.success) {
        setSuccessMessage('Profile updated successfully!');
        setNewPhoto(null);
        setPhotoPreview(null);

        // Reload to show updated data from server
        router.refresh();

        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
          <p className="mt-2 text-sm text-gray-600">
            Update your personal information
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Photo */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Profile Photo
            </label>
            <div className="mt-2 flex items-center gap-4">
              {photoPreview || currentPhotoUrl ? (
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-gray-300">
                  <Image
                    src={photoPreview || currentPhotoUrl || ''}
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200">
                  <span className="text-3xl text-gray-400">
                    {firstName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                  {photoPreview || currentPhotoUrl
                    ? 'Change Photo'
                    : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </label>

                {(currentPhotoUrl || photoPreview) && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isSubmitting}
                    className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              PNG, JPG, WEBP up to 5MB
            </p>
          </div>

          {/* First Name */}
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700"
            >
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (fieldErrors.firstName) {
                  setFieldErrors((prev) => ({ ...prev, firstName: '' }));
                }
              }}
              className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                fieldErrors.firstName
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-black focus:ring-black'
              }`}
              required
              disabled={isSubmitting}
            />
            {fieldErrors.firstName && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.firstName}
              </p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700"
            >
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (fieldErrors.lastName) {
                  setFieldErrors((prev) => ({ ...prev, lastName: '' }));
                }
              }}
              className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                fieldErrors.lastName
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-black focus:ring-black'
              }`}
              required
              disabled={isSubmitting}
            />
            {fieldErrors.lastName && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.lastName}
              </p>
            )}
          </div>

          {/* Phone Number with Country Code */}
          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-sm font-medium text-gray-700"
            >
              Phone Number
            </label>
            <div className="mt-1 flex gap-2">
              <select
                value={countryCode}
                onChange={handleCountryChange}
                disabled={isSubmitting}
                className="rounded-md border border-gray-300 px-2 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black text-sm max-w-[180px]"
              >
                {COUNTRY_CODES.map((country, index) => (
                  <option
                    key={`${country.code}-${country.country}-${index}`}
                    value={country.code}
                  >
                    {country.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                id="phoneNumber"
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder={currentPlaceholder}
                maxLength={currentMaxLength + 4} // Account for spaces
                className={`flex-1 rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                  fieldErrors.phoneNumber
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-black focus:ring-black'
                }`}
                disabled={isSubmitting}
              />
            </div>
            {fieldErrors.phoneNumber ? (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.phoneNumber}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                {countryCode === '+61' &&
                  'Enter your mobile number without the leading 0'}
              </p>
            )}
          </div>

          {/* Birthday */}
          <div>
            <label
              htmlFor="birthday"
              className="block text-sm font-medium text-gray-700"
            >
              Birthday
            </label>
            <input
              type="date"
              id="birthday"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              disabled={isSubmitting}
            />
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href="/dashboard"
              className="flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Email Notice */}
      <div className="mt-4 rounded-md bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> To change your email address, please use the
          account settings in the top-right menu.
        </p>
      </div>
    </>
  );
}
