// components/admin/services/add-service-modal.tsx
// Updated to support returning created service data for nested usage

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Check } from 'lucide-react';
import {
  createService,
  getAllVenues,
  getAllTeamMembers,
} from '@/app/actions/services';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Venue {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
}

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess?: (serviceData?: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
  }) => void; // ✅ Updated to return service data
  zIndex?: number; // ✅ Added for nested modal support
}

const DURATION_OPTIONS = [
  // Until 1 hour: every 5 minutes (for quick services)
  { value: 5, label: '5min' },
  { value: 10, label: '10min' },
  { value: 15, label: '15min' },
  { value: 20, label: '20min' },
  { value: 25, label: '25min' },
  { value: 30, label: '30min' },
  { value: 35, label: '35min' },
  { value: 40, label: '40min' },
  { value: 45, label: '45min' },
  { value: 50, label: '50min' },
  { value: 55, label: '55min' },
  { value: 60, label: '1h' },
  // Until 2 hours: every 10 minutes (for standard services)
  { value: 70, label: '1h 10min' },
  { value: 80, label: '1h 20min' },
  { value: 90, label: '1h 30min' },
  { value: 100, label: '1h 40min' },
  { value: 110, label: '1h 50min' },
  { value: 120, label: '2h' },
  // Until 4 hours: every 15 minutes (for longer treatments)
  { value: 135, label: '2h 15min' },
  { value: 150, label: '2h 30min' },
  { value: 165, label: '2h 45min' },
  { value: 180, label: '3h' },
  { value: 195, label: '3h 15min' },
  { value: 210, label: '3h 30min' },
  { value: 225, label: '3h 45min' },
  { value: 240, label: '4h' },
  // Until 6 hours: every 30 minutes (for very long services)
  { value: 270, label: '4h 30min' },
  { value: 300, label: '5h' },
  { value: 330, label: '5h 30min' },
  { value: 360, label: '6h' },
  // Until 12 hours: every hour (for full-day services)
  { value: 420, label: '7h' },
  { value: 480, label: '8h' },
  { value: 540, label: '9h' },
  { value: 600, label: '10h' },
  { value: 660, label: '11h' },
  { value: 720, label: '12h' },
] as const;
const SERVICE_TYPES = [
  {
    value: 'service' as const,
    label: 'Regular Service',
    description: 'Standalone bookable service',
  },
  {
    value: 'bundle' as const,
    label: 'Service Bundle',
    description: 'Package of multiple services',
  },
] as const;

type ServiceType = (typeof SERVICE_TYPES)[number]['value'];

