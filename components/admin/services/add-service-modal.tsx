// components/admin/services/add-service-modal.tsx
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
  onSuccess?: () => void; // ✅ Added
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

const SERVICE_TYPES = [
  {
    value: 'service' as const,
    label: 'Regular Service',
    description: 'Standalone bookable service',
  },
  {
    value: 'variant_group' as const,
    label: 'Service with Variants',
    description: 'Group with options (e.g., hair lengths)',
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
  onSuccess, // ✅ Added
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

  // Venues and team members
  const [venues, setVenues] = useState<Venue[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState(false);
  const [allTeam, setAllTeam] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [venuesData, teamData] = await Promise.all([
        getAllVenues(),
        getAllTeamMembers(),
      ]);
      setVenues(venuesData);
      setTeamMembers(teamData);
    } catch (err) {
      console.error('Failed to load venues and team members:', err);
      setError('Failed to load data');
    }
  };

  const handleAllLocationsToggle = () => {
    if (allLocations) {
      setSelectedVenues([]);
      setAllLocations(false);
    } else {
      setSelectedVenues(venues.map((v) => v.id));
      setAllLocations(true);
    }
  };

  const handleVenueToggle = (venueId: string) => {
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

  const handleAllTeamToggle = () => {
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

    if (serviceType !== 'variant_group' && (!price || parseFloat(price) <= 0)) {
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
      await createService({
        name: name.trim(),
        category_id: categoryId || undefined,
        description: description.trim() || undefined,
        type: serviceType,
        price_type: priceType,
        price: serviceType === 'variant_group' ? undefined : parseFloat(price),
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

      // ✅ Call onSuccess instead of onClose
      if (onSuccess) {
        onSuccess();
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add Service</h2>
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
                              : 'bg-white border-2 border-gray-300'
                          }`}
                        >
                          {serviceType === type.value && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-gray-900">
                            {type.label}
                          </div>
                          <div className="text-sm text-gray-600 mt-0.5">
                            {type.description}
                          </div>
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
                    placeholder="e.g. Haircut, Color, Balayage"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the service..."
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                </div>

                {/* Price - Hidden for variant_group */}
                {serviceType !== 'variant_group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Price type
                    </label>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setPriceType('fixed')}
                        disabled={isSubmitting}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                          priceType === 'fixed'
                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        Fixed price
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceType('from')}
                        disabled={isSubmitting}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                          priceType === 'from'
                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        From price
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                        £
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Duration *
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
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
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-900">
                      Locations *
                    </label>
                    <button
                      type="button"
                      onClick={handleAllLocationsToggle}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      {allLocations ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {venues.map((venue) => (
                      <label
                        key={venue.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedVenues.includes(venue.id)}
                          onChange={() => handleVenueToggle(venue.id)}
                          disabled={isSubmitting}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">
                          {venue.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-900">
                      Team members *
                    </label>
                    <button
                      type="button"
                      onClick={handleAllTeamToggle}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      {allTeam ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {teamMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamMembers.includes(member.id)}
                          onChange={() => handleTeamMemberToggle(member.id)}
                          disabled={isSubmitting}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">
                          {member.first_name} {member.last_name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-600">Step {currentStep} of 2</div>
            <div className="flex gap-3">
              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={isSubmitting || !name.trim()}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
