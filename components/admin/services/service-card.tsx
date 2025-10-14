// components/admin/services/service-card.tsx
'use client';

import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';

interface Service {
  id: string;
  name: string;
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

interface ServiceCardProps {
  service: Service;
  onEdit: () => void;
  onAddVariant?: () => void;
  onViewVariants?: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

export function ServiceCard({
  service,
  onEdit,
  onAddVariant,
  onViewVariants,
}: ServiceCardProps) {
  const [showActions, setShowActions] = useState(false);

  const durationDisplay = formatDuration(service.duration_minutes);

  // Use display_price for variant groups (calculated from min variant)
  const effectivePrice =
    service.type === 'variant_group'
      ? service.display_price || 0
      : service.price || 0;

  const priceDisplay =
    service.price_type === 'from'
      ? `from A$ ${effectivePrice.toFixed(0)}`
      : `A$ ${effectivePrice.toFixed(0)}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4 p-4">
        {/* Color bar */}
        {service.category && (
          <div
            className="w-1 h-16 rounded-full flex-shrink-0"
            style={{ backgroundColor: service.category.color }}
          />
        )}

        {/* Service info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{service.name}</h4>
            {service.type === 'variant_group' && (
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                Has variants
              </span>
            )}
            {service.type === 'bundle' && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                Bundle
              </span>
            )}
          </div>
          {service.description && (
            <p className="text-sm text-gray-500 mb-2 line-clamp-2">
              {service.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{durationDisplay}</span>
          </div>
        </div>

        {/* Price & Actions */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="font-semibold text-gray-900">{priceDisplay}</span>

          {/* Actions */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-500" />
            </button>

            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                  <button
                    onClick={() => {
                      onEdit();
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Edit service
                  </button>

                  {service.type === 'variant_group' && (
                    <>
                      <button
                        onClick={() => {
                          onViewVariants?.();
                          setShowActions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        View variants
                      </button>
                      <button
                        onClick={() => {
                          onAddVariant?.();
                          setShowActions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add variant
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
