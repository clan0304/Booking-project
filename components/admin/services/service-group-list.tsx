// components/admin/services/service-group-list.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ServiceGroupCard } from './service-group-card';
import { AddServiceGroupModal } from './add-service-group-modal';
import { EditServiceGroupModal } from './edit-service-group-modal';

interface Category {
  id: string;
  name: string;
  color: string;
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

interface ServiceGroupListProps {
  initialGroups: ServiceGroup[];
  categories: Category[];
  services: Service[];
}

export function ServiceGroupList({
  initialGroups,
  categories,
  services,
}: ServiceGroupListProps) {
  const groups = initialGroups;

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServiceGroup | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (isRefreshing) {
      const timer = setTimeout(() => {
        setIsRefreshing(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing, initialGroups]);

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingGroup(null);
  };

  const handleSuccess = () => {
    setIsRefreshing(true);
    handleModalClose();
  };

  const handleDelete = (group: ServiceGroup) => {
    setEditingGroup(group);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Groups</h2>
          <p className="text-sm text-gray-600 mt-1">
            Group related services together for easier selection
          </p>
        </div>
        <button
          onClick={() => !isRefreshing && setShowAddModal(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Create group
        </button>
      </div>

      {/* Loading overlay */}
      {isRefreshing && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-600 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          Refreshing...
        </div>
      )}

      {/* Groups grid */}
      {groups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-2">
            <Plus className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            No service groups yet
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Create your first service group to organize related services
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <ServiceGroupCard
              key={group.id}
              group={group}
              onEdit={() => !isRefreshing && setEditingGroup(group)}
              onDelete={() => !isRefreshing && handleDelete(group)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddServiceGroupModal
          isOpen={showAddModal}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
          categories={categories}
          services={services}
        />
      )}

      {editingGroup && (
        <EditServiceGroupModal
          group={editingGroup}
          isOpen={!!editingGroup}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
          categories={categories}
          services={services}
        />
      )}
    </div>
  );
}
