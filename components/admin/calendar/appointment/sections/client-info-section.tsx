// components/admin/calendar/appointment/sections/client-info-section.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Phone, Mail, MessageSquare, User } from 'lucide-react';

interface ClientInfoSectionProps {
  clientName: string;
  clientInitials: string;
  clientPhoto: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  onViewProfile: () => void;
}

export function ClientInfoSection({
  clientName,
  clientInitials,
  clientPhoto,
  clientEmail,
  clientPhone,
  onViewProfile,
}: ClientInfoSectionProps): React.ReactElement {
  // Generate gradient colors for avatar
  const getGradientColors = (name: string): string => {
    const colors: string[] = [
      '#8B5CF6, #EC4899',
      '#3B82F6, #8B5CF6',
      '#10B981, #3B82F6',
      '#F59E0B, #EF4444',
      '#EC4899, #EF4444',
      '#6366F1, #8B5CF6',
    ];
    const index: number = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div>
      {/* Client Display - Horizontal on mobile, vertical on desktop */}
      <div className="flex lg:flex-col items-center lg:items-center gap-4 lg:gap-0 lg:text-center">
        {/* Client Avatar */}
        <div className="flex-shrink-0">
          {clientPhoto ? (
            <div className="relative w-14 h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden">
              <Image
                src={clientPhoto}
                alt={clientName}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div
              className="w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center text-white text-xl lg:text-2xl font-semibold"
              style={{
                background: `linear-gradient(135deg, ${getGradientColors(
                  clientName
                )})`,
              }}
            >
              {clientInitials}
            </div>
          )}
        </div>

        {/* Client Info */}
        <div className="flex-1 lg:flex-none lg:mt-3">
          <div className="font-semibold text-gray-900 lg:text-lg">
            {clientName}
          </div>
          {clientEmail && (
            <div className="text-xs lg:text-sm text-gray-500 truncate max-w-[180px]">
              {clientEmail}
            </div>
          )}
        </div>

        {/* Contact Actions - Mobile only shows icons */}
        <div className="flex items-center gap-1 lg:hidden">
          {clientPhone && (
            <a
              href={`tel:${clientPhone}`}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Call"
            >
              <Phone className="w-4 h-4 text-gray-600" />
            </a>
          )}
          {clientEmail && (
            <a
              href={`mailto:${clientEmail}`}
              className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Email"
            >
              <Mail className="w-4 h-4 text-gray-600" />
            </a>
          )}
          <button
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Message"
          >
            <MessageSquare className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Desktop: Contact Actions + View Profile Buttons */}
      <div className="hidden lg:flex flex-col gap-2 mt-4">
        {/* Contact Icons Row */}
        <div className="flex items-center justify-center gap-2">
          {clientPhone && (
            <a
              href={`tel:${clientPhone}`}
              className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Call"
            >
              <Phone className="w-4 h-4 text-gray-600" />
            </a>
          )}
          {clientEmail && (
            <a
              href={`mailto:${clientEmail}`}
              className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Email"
            >
              <Mail className="w-4 h-4 text-gray-600" />
            </a>
          )}
          <button
            className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Message"
          >
            <MessageSquare className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* View Profile Button (Fresha-style) */}
        <button
          onClick={onViewProfile}
          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 flex items-center justify-center gap-2"
        >
          <User className="w-4 h-4" />
          View profile
        </button>
      </div>

      {/* Mobile: View Profile Button */}
      <div className="lg:hidden mt-3">
        <button
          onClick={onViewProfile}
          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 flex items-center justify-center gap-2"
        >
          <User className="w-4 h-4" />
          View profile
        </button>
      </div>
    </div>
  );
}
