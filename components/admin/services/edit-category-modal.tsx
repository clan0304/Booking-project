// components/admin/services/edit-category-modal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Trash2 } from 'lucide-react';
import { updateCategory, deleteCategory } from '@/app/actions/services';

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

interface EditCategoryModalProps {
  category: Category;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#10B981', // Green
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#A855F7', // Purple (light)
];

export function EditCategoryModal({
  category,
  isOpen,
  onClose,
}: EditCategoryModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [selectedColor, setSelectedColor] = useState(category.color);
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!name.trim()) {
      setError('Category name is required');
      setIsSubmitting(false);
      return;
    }

    try {
      await updateCategory(category.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
      });

      router.refresh();
      onClose();
    } catch (err) {
      console.error('Failed to update category:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to update category'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setIsDeleting(true);

    try {
      await deleteCategory(category.id);
      router.refresh();
      onClose();
    } catch (err) {
      console.error('Failed to delete category:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to delete category'
      );
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isDeleting) {
      setShowDeleteConfirm(false);
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold">Edit category</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting || isDeleting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Category name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Category name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hair Services"
                maxLength={100}
                required
                disabled={isSubmitting || isDeleting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {name.length}/100
              </div>
            </div>

            {/* Appointment color */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Appointment color
              </label>
              <div className="grid grid-cols-6 gap-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    disabled={isSubmitting || isDeleting}
                    className={`w-full aspect-square rounded-lg transition-all ${
                      selectedColor === color
                        ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Selected color: {selectedColor}
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Description <span className="text-gray-500">(Optional)</span>
              </label>
              <div className="relative">
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={255}
                  placeholder="Add a brief description"
                  disabled={isSubmitting || isDeleting}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
                />
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {description.length}/255
                </div>
              </div>
            </div>

            {/* Delete button */}
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || isDeleting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete category</span>
              </button>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-3">
                  Are you sure? This will remove the category from all services.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting || isDeleting}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isDeleting}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
