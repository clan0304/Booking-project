// components/admin/calendar/appointment/client-type-selector.tsx
'use client';

import { CLIENT_TYPE_CONFIG, type ClientType } from '@/lib/client-type-helpers';

interface ClientTypeSelectorProps {
  value: ClientType | null;
  onChange: (type: ClientType) => void;
  disabled?: boolean;
  showDescription?: boolean;
}

export function ClientTypeSelector({
  value,
  onChange,
  disabled = false,
  showDescription = true,
}: ClientTypeSelectorProps) {
  const types: ClientType[] = ['A', 'B', 'B+', 'C'];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Client Type
      </label>

      <div className="grid grid-cols-4 gap-2">
        {types.map((type) => {
          const config = CLIENT_TYPE_CONFIG[type];
          const isSelected = value === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => !disabled && onChange(type)}
              disabled={disabled}
              className={`
                relative py-3 px-2 rounded-xl border-2 transition-all text-center
                ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Type Label */}
              <div
                className={`font-bold text-xl ${
                  isSelected ? 'text-purple-700' : 'text-gray-700'
                }`}
              >
                {type}
              </div>

              {/* Type Name */}
              <div
                className={`text-xs font-medium mt-0.5 ${
                  isSelected ? 'text-purple-600' : 'text-gray-500'
                }`}
              >
                {config.name}
              </div>

              {/* Commission Rate */}
              <div
                className={`text-xs mt-1 font-semibold ${
                  isSelected ? 'text-purple-700' : 'text-gray-600'
                }`}
              >
                {Math.round(config.commission * 100)}%
              </div>

              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Description */}
      {showDescription && value && (
        <p className="text-xs text-gray-500 mt-2 flex items-start gap-1.5">
          <span className="text-purple-500 mt-0.5">ⓘ</span>
          <span>{CLIENT_TYPE_CONFIG[value].description}</span>
        </p>
      )}

      {/* B+ Note */}
      {showDescription && (
        <p className="text-xs text-gray-400 mt-1">
          Use <span className="font-semibold">B+</span> for new clients who
          specifically requested this stylist (referral, social media, etc.)
        </p>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function ClientTypeBadge({
  type,
  showCommission = false,
}: {
  type: ClientType | null;
  showCommission?: boolean;
}) {
  if (!type) return null;

  const config = CLIENT_TYPE_CONFIG[type];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}
    >
      <span className="font-bold">{type}</span>
      {showCommission && (
        <span className="opacity-75">
          ({Math.round(config.commission * 100)}%)
        </span>
      )}
    </span>
  );
}
