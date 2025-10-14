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
];

const SERVICE_TYPES = [
  {
    value: 'service',
    label: 'Regular Service',
    description: 'Standalone bookable service',
  },
  {
    value: 'variant_group',
    label: 'Service with Variants',
    description: 'Group with options (e.g., hair lengths)',
  },
  {
    value: 'bundle',
    label: 'Service Bundle',
    description: 'Package of multiple services',
  },
];

export function AddServiceModal({
  isOpen,
  onClose,
  categories,
}: AddServiceModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [serviceType, setServiceType] = useState<
    'service' | 'bundle' | 'variant_group'
  >('service');
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
  const [allLocations, setAllLocations] = useState(true);
  const [allTeam, setAllTeam] = useState(true);

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

      // Select all by default
      setSelectedVenues(venuesData.map((v) => v.id));
      setSelectedTeamMembers(teamData.map((t) => t.id));
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleToggleAllLocations = () => {
    if (allLocations) {
      setSelectedVenues([]);
    } else {
      setSelectedVenues(venues.map((v) => v.id));
    }
    setAllLocations(!allLocations);
  };

  const handleToggleAllTeam = () => {
    if (allTeam) {
      setSelectedTeamMembers([]);
    } else {
      setSelectedTeamMembers(teamMembers.map((t) => t.id));
    }
    setAllTeam(!allTeam);
  };

  const handleToggleVenue = (venueId: string) => {
    setSelectedVenues((prev) =>
      prev.includes(venueId)
        ? prev.filter((id) => id !== venueId)
        : [...prev, venueId]
    );
    setAllLocations(false);
  };

  const handleToggleTeamMember = (memberId: string) => {
    setSelectedTeamMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
    setAllTeam(false);
  };

  const handleSubmit = async () => {
    setError('');

    if (!name.trim()) {
      setError('Service name is required');
      setCurrentStep(1);
      return;
    }

    // Variant groups don't need a price (calculated from variants)
    if (serviceType !== 'variant_group' && parseFloat(price) < 0) {
      setError('Price must be a positive number');
      setCurrentStep(1);
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
        venue_ids: allLocations ? venues.map((v) => v.id) : selectedVenues,
        team_member_ids: allTeam
          ? teamMembers.map((t) => t.id)
          : selectedTeamMembers,
      });

      router.refresh();
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create service:', err);
      setError(err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setServiceType('service');
    setName('');
    setCategoryId('');
    setDescription('');
    setPriceType('fixed');
    setPrice('0.00');
    setDuration(30);
    setSelectedVenues([]);
    setSelectedTeamMembers([]);
    setAllLocations(true);
    setAllTeam(true);
  };

  if (!isOpen) return null;

  const steps = [
    { number: 1, label: 'Basic details' },
    { number: 2, label: 'Locations' },
    { number: 3, label: 'Team members' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex overflow-hidden">
        {/* Sidebar with steps */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-6">New service</h2>
          <div className="space-y-2">
            {steps.map((step) => (
              <button
                key={step.number}
                onClick={() => setCurrentStep(step.number)}
                disabled={isSubmitting}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentStep === step.number
                    ? 'bg-purple-50 text-purple-700'
                    : 'hover:bg-gray-100 text-gray-700'
                } disabled:opacity-50`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    currentStep === step.number
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step.number}
                </div>
                <span className="font-medium">{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">
              {steps.find((s) => s.number === currentStep)?.label}
            </h3>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Step 1: Basic details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Service Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3">
                    Service Type
                  </label>
                  <div className="space-y-2">
                    {SERVICE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setServiceType(type.value as any)}
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
                    Service name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Men's Haircut"
                    maxLength={255}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {name.length}/255
                  </div>
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
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Description{' '}
                    <span className="text-gray-500">(Optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Add a short description"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 resize-none"
                  />
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {description.length}/1000
                  </div>
                </div>

                {/* Pricing and duration - only for non-variant-groups */}
                {serviceType !== 'variant_group' && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-4">
                      Pricing and duration
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
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
                          <option value="fixed">Fixed</option>
                          <option value="from">From</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            A$
                          </span>
                          <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            min="0"
                            step="0.01"
                            disabled={isSubmitting}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          Duration
                        </label>
                        <select
                          value={duration}
                          onChange={(e) =>
                            setDuration(parseInt(e.target.value))
                          }
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
                    </div>
                  </div>
                )}

                {/* Info for variant groups */}
                {serviceType === 'variant_group' && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-purple-800">
                      <strong>ℹ️ Variant Group:</strong> After creating this
                      service, you'll be able to add variant options (e.g., hair
                      lengths). The display price will automatically show the
                      minimum price from all variants.
                    </p>
                  </div>
                )}

                {/* Duration for variant groups */}
                {serviceType === 'variant_group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Average Duration
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
                    <p className="text-xs text-gray-500 mt-1">
                      This is a reference duration. Each variant can have its
                      own duration.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Locations */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Choose the locations where this service is available
                </p>

                <button
                  onClick={handleToggleAllLocations}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-2 rounded-lg transition-all ${
                    allLocations
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center ${
                      allLocations
                        ? 'bg-purple-600'
                        : 'bg-white border-2 border-gray-300'
                    }`}
                  >
                    {allLocations && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="font-medium">All locations</span>
                </button>

                <div className="space-y-2">
                  {venues.map((venue) => (
                    <button
                      key={venue.id}
                      onClick={() => handleToggleVenue(venue.id)}
                      disabled={allLocations}
                      className={`w-full flex items-center gap-3 px-4 py-3 border-2 rounded-lg transition-all ${
                        selectedVenues.includes(venue.id)
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${allLocations ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center ${
                          selectedVenues.includes(venue.id)
                            ? 'bg-purple-600'
                            : 'bg-white border-2 border-gray-300'
                        }`}
                      >
                        {selectedVenues.includes(venue.id) && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className="font-medium">{venue.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Team members */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Choose which team members can perform this service
                </p>

                <button
                  onClick={handleToggleAllTeam}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-2 rounded-lg transition-all ${
                    allTeam
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center ${
                      allTeam
                        ? 'bg-purple-600'
                        : 'bg-white border-2 border-gray-300'
                    }`}
                  >
                    {allTeam && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="font-medium">All team members</span>
                </button>

                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleToggleTeamMember(member.id)}
                      disabled={allTeam}
                      className={`w-full flex items-center gap-3 px-4 py-3 border-2 rounded-lg transition-all ${
                        selectedTeamMembers.includes(member.id)
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${allTeam ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center ${
                          selectedTeamMembers.includes(member.id)
                            ? 'bg-purple-600'
                            : 'bg-white border-2 border-gray-300'
                        }`}
                      >
                        {selectedTeamMembers.includes(member.id) && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {member.photo_url ? (
                          <img
                            src={member.photo_url}
                            alt={member.first_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-medium">
                            {member.first_name[0]}
                          </div>
                        )}
                        <span className="font-medium">
                          {member.first_name} {member.last_name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                if (currentStep === 1) {
                  onClose();
                } else {
                  setCurrentStep(currentStep - 1);
                }
              }}
              disabled={isSubmitting}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
            >
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </button>
            <div className="flex gap-3">
              {currentStep < 3 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create service'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
