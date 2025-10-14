// components/admin/services/service-list-client.tsx
'use client';

import { useState } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { AddCategoryModal } from './add-category-modal';
import { EditCategoryModal } from './edit-category-modal';
import { AddServiceModal } from './add-service-modal';
import { EditServiceModal } from './edit-service-modal';
import { ServiceCard } from './service-card';
import { AddVariantModal } from './add-variant-modal';
import { VariantListModal } from './variant-list-modal';

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
  type: 'service' | 'bundle' | 'variant_group';
  price_type: 'fixed' | 'from';
  price: number | null;
  display_price?: number;
  duration_minutes: number;
  is_bookable: boolean;
  category?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface ServiceListClientProps {
  initialServices: Service[];
  initialCategories: Category[];
}

export function ServiceListClient({
  initialServices,
  initialCategories,
}: ServiceListClientProps) {
  const [services] = useState(initialServices);
  const [categories] = useState(initialCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [addingVariantToService, setAddingVariantToService] =
    useState<Service | null>(null);
  const [viewingVariantsOf, setViewingVariantsOf] = useState<Service | null>(
    null
  );

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
    <div className="h-full flex flex-col bg-gray-50">
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Location filter placeholder */}
          <button className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2">
            <span className="text-sm text-gray-700">All locations</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Filters placeholder */}
          <button className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2">
            <span className="text-sm text-gray-700">Filters</span>
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
          </button>

          {/* Add dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 flex items-center gap-2 font-medium"
            >
              <span>Add</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showAddDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAddDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
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
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
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
                  onDoubleClick={() => setEditingCategory(category)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
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

            {/* Add category button */}
            <button
              onClick={() => setShowAddCategory(true)}
              className="w-full mt-6 flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Add category</span>
            </button>
          </div>
        </div>

        {/* Services list */}
        <div className="flex-1 overflow-y-auto p-8">
          {Object.keys(groupedServices).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No services found</p>
              <button
                onClick={() => setShowAddService(true)}
                className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add your first service
              </button>
            </div>
          ) : (
            <div className="space-y-12 max-w-4xl">
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
                          <button className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2">
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
                            onEdit={() => setEditingService(service)}
                            onAddVariant={() =>
                              setAddingVariantToService(service)
                            }
                            onViewVariants={() => setViewingVariantsOf(service)}
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

      {/* Modals */}
      <AddCategoryModal
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
      />

      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}

      <AddServiceModal
        isOpen={showAddService}
        onClose={() => setShowAddService(false)}
        categories={categories}
      />

      {editingService && (
        <EditServiceModal
          service={editingService}
          isOpen={!!editingService}
          onClose={() => setEditingService(null)}
          categories={categories}
        />
      )}

      {addingVariantToService && (
        <AddVariantModal
          parentService={addingVariantToService}
          isOpen={!!addingVariantToService}
          onClose={() => setAddingVariantToService(null)}
        />
      )}

      {viewingVariantsOf && (
        <VariantListModal
          parentService={viewingVariantsOf}
          isOpen={!!viewingVariantsOf}
          onClose={() => setViewingVariantsOf(null)}
        />
      )}
    </div>
  );
}
