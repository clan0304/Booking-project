// components/admin/products/edit-category-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateCategory } from '@/app/actions/products';
import type { Category } from '@/app/actions/products';

type Venue = {
  id: string;
  name: string;
};

type EditCategoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
  venues: Venue[];
  onCategoryUpdated: (category: Category) => void;
};

// Predefined color palette
const COLORS = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Gray', value: '#6B7280' },
];

export default function EditCategoryModal({
  open,
  onOpenChange,
  category,
  venues,
  onCategoryUpdated,
}: EditCategoryModalProps) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || '');
  const [selectedColor, setSelectedColor] = useState(category.color);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync state when modal opens or category changes
  useEffect(() => {
    if (open) {
      setName(category.name);
      setDescription(category.description || '');
      setSelectedColor(category.color);
      setError('');
    }
  }, [open, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !selectedColor) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const result = await updateCategory(category.id, {
        name,
        description: description || undefined,
        color: selectedColor,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        onCategoryUpdated(result.data);
        onOpenChange(false);
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsLoading(false);
    }
  };

  const venue = venues.find((v) => v.id === category.venue_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update category information for {venue?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Category Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Hair Care, Nail Polish"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter category description"
              rows={2}
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>
              Color <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`h-12 rounded-lg border-2 transition-all ${
                    selectedColor === color.value
                      ? 'border-primary scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected color will be used for category badges
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
