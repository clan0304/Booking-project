// components/admin/services/service-list-client.tsx
'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { AddCategoryModal } from './add-category-modal';
import { EditCategoryModal } from './edit-category-modal';
import { AddServiceModal } from './add-service-modal';
import { EditServiceModal } from './edit-service-modal';
import { ServiceCard } from './service-card';
import { ServiceGroupList } from './service-group-list';

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  display_order: number;
}

interface Service {
  id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  type: 'service' | 'bundle';
  price_type: 'fixed' | 'from';
  price: number | null;
  display_price?: number;
  duration_minutes: number;
  is_bookable: boolean;
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
  min_price: number;
  service_count: number;
  service_categories: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface ServiceListClientProps {
  initialServices: Service[];
  initialCategories: Category[];
  initialServiceGroups: ServiceGroup[];
}

export function ServiceListClient({
  initialServices,
  initialCategories,
  initialServiceGroups,
}: ServiceListClientProps) {
  const services = initialServices;
  const categories = initialCategories;
  const serviceGroups = initialServiceGroups;

  const [activeTab, setActiveTab] = useState<
    'categories' | 'services' | 'groups'
  >('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // ✅ Loading state - only shown after successful submissions
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ Listen for when page is refreshing after router.refresh()
  useEffect(() => {
    if (isRefreshing) {
      // Auto-hide loading after data has been refreshed
      const timer = setTimeout(() => {
        setIsRefreshing(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing, initialServices, initialCategories, initialServiceGroups]);

  // ✅ Simple close handlers - no refresh, just close
  const handleCategoryModalClose = () => {
    setShowAddCategory(false);
    setEditingCategory(null);
  };

  const handleServiceModalClose = () => {
    setShowAddService(false);
    setEditingService(null);
  };

  // Filter services
  const filteredServices = services.filter((service) => {
    const matchesSearch =
      searchQuery === '' ||
      service.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === null || service.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group services by category
  const groupedServices = filteredServices.reduce((acc, service) => {
    const categoryId = service.category_id || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  // Get service count per category
  const categoryServiceCounts = categories.map((cat) => ({
    ...cat,
    count: services.filter((s) => s.category_id === cat.id).length,
  }));

  const totalServiceCount = services.length;

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      {/* ✅ Loading Overlay - only shows after successful submission */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-gray-700">Refreshing...</p>
          </div>
        </div>
      )}

      {/* ✅ Tab Navigation */}
      <div className="border-b border-gray-200 bg-white px-8">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'categories'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'services'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Services
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'groups'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Service Groups
          </button>
        </div>
      </div>

      {/* ✅ Categories Tab */}
      {activeTab === 'categories' && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Organize your services into categories
                </p>
              </div>
              <button
                onClick={() => setShowAddCategory(true)}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add category
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500 mb-4">No categories yet</p>
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create your first category
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setEditingCategory(category)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">
                          {category.name}
                        </h3>
                        {category.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {category.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {
                          services.filter((s) => s.category_id === category.id)
                            .length
                        }{' '}
                        services
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ Services Tab */}
      {activeTab === 'services' && (
        <>
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Search */}
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search service name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isRefreshing}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Location filter placeholder */}
              <button
                disabled={isRefreshing}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm text-gray-700">All locations</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {/* Add button with dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAddDropdown(!showAddDropdown)}
                  disabled={isRefreshing}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* Dropdown menu */}
                {showAddDropdown && !isRefreshing && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowAddDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                      <button
                        onClick={() => {
                          setShowAddService(true);
                          setShowAddDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Single service
                      </button>
                      <button
                        onClick={() => {
                          // TODO: Add bundle modal
                          setShowAddDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Bundle
                      </button>
                      <button
                        onClick={() => {
                          setShowAddCategory(true);
                          setShowAddDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Category
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Categories</h2>

                <div className="space-y-1">
                  {/* All categories */}
                  <button
                    onClick={() => setSelectedCategory(null)}
                    disabled={isRefreshing}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedCategory === null
                        ? 'bg-purple-50 text-purple-700'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-medium">All categories</span>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {totalServiceCount}
                    </span>
                  </button>

                  {/* Category list */}
                  {categoryServiceCounts.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      onDoubleClick={() =>
                        !isRefreshing && setEditingCategory(category)
                      }
                      disabled={isRefreshing}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedCategory === category.id
                          ? 'bg-purple-50 text-purple-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {category.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Services content */}
            <div className="flex-1 overflow-y-auto p-8">
              {filteredServices.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">
                    {searchQuery
                      ? 'No services found matching your search'
                      : 'No services yet'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setShowAddService(true)}
                      disabled={isRefreshing}
                      className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add your first service
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(groupedServices).map(
                    ([categoryId, categoryServices]) => {
                      const category =
                        categoryId === 'uncategorized'
                          ? {
                              id: 'uncategorized',
                              name: 'Uncategorized',
                              color: '#6B7280',
                            }
                          : categories.find((c) => c.id === categoryId);

                      if (!category) return null;

                      return (
                        <div key={categoryId}>
                          {/* Category header */}
                          <div className="mb-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-2xl font-semibold">
                                {category.name}
                              </h3>
                              <button
                                disabled={isRefreshing}
                                className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="text-sm text-gray-700">
                                  Actions
                                </span>
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              </button>
                            </div>
                          </div>

                          {/* Services in this category */}
                          <div className="space-y-3">
                            {categoryServices.map((service) => (
                              <ServiceCard
                                key={service.id}
                                service={service}
                                onEdit={() =>
                                  !isRefreshing && setEditingService(service)
                                }
                              />
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ✅ Service Groups Tab */}
      {activeTab === 'groups' && (
        <div className="flex-1 overflow-y-auto p-8">
          <ServiceGroupList
            initialGroups={serviceGroups}
            categories={categories}
            services={services}
          />
        </div>
      )}

      {/* Modals */}
      {!isRefreshing && (
        <>
          <AddCategoryModal
            isOpen={showAddCategory}
            onClose={handleCategoryModalClose}
            onSuccess={() => {
              setIsRefreshing(true);
              handleCategoryModalClose();
            }}
          />

          {editingCategory && (
            <EditCategoryModal
              category={editingCategory}
              isOpen={!!editingCategory}
              onClose={handleCategoryModalClose}
              onSuccess={() => {
                setIsRefreshing(true);
                handleCategoryModalClose();
              }}
            />
          )}

          <AddServiceModal
            isOpen={showAddService}
            onClose={handleServiceModalClose}
            categories={categories}
            onSuccess={() => {
              setIsRefreshing(true);
              handleServiceModalClose();
            }}
          />

          {editingService && (
            <EditServiceModal
              service={editingService}
              isOpen={!!editingService}
              onClose={handleServiceModalClose}
              categories={categories}
              onSuccess={() => {
                setIsRefreshing(true);
                handleServiceModalClose();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
