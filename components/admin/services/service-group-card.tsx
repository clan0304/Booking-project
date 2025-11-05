// components/admin/services/service-group-card.tsx
'use client';

import { MoreVertical, Package, Tag } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ServiceGroup {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  display_mode: 'modal' | 'list';
  service_count: number;
  min_price: number;
  service_categories: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface ServiceGroupCardProps {
  group: ServiceGroup;
  onEdit: () => void;
  onDelete: () => void;
}

export function ServiceGroupCard({
  group,
  onEdit,
  onDelete,
}: ServiceGroupCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Header with name and menu */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg truncate">
            {group.name}
          </h3>
          {group.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {group.description}
            </p>
          )}
        </div>

        {/* Actions Menu */}
        <div className="relative ml-2" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Edit group
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Category Badge */}
        {group.service_categories && (
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{
              backgroundColor: `${group.service_categories.color}20`,
              color: group.service_categories.color,
            }}
          >
            <Tag className="w-3 h-3" />
            {group.service_categories.name}
          </span>
        )}

        {/* Display Mode Badge */}
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            group.display_mode === 'modal'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          <Package className="w-3 h-3" />
          {group.display_mode === 'modal' ? 'Modal view' : 'List view'}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {/* Service Count */}
          <div className="flex items-center gap-1">
            <Package className="w-4 h-4" />
            <span>
              {group.service_count}{' '}
              {group.service_count === 1 ? 'service' : 'services'}
            </span>
          </div>

          {/* Min Price */}
          {group.min_price > 0 && (
            <div className="flex items-center gap-1 text-purple-600 font-medium">
              <span>from ${group.min_price.toFixed(0)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
