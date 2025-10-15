// components/admin/services/variant-list-modal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Trash2, Plus } from 'lucide-react';
import { getServiceVariants, deleteVariant } from '@/app/actions/services';

interface ParentService {
  id: string;
  name: string;
  description: string | null;
}

interface Variant {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface VariantListModalProps {
  parentService: ParentService;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // ✅ Added
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

export function VariantListModal({
  parentService,
  isOpen,
  onClose,
  onSuccess, // ✅ Added
}: VariantListModalProps) {
  const router = useRouter();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ✅ Define loadVariants BEFORE useEffect with useCallback
  const loadVariants = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getServiceVariants(parentService.id);
      setVariants(data);
    } catch (err) {
      console.error('Failed to load variants:', err);
      setError('Failed to load variants');
    } finally {
      setIsLoading(false);
    }
  }, [parentService.id]);

  // ✅ useEffect with proper dependencies
  useEffect(() => {
    if (isOpen) {
      loadVariants();
    }
  }, [isOpen, loadVariants]);

  const handleDelete = async (variantId: string) => {
    if (!confirm('Are you sure you want to delete this variant?')) {
      return;
    }

    try {
      setDeletingId(variantId);
      setError('');
      await deleteVariant(variantId);
      router.refresh();
      await loadVariants(); // Reload list

      // ✅ Call onSuccess to trigger loading state
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to delete variant:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete variant');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  const minPrice =
    variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;

  const maxPrice =
    variants.length > 0 ? Math.max(...variants.map((v) => v.price)) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold">{parentService.name}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {parentService.description || 'Manage service variants'}
            </p>
            {variants.length > 0 && (
              <p className="text-sm text-purple-600 mt-2">
                from A$ {minPrice.toFixed(0)}
                {minPrice !== maxPrice && ` - A$ ${maxPrice.toFixed(0)}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 mt-4">Loading variants...</p>
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No variants yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Add your first variant option to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">
                Select an option ({variants.length}{' '}
                {variants.length === 1 ? 'variant' : 'variants'})
              </h3>
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {variant.name}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDuration(variant.duration_minutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-gray-900">
                      A$ {variant.price.toFixed(0)}
                    </span>
                    <button
                      onClick={() => handleDelete(variant.id)}
                      disabled={deletingId === variant.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete variant"
                    >
                      {deletingId === variant.id ? (
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Close
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add another variant
          </button>
        </div>
      </div>
    </div>
  );
}
