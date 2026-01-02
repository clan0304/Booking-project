// app/onboarding/onboarding-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/app/actions/onboarding';
import Image from 'next/image';

// Country codes with phone format info
const COUNTRY_CODES = [
  {
    code: '+61',
    country: 'AU',
    label: '🇦🇺 +61',
    placeholder: '412 345 678',
    maxLength: 9,
  },
  {
    code: '+1',
    country: 'US',
    label: '🇺🇸 +1',
    placeholder: '555 123 4567',
    maxLength: 10,
  },
  {
    code: '+44',
    country: 'UK',
    label: '🇬🇧 +44',
    placeholder: '7911 123456',
    maxLength: 10,
  },
  {
    code: '+64',
    country: 'NZ',
    label: '🇳🇿 +64',
    placeholder: '21 123 4567',
    maxLength: 9,
  },
  {
    code: '+65',
    country: 'SG',
    label: '🇸🇬 +65',
    placeholder: '9123 4567',
    maxLength: 8,
  },
] as const;

interface MissingFields {
  firstName: boolean;
  lastName: boolean;
  phoneNumber: boolean;
}

interface UserData {
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  photoUrl: string | null;
}

interface OnboardingFormProps {
  missingFields: MissingFields;
  userData: UserData;
}

export function OnboardingForm({
  missingFields,
  userData,
}: OnboardingFormProps) {
  const router = useRouter();

  // Form state
  const [firstName, setFirstName] = useState(userData.firstName || '');
  const [lastName, setLastName] = useState(userData.lastName || '');
  const [countryCode, setCountryCode] = useState('+61'); // Default to Australia
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    userData.photoUrl
  );

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Get current country config
  const currentCountry =
    COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  // Format phone number as user types (add spaces for readability)
  const formatPhoneNumber = (value: string, countryCode: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Remove leading 0 if present (common in AU numbers)
    const cleanDigits = digits.startsWith('0') ? digits.slice(1) : digits;

    // Format based on country
    if (countryCode === '+61') {
      // Australian format: XXX XXX XXX
      if (cleanDigits.length <= 3) return cleanDigits;
      if (cleanDigits.length <= 6)
        return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3)}`;
      return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(
        3,
        6
      )} ${cleanDigits.slice(6, 9)}`;
    } else if (countryCode === '+1') {
      // US format: XXX XXX XXXX
      if (cleanDigits.length <= 3) return cleanDigits;
      if (cleanDigits.length <= 6)
        return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3)}`;
      return `${cleanDigits.slice(0, 3)} ${cleanDigits.slice(
        3,
        6
      )} ${cleanDigits.slice(6, 10)}`;
    } else if (countryCode === '+44') {
      // UK format: XXXX XXXXXX
      if (cleanDigits.length <= 4) return cleanDigits;
      return `${cleanDigits.slice(0, 4)} ${cleanDigits.slice(4, 10)}`;
    } else if (countryCode === '+64') {
      // NZ format: XX XXX XXXX
      if (cleanDigits.length <= 2) return cleanDigits;
      if (cleanDigits.length <= 5)
        return `${cleanDigits.slice(0, 2)} ${cleanDigits.slice(2)}`;
      return `${cleanDigits.slice(0, 2)} ${cleanDigits.slice(
        2,
        5
      )} ${cleanDigits.slice(5, 9)}`;
    } else if (countryCode === '+65') {
      // Singapore format: XXXX XXXX
      if (cleanDigits.length <= 4) return cleanDigits;
      return `${cleanDigits.slice(0, 4)} ${cleanDigits.slice(4, 8)}`;
    }

    return cleanDigits;
  };

  // Validate phone number
  const validatePhoneNumber = (
    phone: string,
    countryCode: string
  ): string | null => {
    const digits = phone.replace(/\D/g, '');
    const cleanDigits = digits.startsWith('0') ? digits.slice(1) : digits;
    const country = COUNTRY_CODES.find((c) => c.code === countryCode);

    if (!country) return 'Invalid country code';
    if (cleanDigits.length === 0) return 'Phone number is required';
    if (cleanDigits.length < country.maxLength) {
      return `Phone number must be ${country.maxLength} digits`;
    }

    // Additional validation for Australian mobile numbers
    if (countryCode === '+61' && !cleanDigits.startsWith('4')) {
      return 'Australian mobile numbers must start with 4';
    }

    return null;
  };

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

      setPhoto(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    // Only clear preview if it's a new photo, keep existing if from userData
    if (!userData.photoUrl) {
      setPhotoPreview(null);
    } else {
      setPhotoPreview(userData.photoUrl);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate first name (if missing)
    if (missingFields.firstName && !firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    // Validate last name (if missing)
    if (missingFields.lastName && !lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    // Validate phone number (if missing)
    if (missingFields.phoneNumber) {
      const phoneError = validatePhoneNumber(phoneNumber, countryCode);
      if (phoneError) {
        errors.phoneNumber = phoneError;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();

      // Add fields that were missing
      if (missingFields.firstName) {
        formData.append('firstName', firstName.trim());
      }
      if (missingFields.lastName) {
        formData.append('lastName', lastName.trim());
      }
      if (missingFields.phoneNumber) {
        // Store phone in E.164 format: +61412345678
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const normalizedPhone = cleanPhone.startsWith('0')
          ? cleanPhone.slice(1)
          : cleanPhone;
        formData.append('phoneNumber', `${countryCode}${normalizedPhone}`);
      }

      // Always allow photo upload
      if (photo) {
        formData.append('photo', photo);
      }

      const result = await completeOnboarding(formData);

      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Onboarding error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* First Name - Show only if missing */}
      {missingFields.firstName && (
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
            placeholder="John"
            className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
              fieldErrors.firstName
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-black focus:ring-black'
            }`}
            disabled={isSubmitting}
          />
          {fieldErrors.firstName && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.firstName}</p>
          )}
        </div>
      )}

      {/* Last Name - Show only if missing */}
      {missingFields.lastName && (
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
            placeholder="Smith"
            className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
              fieldErrors.lastName
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-black focus:ring-black'
            }`}
            disabled={isSubmitting}
          />
          {fieldErrors.lastName && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.lastName}</p>
          )}
        </div>
      )}

      {/* Phone Number - Show only if missing */}
      {missingFields.phoneNumber && (
        <div>
          <label
            htmlFor="phoneNumber"
            className="block text-sm font-medium text-gray-700"
          >
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex gap-2">
            <select
              value={countryCode}
              onChange={handleCountryChange}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            >
              {COUNTRY_CODES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder={currentCountry.placeholder}
              maxLength={currentCountry.maxLength + 2} // Account for spaces
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
      )}

      {/* Photo Upload - Always show */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Profile Photo <span className="text-gray-500">(Optional)</span>
        </label>
        <div className="mt-2">
          {photoPreview ? (
            <div className="space-y-3">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-gray-300">
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
                className="text-sm text-gray-600 hover:text-gray-900"
                disabled={isSubmitting}
              >
                {photo ? 'Remove new photo' : 'Change photo'}
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 hover:border-gray-400 transition-colors">
              <svg
                className="h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                Click to upload photo
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 5MB</p>
              <input
                type="file"
                id="photo"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                disabled={isSubmitting}
              />
            </label>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-black px-4 py-2.5 text-white font-medium hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Completing...' : 'Complete Profile'}
      </button>

      {/* Info text */}
      <p className="text-center text-xs text-gray-500">
        Your information is secure and will only be used for booking
        confirmations.
      </p>
    </form>
  );
}
