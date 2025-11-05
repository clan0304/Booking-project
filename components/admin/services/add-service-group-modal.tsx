// components/admin/services/add-service-group-modal.tsx
// Updated with nested service creation capability

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Search,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { createServiceGroup } from '@/app/actions/service-groups';
import { AddServiceModal } from './add-service-modal';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Service {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
  type: string;
  service_categories:
    | {
        id: string;
        name: string;
        color: string;
      }
    | {
        id: string;
        name: string;
        color: string;
      }[]
    | null;
}

interface AddServiceGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  categories: Category[];
  services: Service[];
}

export function AddServiceGroupModal({
  isOpen,
  onClose,
  onSuccess,
  categories,
  services: initialServices,
}: AddServiceGroupModalProps) {
  const router = useRouter();

  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [displayMode, setDisplayMode] = useState<'modal' | 'list'>('modal');

  // Step 2 - Service selection
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // ✅ NEW: Local services list (can be updated when new service is created)
  const [services, setServices] = useState<Service[]>(initialServices);

  // ✅ NEW: Nested service modal state
  const [showCreateService, setShowCreateService] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Filter services for Step 2
  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    // Get category_id from service_categories (handle array or single object)
    const categoryId = service.service_categories
      ? Array.isArray(service.service_categories)
        ? service.service_categories[0]?.id
        : service.service_categories.id
      : null;

    const matchesCategory =
      !filterCategoryId || categoryId === filterCategoryId;
    return matchesSearch && matchesCategory;
  });

  const handleServiceToggle = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter((id) => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  };

  const handleNext = () => {
    setError('');

    if (currentStep === 1) {
      // Validate Step 1
      if (!name.trim()) {
        setError('Group name is required');
        return;
      }
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(1);
  };

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      await createServiceGroup({
        name: name.trim(),
        category_id: categoryId || undefined,
        description: description.trim() || undefined,
        display_mode: displayMode,
        service_ids: selectedServices.length > 0 ? selectedServices : undefined,
      });

      // Reset form
      setName('');
      setCategoryId('');
      setDescription('');
      setDisplayMode('modal');
      setSelectedServices([]);
      setCurrentStep(1);
      setSearchQuery('');
      setFilterCategoryId(null);

      router.refresh();

      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to create service group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ NEW: Handle new service creation
  const handleServiceCreated = async (serviceData?: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
  }) => {
    if (serviceData) {
      // Auto-select the new service
      setSelectedServices([...selectedServices, serviceData.id]);

      // Optimistically add to local services list
      const newService: Service = {
        id: serviceData.id,
        name: serviceData.name,
        price: serviceData.price,
        duration_minutes: serviceData.duration_minutes,
        type: 'service',
        service_categories: categoryId
          ? categories.find((c) => c.id === categoryId) || null
          : null,
      };
      setServices([...services, newService]);
    }
    setShowCreateService(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Create Service Group
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Step {currentStep} of 2:{' '}
                {currentStep === 1 ? 'Basic Information' : 'Add Services'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex px-6 pt-4">
            <div className="flex-1">
              <div
                className={`h-1 rounded-full ${
                  currentStep >= 1 ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
              <p className="text-xs text-gray-600 mt-1">Basic Info</p>
            </div>
            <div className="w-8" />
            <div className="flex-1">
              <div
                className={`h-1 rounded-full ${
                  currentStep >= 2 ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
              <p className="text-xs text-gray-600 mt-1">Services</p>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Hair Color Options"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    autoFocus
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
                    placeholder="Brief description of this service group..."
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Display Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDisplayMode('modal')}
                      disabled={isSubmitting}
                      className={`flex items-center gap-3 p-4 border-2 rounded-lg transition-colors ${
                        displayMode === 'modal'
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Grid className="w-5 h-5" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">Modal</p>
                        <p className="text-xs text-gray-600">
                          Show services in a popup
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDisplayMode('list')}
                      disabled={isSubmitting}
                      className={`flex items-center gap-3 p-4 border-2 rounded-lg transition-colors ${
                        displayMode === 'list'
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <List className="w-5 h-5" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">List</p>
                        <p className="text-xs text-gray-600">
                          Show services expanded
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Add Services */}
            {currentStep === 2 && (
              <div className="space-y-4">
                {/* ✅ NEW: Header with Create Service button */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Select services or create new ones
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateService(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create service
                  </button>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search services..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <select
                    value={filterCategoryId || ''}
                    onChange={(e) =>
                      setFilterCategoryId(e.target.value || null)
                    }
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected count */}
                {selectedServices.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <span className="text-sm font-medium text-purple-700">
                      {selectedServices.length} service
                      {selectedServices.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                )}

                {/* Services list */}
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {filteredServices.length === 0 ? (
                    <div className="p-8 text-center">
                      {services.length === 0 ? (
                        <div className="space-y-3">
                          <p className="text-gray-500">No services yet</p>
                          <button
                            type="button"
                            onClick={() => setShowCreateService(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Create your first service
                          </button>
                        </div>
                      ) : (
                        <p className="text-gray-500">No services found</p>
                      )}
                    </div>
                  ) : (
                    filteredServices.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedServices.includes(service.id)}
                          onChange={() => handleServiceToggle(service.id)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">
                              {service.name}
                            </p>
                            {service.service_categories && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: `${
                                    Array.isArray(service.service_categories)
                                      ? service.service_categories[0]?.color
                                      : service.service_categories.color
                                  }20`,
                                  color: Array.isArray(
                                    service.service_categories
                                  )
                                    ? service.service_categories[0]?.color
                                    : service.service_categories.color,
                                }}
                              >
                                {Array.isArray(service.service_categories)
                                  ? service.service_categories[0]?.name
                                  : service.service_categories.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                            <span>${service.price?.toFixed(0) || 'N/A'}</span>
                            <span>•</span>
                            <span>{service.duration_minutes} min</span>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating...' : 'Create Group'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ NEW: Nested Service Creation Modal */}
      {showCreateService && (
        <AddServiceModal
          isOpen={showCreateService}
          onClose={() => setShowCreateService(false)}
          categories={categories}
          onSuccess={handleServiceCreated}
          zIndex={60} // ✅ Higher z-index for proper modal stacking
        />
      )}
    </>
  );
}
