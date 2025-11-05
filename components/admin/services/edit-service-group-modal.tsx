// components/admin/services/edit-service-group-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Search, Grid, List, Trash2, Plus, Pencil } from 'lucide-react';
import {
  updateServiceGroup,
  deleteServiceGroup,
  getServicesInGroup,
  getAvailableServicesForGroup,
  addServicesToGroup,
  removeServiceFromGroup,
} from '@/app/actions/service-groups';
import { getServiceById } from '@/app/actions/services';
import { AddServiceModal } from './add-service-modal';
import { EditServiceModal } from './edit-service-modal';

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

interface ServiceGroup {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  display_mode: 'modal' | 'list';
  service_categories: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface ServiceInGroup {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  display_order: number;
}

interface FullService {
  id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  type: 'service' | 'bundle';
  price_type: 'fixed' | 'from';
  price: number | null;
  duration_minutes: number;
}

interface EditServiceGroupModalProps {
  group: ServiceGroup;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  categories: Category[];
  services: Service[];
}

export function EditServiceGroupModal({
  group,
  isOpen,
  onClose,
  onSuccess,
  categories,
}: EditServiceGroupModalProps) {
  const router = useRouter();

  // Tabs
  const [activeTab, setActiveTab] = useState<'info' | 'services'>('info');

  // Form state - Basic Info
  const [name, setName] = useState(group.name);
  const [categoryId, setCategoryId] = useState(group.category_id || '');
  const [description, setDescription] = useState(group.description || '');
  const [displayMode, setDisplayMode] = useState<'modal' | 'list'>(
    group.display_mode
  );

  // Services state
  const [groupServices, setGroupServices] = useState<ServiceInGroup[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [showCreateService, setShowCreateService] = useState(false);
  const [editingService, setEditingService] = useState<FullService | null>(
    null
  );
  const [loadingServiceData, setLoadingServiceData] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load services data function wrapped in useCallback
  const loadServicesData = useCallback(async () => {
    setLoadingServices(true);
    try {
      const [inGroup, available] = await Promise.all([
        getServicesInGroup(group.id),
        getAvailableServicesForGroup(group.id),
      ]);
      setGroupServices(inGroup);
      setAvailableServices(available);
    } catch (err) {
      console.error('Failed to load services:', err);
      setError('Failed to load services');
    } finally {
      setLoadingServices(false);
    }
  }, [group.id]);

  // Load services when switching to services tab
  useEffect(() => {
    if (activeTab === 'services' && groupServices.length === 0) {
      loadServicesData();
    }
  }, [activeTab, groupServices.length, loadServicesData]);

  // Handle new service creation
  const handleServiceCreated = async (serviceData?: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
  }) => {
    if (serviceData) {
      try {
        // Automatically add to this group
        await addServicesToGroup(group.id, [serviceData.id]);

        // Refresh services lists
        await loadServicesData();
      } catch (err) {
        console.error('Failed to add service to group:', err);
        setError('Failed to add new service to group');
      }
    }
    setShowCreateService(false);
  };

  // Handle editing a service
  const handleEditService = async (serviceId: string) => {
    setLoadingServiceData(true);
    setError('');

    try {
      const fullService = await getServiceById(serviceId);
      setEditingService(fullService as FullService);
    } catch (err) {
      console.error('Failed to load service:', err);
      setError('Failed to load service details');
    } finally {
      setLoadingServiceData(false);
    }
  };

  // Handle service edit success
  const handleServiceEdited = () => {
    setEditingService(null);
    // Refresh services lists
    loadServicesData();
  };

  if (!isOpen) return null;

  // Filter available services
  const filteredAvailableServices = availableServices.filter((service) => {
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
    if (selectedToAdd.includes(serviceId)) {
      setSelectedToAdd(selectedToAdd.filter((id) => id !== serviceId));
    } else {
      setSelectedToAdd([...selectedToAdd, serviceId]);
    }
  };

  const handleAddServices = async () => {
    if (selectedToAdd.length === 0) return;

    setError('');
    setLoadingServices(true);

    try {
      await addServicesToGroup(group.id, selectedToAdd);
      setSelectedToAdd([]);
      await loadServicesData();
    } catch (err) {
      console.error('Failed to add services:', err);
      setError(err instanceof Error ? err.message : 'Failed to add services');
    } finally {
      setLoadingServices(false);
    }
  };

  const handleRemoveService = async (serviceId: string) => {
    setError('');
    setLoadingServices(true);

    try {
      await removeServiceFromGroup(group.id, serviceId);
      await loadServicesData();
    } catch (err) {
      console.error('Failed to remove service:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove service');
    } finally {
      setLoadingServices(false);
    }
  };

  const handleUpdateInfo = async () => {
    setError('');

    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateServiceGroup(group.id, {
        name: name.trim(),
        category_id: categoryId || undefined,
        description: description.trim() || undefined,
        display_mode: displayMode,
      });

      router.refresh();

      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to update service group:', err);
      setError(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await deleteServiceGroup(group.id);

      router.refresh();

      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete service group:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete group');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Group</h2>
              <p className="text-sm text-gray-600 mt-1">{group.name}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('info')}
                className={`pb-3 border-b-2 font-medium transition-colors ${
                  activeTab === 'info'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Basic Info
              </button>
              <button
                onClick={() => setActiveTab('services')}
                className={`pb-3 border-b-2 font-medium transition-colors ${
                  activeTab === 'services'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Services ({groupServices.length})
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Tab 1: Basic Info */}
            {activeTab === 'info' && (
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

                {/* Delete button */}
                <div className="pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Group
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Services */}
            {activeTab === 'services' && (
              <div className="space-y-6">
                {loadingServices ? (
                  <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 mt-4">Loading services...</p>
                  </div>
                ) : (
                  <>
                    {/* Services in group */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">
                        Services in this group ({groupServices.length})
                      </h3>
                      {groupServices.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                          <p className="text-gray-500 text-sm">
                            No services in this group yet
                          </p>
                        </div>
                      ) : (
                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                          {groupServices.map((service) => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between p-4"
                            >
                              <div>
                                <p className="font-medium text-gray-900">
                                  {service.name}
                                </p>
                                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                  <span>${service.price.toFixed(0)}</span>
                                  <span>•</span>
                                  <span>{service.duration_minutes} min</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditService(service.id)}
                                  disabled={loadingServiceData}
                                  className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                                  title="Edit service"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleRemoveService(service.id)
                                  }
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove from group"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add services */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">
                          Add services
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowCreateService(true)}
                          disabled={loadingServices}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                          Create service
                        </button>
                      </div>

                      {/* Add Selected Button */}
                      {selectedToAdd.length > 0 && (
                        <div className="mb-3">
                          <button
                            onClick={handleAddServices}
                            disabled={loadingServices}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                            Add {selectedToAdd.length} service
                            {selectedToAdd.length !== 1 ? 's' : ''}
                          </button>
                        </div>
                      )}

                      {/* Search and Filter */}
                      <div className="flex gap-3 mb-4">
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

                      {/* Available services list */}
                      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
                        {filteredAvailableServices.length === 0 ? (
                          <div className="p-6 text-center text-gray-500 text-sm">
                            {availableServices.length === 0
                              ? 'All services are already in this group'
                              : 'No services found'}
                          </div>
                        ) : (
                          filteredAvailableServices.map((service) => (
                            <label
                              key={service.id}
                              className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedToAdd.includes(service.id)}
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
                                      className="text-xs px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: `${
                                          Array.isArray(
                                            service.service_categories
                                          )
                                            ? service.service_categories[0]
                                                ?.color
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
                                  <span>
                                    ${service.price?.toFixed(0) || 'N/A'}
                                  </span>
                                  <span>•</span>
                                  <span>{service.duration_minutes} min</span>
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {activeTab === 'info' && (
              <button
                type="button"
                onClick={handleUpdateInfo}
                disabled={isSubmitting || isDeleting}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 rounded-xl">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Delete Service Group?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  This will remove the group but won&apos;t delete the services
                  themselves. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested Service Modal */}
      {showCreateService && (
        <AddServiceModal
          isOpen={showCreateService}
          onClose={() => setShowCreateService(false)}
          categories={categories}
          onSuccess={handleServiceCreated}
          zIndex={60}
        />
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <EditServiceModal
          isOpen={!!editingService}
          onClose={() => setEditingService(null)}
          service={editingService}
          categories={categories}
          onSuccess={handleServiceEdited}
        />
      )}
    </>
  );
}
