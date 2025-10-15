// components/admin/services/edit-service-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Trash2, Settings } from 'lucide-react';
import {
  updateService,
  deleteService,
  getServiceById,
  getAllVenues,
  getAllTeamMembers,
} from '@/app/actions/services';
import { CustomPricingModal } from './custom-pricing-modal';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Service {
  id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  type: 'service' | 'bundle' | 'variant_group';
  price_type: 'fixed' | 'from';
  price: number | null;
  duration_minutes: number;
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

// ✅ Proper types for the nested service data
interface ServiceVenue {
  id: string;
  venue_id: string;
  is_active: boolean;
  venues: {
    id: string;
    name: string;
  };
}

interface ServiceTeamMember {
  id: string;
  team_member_id: string;
  custom_price: number | null;
  custom_duration_minutes: number | null;
  is_active: boolean;
  users: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  };
}

// ✅ Complete service data type returned by getServiceById
interface ServiceData extends Service {
  category: {
    id: string;
    name: string;
    color: string;
  } | null;
  service_venues: ServiceVenue[];
  service_team_members: ServiceTeamMember[];
}

interface EditServiceModalProps {
  service: Service;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
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

export function EditServiceModal({
  service,
  isOpen,
  onClose,
  categories,
  onSuccess,
}: EditServiceModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [name, setName] = useState(service.name);
  const [categoryId, setCategoryId] = useState(service.category_id || '');
  const [description, setDescription] = useState(service.description || '');
  const [priceType, setPriceType] = useState<'fixed' | 'from'>(
    service.price_type
  );
  const [price, setPrice] = useState(service.price?.toString() || '0.00');
  const [duration, setDuration] = useState(service.duration_minutes);

  // Venues and team members
  const [venues, setVenues] = useState<Venue[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState(false);
  const [allTeam, setAllTeam] = useState(false);

  // ✅ Custom pricing modal state
  const [editingPricingFor, setEditingPricingFor] = useState<{
    member: TeamMember;
    customPrice: number | null;
    customDuration: number | null;
  } | null>(null);

  // ✅ Store custom pricing data from service_team_members
  const [teamMemberPricing, setTeamMemberPricing] = useState<
    Map<
      string,
      {
        customPrice: number | null;
        customDuration: number | null;
      }
    >
  >(new Map());

  // ✅ Reset form state when modal opens or service changes
  useEffect(() => {
    if (isOpen) {
      setName(service.name);
      setCategoryId(service.category_id || '');
      setDescription(service.description || '');
      setPriceType(service.price_type);
      setPrice(service.price?.toString() || '0.00');
      setDuration(service.duration_minutes);
      setError('');
      setShowDeleteConfirm(false);
      setCurrentStep(1);
    }
  }, [isOpen, service]);

  // ✅ Define loadData BEFORE useEffect
  const loadData = useCallback(async () => {
    try {
      const [serviceData, venuesData, teamData] = await Promise.all([
        getServiceById(service.id) as Promise<ServiceData>,
        getAllVenues(),
        getAllTeamMembers(),
      ]);

      setVenues(venuesData);
      setTeamMembers(teamData);

      // ✅ Properly typed, no more 'any'
      const serviceVenueIds =
        serviceData.service_venues
          ?.filter((sv) => sv.is_active)
          .map((sv) => sv.venue_id) || [];
      setSelectedVenues(serviceVenueIds);
      setAllLocations(serviceVenueIds.length === venuesData.length);

      // ✅ Properly typed, no more 'any'
      const serviceTeamIds =
        serviceData.service_team_members
          ?.filter((stm) => stm.is_active)
          .map((stm) => stm.team_member_id) || [];
      setSelectedTeamMembers(serviceTeamIds);
      setAllTeam(serviceTeamIds.length === teamData.length);

      // ✅ Store custom pricing data for each team member
      const pricingMap = new Map();
      serviceData.service_team_members?.forEach((stm) => {
        if (stm.is_active) {
          pricingMap.set(stm.team_member_id, {
            customPrice: stm.custom_price,
            customDuration: stm.custom_duration_minutes,
          });
        }
      });
      setTeamMemberPricing(pricingMap);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load service details');
    }
  }, [service.id]);

  // ✅ useEffect with proper dependencies
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleToggleAllLocations = () => {
    if (allLocations) {
      setSelectedVenues([]);
      setAllLocations(false);
    } else {
      setSelectedVenues(venues.map((v) => v.id));
      setAllLocations(true);
    }
  };

  const handleToggleAllTeam = () => {
    if (allTeam) {
      setSelectedTeamMembers([]);
      setAllTeam(false);
    } else {
      setSelectedTeamMembers(teamMembers.map((t) => t.id));
      setAllTeam(true);
    }
  };

  const handleToggleVenue = (venueId: string) => {
    setSelectedVenues((prev) => {
      const newSelected = prev.includes(venueId)
        ? prev.filter((id) => id !== venueId)
        : [...prev, venueId];
      setAllLocations(newSelected.length === venues.length);
      return newSelected;
    });
  };

  const handleToggleTeamMember = (memberId: string) => {
    setSelectedTeamMembers((prev) => {
      const newSelected = prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId];
      setAllTeam(newSelected.length === teamMembers.length);
      return newSelected;
    });
  };

  const handleSubmit = async () => {
    setError('');

    if (!name.trim()) {
      setError('Service name is required');
      setCurrentStep(1);
      return;
    }

    if (service.type !== 'variant_group' && parseFloat(price) < 0) {
      setError('Price must be a positive number');
      setCurrentStep(1);
      return;
    }

    if (selectedVenues.length === 0) {
      setError('Please select at least one location');
      setCurrentStep(2);
      return;
    }

    if (selectedTeamMembers.length === 0) {
      setError('Please select at least one team member');
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      await updateService(service.id, {
        name: name.trim(),
        category_id: categoryId || undefined,
        description: description.trim() || undefined,
        price_type: priceType,
        price: service.type === 'variant_group' ? undefined : parseFloat(price),
        duration_minutes: duration,
        venue_ids: selectedVenues,
        team_member_ids: selectedTeamMembers,
      });

      router.refresh();

      // ✅ Call onSuccess instead of onClose
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to update service:', err);
      setError(err instanceof Error ? err.message : 'Failed to update service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteService(service.id);

      router.refresh();

      // ✅ Call onSuccess instead of onClose
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete service:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete service');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isDeleting) {
      setError('');
      setCurrentStep(1);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Service</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting || isDeleting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Service type
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  {service.type === 'service' && 'Regular Service'}
                  {service.type === 'variant_group' && 'Service with Variants'}
                  {service.type === 'bundle' && 'Service Bundle'}
                  <span className="text-gray-500 ml-2">
                    (Cannot be changed)
                  </span>
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
              {service.type !== 'variant_group' && (
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
                    onClick={handleToggleAllLocations}
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
                        onChange={() => handleToggleVenue(venue.id)}
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
                    onClick={handleToggleAllTeam}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    {allTeam ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {teamMembers.map((member) => {
                    const pricing = teamMemberPricing.get(member.id);
                    const hasCustomPricing =
                      pricing &&
                      (pricing.customPrice !== null ||
                        pricing.customDuration !== null);

                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded group"
                      >
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTeamMembers.includes(member.id)}
                            onChange={() => handleToggleTeamMember(member.id)}
                            disabled={isSubmitting}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700">
                            {member.first_name} {member.last_name}
                          </span>
                          {hasCustomPricing && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              Custom pricing
                            </span>
                          )}
                        </label>

                        {/* Custom Pricing Button */}
                        {selectedTeamMembers.includes(member.id) && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingPricingFor({
                                member,
                                customPrice: pricing?.customPrice || null,
                                customDuration: pricing?.customDuration || null,
                              })
                            }
                            disabled={isSubmitting}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                            title="Custom pricing"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          {/* Delete button on the left */}
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSubmitting || isDeleting}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Are you sure?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Navigation buttons on the right */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Step {currentStep} of 2</div>
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
              disabled={isSubmitting || isDeleting}
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
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Update Service'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Custom Pricing Modal */}
      {editingPricingFor && (
        <CustomPricingModal
          isOpen={!!editingPricingFor}
          onClose={() => setEditingPricingFor(null)}
          service={{
            id: service.id,
            name: service.name,
            price: service.price,
            duration_minutes: service.duration_minutes,
          }}
          teamMember={editingPricingFor.member}
          currentCustomPrice={editingPricingFor.customPrice}
          currentCustomDuration={editingPricingFor.customDuration}
          onSuccess={() => {
            setEditingPricingFor(null);
            // Reload the service data to get updated custom pricing
            loadData();
          }}
        />
      )}
    </div>
  );
}