export function AddServiceModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
  zIndex = 50, // ✅ Default z-50, can be overridden for nesting
}: AddServiceModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [serviceType, setServiceType] = useState<ServiceType>('service');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'from'>('fixed');
  const [price, setPrice] = useState('0.00');
  const [duration, setDuration] = useState(30);

  // Step 2 data
  const [venues, setVenues] = useState<Venue[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState(false);
  const [allTeam, setAllTeam] = useState(false);
  const [loadingStep2, setLoadingStep2] = useState(false);

  // Load venues and team members when moving to step 2
  useEffect(() => {
    if (currentStep === 2 && venues.length === 0) {
      loadStep2Data();
    }
  }, [currentStep, venues.length]);

  const loadStep2Data = async () => {
    setLoadingStep2(true);
    try {
      const [venuesData, teamMembersData] = await Promise.all([
        getAllVenues(),
        getAllTeamMembers(),
      ]);
      setVenues(venuesData);
      setTeamMembers(teamMembersData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load locations and team members');
    } finally {
      setLoadingStep2(false);
    }
  };

  const handleNext = () => {
    setError('');

    if (currentStep === 1) {
      // Validate Step 1
      if (!name.trim()) {
        setError('Service name is required');
        return;
      }

      if (!price || parseFloat(price) <= 0) {
        setError('Price must be greater than 0');
        return;
      }

      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(1);
  };

  const handleLocationToggleAll = () => {
    if (allLocations) {
      setSelectedVenues([]);
      setAllLocations(false);
    } else {
      setSelectedVenues(venues.map((v) => v.id));
      setAllLocations(true);
    }
  };

  const handleLocationToggle = (venueId: string) => {
    if (selectedVenues.includes(venueId)) {
      const newSelected = selectedVenues.filter((id) => id !== venueId);
      setSelectedVenues(newSelected);
      setAllLocations(newSelected.length === venues.length);
    } else {
      const newSelected = [...selectedVenues, venueId];
      setSelectedVenues(newSelected);
      setAllLocations(newSelected.length === venues.length);
    }
  };

  const handleTeamToggleAll = () => {
    if (allTeam) {
      setSelectedTeamMembers([]);
      setAllTeam(false);
    } else {
      setSelectedTeamMembers(teamMembers.map((t) => t.id));
      setAllTeam(true);
    }
  };

  const handleTeamMemberToggle = (memberId: string) => {
    if (selectedTeamMembers.includes(memberId)) {
      const newSelected = selectedTeamMembers.filter((id) => id !== memberId);
      setSelectedTeamMembers(newSelected);
      setAllTeam(newSelected.length === teamMembers.length);
    } else {
      const newSelected = [...selectedTeamMembers, memberId];
      setSelectedTeamMembers(newSelected);
      setAllTeam(newSelected.length === teamMembers.length);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim()) {
      setError('Service name is required');
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      setError('Price must be greater than 0');
      return;
    }

    if (selectedVenues.length === 0) {
      setError('Please select at least one location');
      return;
    }

    if (selectedTeamMembers.length === 0) {
      setError('Please select at least one team member');
      return;
    }

    setIsSubmitting(true);

    try {
      const newService = await createService({
        name: name.trim(),
        category_id: categoryId || undefined,
        description: description.trim() || undefined,
        type: serviceType,
        price_type: priceType,
        price: parseFloat(price),
        duration_minutes: duration,
        venue_ids: selectedVenues,
        team_member_ids: selectedTeamMembers,
      });

      // Reset form
      setName('');
      setCategoryId('');
      setDescription('');
      setServiceType('service');
      setPriceType('fixed');
      setPrice('0.00');
      setDuration(30);
      setSelectedVenues([]);
      setSelectedTeamMembers([]);
      setAllLocations(false);
      setAllTeam(false);
      setCurrentStep(1);

      router.refresh();

      // ✅ Call onSuccess with service data
      if (onSuccess) {
        onSuccess({
          id: newService.id,
          name: newService.name,
          price: newService.price,
          duration_minutes: newService.duration_minutes,
        });
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to create service:', err);
      setError(err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError('');
      setCurrentStep(1);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex }} // ✅ Dynamic z-index
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Add Service</h2>
            <p className="text-sm text-gray-600 mt-1">
              Step {currentStep} of 2
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Body */}
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Service type
                  </label>
                  <div className="space-y-2">
                    {SERVICE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setServiceType(type.value)}
                        disabled={isSubmitting}
                        className={`w-full flex items-start gap-3 p-4 border-2 rounded-lg transition-all ${
                          serviceType === type.value
                            ? 'border-purple-600 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            serviceType === type.value
                              ? 'bg-purple-600'
                              : 'border-2 border-gray-300'
                          }`}
                        >
                          {serviceType === type.value && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">
                            {type.label}
                          </p>
                          <p className="text-sm text-gray-500">
                            {type.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Service name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Women's Haircut"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Category (optional)
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  >
                    <option value="">No category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this service..."
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Price type
                    </label>
                    <select
                      value={priceType}
                      onChange={(e) =>
                        setPriceType(e.target.value as 'fixed' | 'from')
                      }
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    >
                      <option value="fixed">Fixed price</option>
                      <option value="from">From (minimum)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Price (AUD) *
                    </label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      step="0.01"
                      min="0"
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Duration *
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Step 2: Locations & Team */}
            {currentStep === 2 && (
              <>
                {loadingStep2 ? (
                  <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 mt-4">Loading...</p>
                  </div>
                ) : (
                  <>
                    {/* Locations */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-900">
                          Available at locations *
                        </label>
                        <button
                          type="button"
                          onClick={handleLocationToggleAll}
                          className="text-sm text-purple-600 hover:text-purple-700"
                        >
                          {allLocations ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                        {venues.map((venue) => (
                          <label
                            key={venue.id}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedVenues.includes(venue.id)}
                              onChange={() => handleLocationToggle(venue.id)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-900">
                              {venue.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Team Members */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-900">
                          Provided by team members *
                        </label>
                        <button
                          type="button"
                          onClick={handleTeamToggleAll}
                          className="text-sm text-purple-600 hover:text-purple-700"
                        >
                          {allTeam ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
                        {teamMembers.map((member) => (
                          <label
                            key={member.id}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTeamMembers.includes(member.id)}
                              onChange={() => handleTeamMemberToggle(member.id)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-900">
                              {member.first_name} {member.last_name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div>
              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  Back
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Service'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
