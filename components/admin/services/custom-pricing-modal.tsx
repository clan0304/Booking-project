// components/admin/services/custom-pricing-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, RotateCcw } from 'lucide-react';
import {
  updateTeamMemberCustomPricing,
  resetTeamMemberToDefault,
} from '@/app/actions/services';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

interface Service {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
}

interface CustomPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service;
  teamMember: TeamMember;
  currentCustomPrice: number | null;
  currentCustomDuration: number | null;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15min' },
  { value: 30, label: '30min' },
  { value: 45, label: '45min' },
  { value: 60, label: '1h' },
  { value: 75, label: '1h 15min' },
  { value: 90, label: '1h 30min' },
  { value: 105, label: '1h 45min' },
  { value: 120, label: '2h' },
  { value: 150, label: '2h 30min' },
  { value: 180, label: '3h' },
] as const;

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

export function CustomPricingModal({
  isOpen,
  onClose,
  service,
  teamMember,
  currentCustomPrice,
  currentCustomDuration,
  onSuccess,
}: CustomPricingModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [useCustomPrice, setUseCustomPrice] = useState(
    currentCustomPrice !== null
  );
  const [customPrice, setCustomPrice] = useState(
    currentCustomPrice?.toString() || ''
  );
  const [useCustomDuration, setUseCustomDuration] = useState(
    currentCustomDuration !== null
  );
  const [customDuration, setCustomDuration] = useState(
    currentCustomDuration || service.duration_minutes
  );

  // Reset form when modal opens or data changes
  useEffect(() => {
    if (isOpen) {
      setUseCustomPrice(currentCustomPrice !== null);
      setCustomPrice(currentCustomPrice?.toString() || '');
      setUseCustomDuration(currentCustomDuration !== null);
      setCustomDuration(currentCustomDuration || service.duration_minutes);
      setError('');
    }
  }, [
    isOpen,
    currentCustomPrice,
    currentCustomDuration,
    service.duration_minutes,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Validate custom price if enabled
    if (useCustomPrice) {
      const priceValue = parseFloat(customPrice);
      if (isNaN(priceValue) || priceValue < 0) {
        setError('Please enter a valid price');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await updateTeamMemberCustomPricing(
        service.id,
        teamMember.id,
        useCustomPrice ? parseFloat(customPrice) : null,
        useCustomDuration ? customDuration : null
      );

      router.refresh();

      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to update custom pricing:', err);
      setError(err instanceof Error ? err.message : 'Failed to update pricing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefault = async () => {
    if (
      !confirm('Reset to default pricing and duration for this team member?')
    ) {
      return;
    }

    setIsResetting(true);
    setError('');

    try {
      await resetTeamMemberToDefault(service.id, teamMember.id);

      router.refresh();

      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to reset to default:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setIsResetting(false);
    }
  };

  const hasCustomPricing =
    currentCustomPrice !== null || currentCustomDuration !== null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold">Custom Pricing</h2>
            <p className="text-sm text-gray-600 mt-1">
              {teamMember.first_name} {teamMember.last_name}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting || isResetting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Service Info */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">
                Service: {service.name}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Default Price:</span>
                  <div className="font-semibold text-gray-900 mt-1">
                    {service.price ? `£${service.price.toFixed(2)}` : 'Not set'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Default Duration:</span>
                  <div className="font-semibold text-gray-900 mt-1">
                    {formatDuration(service.duration_minutes)}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Price */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-900">
                  Custom Price
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomPrice}
                    onChange={(e) => setUseCustomPrice(e.target.checked)}
                    disabled={isSubmitting || isResetting}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-600">Enable</span>
                </label>
              </div>

              {useCustomPrice ? (
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    £
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder={service.price?.toFixed(2) || '0.00'}
                    disabled={isSubmitting || isResetting}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                </div>
              ) : (
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  Using default price
                </div>
              )}
            </div>

            {/* Custom Duration */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-900">
                  Custom Duration
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomDuration}
                    onChange={(e) => setUseCustomDuration(e.target.checked)}
                    disabled={isSubmitting || isResetting}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-600">Enable</span>
                </label>
              </div>

              {useCustomDuration ? (
                <select
                  value={customDuration}
                  onChange={(e) => setCustomDuration(parseInt(e.target.value))}
                  disabled={isSubmitting || isResetting}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  Using default duration
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            {/* Reset button (only show if has custom pricing) */}
            {hasCustomPricing && (
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isSubmitting || isResetting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {isResetting ? 'Resetting...' : 'Reset to Default'}
              </button>
            )}
            {!hasCustomPricing && <div />} {/* Spacer */}
            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isResetting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isResetting}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Pricing'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
