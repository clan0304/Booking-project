// components/admin/products/add-category-modal.tsx
'use client';

import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createCategory } from '@/app/actions/products';
import type { Category } from '@/app/actions/products';

type Venue = {
  id: string;
  name: string;
};

type AddCategoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: Venue[];
  onCategoryAdded: (category: Category) => void;
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

export default function AddCategoryModal({
  open,
  onOpenChange,
  venues,
  onCategoryAdded,
}: AddCategoryModalProps) {
  const [venueId, setVenueId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!venueId || !name || !selectedColor) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createCategory({
        venue_id: venueId,
        name,
        description: description || undefined,
        color: selectedColor,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        onCategoryAdded(result.data);
        handleClose();
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setVenueId('');
    setName('');
    setDescription('');
    setSelectedColor(COLORS[0].value);
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Category</DialogTitle>
          <DialogDescription>
            Create a category to organize your products
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Venue Selection */}
          <div className="space-y-2">
            <Label htmlFor="venue">
              Venue <span className="text-destructive">*</span>
            </Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger id="venue">
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
