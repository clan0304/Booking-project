// components/public/bookings/guest-information.tsx
'use client';

import { useState } from 'react';
import { User, Mail, Phone, MessageSquare } from 'lucide-react';

interface GuestInformationProps {
  initialData: {
    guestFirstName: string;
    guestLastName: string;
    guestEmail: string;
    guestPhone: string;
    notes?: string;
  };
  onSubmit: (data: {
    guestFirstName: string;
    guestLastName: string;
    guestEmail: string;
    guestPhone: string;
    notes?: string;
  }) => void;
  onBack: () => void;
}

export function GuestInformation({
  initialData,
  onSubmit,
  onBack,
}: GuestInformationProps) {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.guestFirstName.trim()) {
      newErrors.guestFirstName = 'First name is required';
    }

    if (!formData.guestEmail.trim()) {
      newErrors.guestEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guestEmail)) {
      newErrors.guestEmail = 'Please enter a valid email';
    }

    if (!formData.guestPhone.trim()) {
      newErrors.guestPhone = 'Phone number is required';
    } else if (!/^\+?[\d\s-()]+$/.test(formData.guestPhone)) {
      newErrors.guestPhone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Your Information
        </h2>
        <p className="text-gray-600">Please provide your contact details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={formData.guestFirstName}
              onChange={(e) => handleChange('guestFirstName', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.guestFirstName
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-[#6C5CE7]'
              }`}
              placeholder="John"
            />
          </div>
          {errors.guestFirstName && (
            <p className="mt-1 text-sm text-red-600">{errors.guestFirstName}</p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={formData.guestLastName}
              onChange={(e) => handleChange('guestLastName', e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C5CE7]"
              placeholder="Doe"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="email"
              value={formData.guestEmail}
              onChange={(e) => handleChange('guestEmail', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.guestEmail
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-[#6C5CE7]'
              }`}
              placeholder="john@example.com"
            />
          </div>
          {errors.guestEmail && (
            <p className="mt-1 text-sm text-red-600">{errors.guestEmail}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="tel"
              value={formData.guestPhone}
              onChange={(e) => handleChange('guestPhone', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.guestPhone
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-[#6C5CE7]'
              }`}
              placeholder="+61 400 000 000"
            />
          </div>
          {errors.guestPhone && (
            <p className="mt-1 text-sm text-red-600">{errors.guestPhone}</p>
          )}
        </div>

        {/* Notes (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Special Requests (Optional)
          </label>
          <div className="relative">
            <div className="absolute left-3 top-3">
              <MessageSquare className="h-5 w-5 text-gray-400" />
            </div>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6C5CE7] resize-none"
              placeholder="Any special requests or notes for your appointment..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors"
          >
            Review Booking
          </button>
        </div>
      </form>
    </div>
  );
}
