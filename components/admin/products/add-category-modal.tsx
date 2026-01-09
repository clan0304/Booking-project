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
import { Checkbox } from '@/components/ui/checkbox';
import { createCategory, getCategoryById } from '@/app/actions/products';
import type { CategoryWithVenues } from '@/app/actions/products';

type Venue = {
  id: string;
  name: string;
};

type AddCategoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: Venue[];
  onCategoryAdded: (category: CategoryWithVenues) => void;
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [selectedVenues, setSelectedVenues] = useState<Record<string, boolean>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVenueToggle = (venueId: string, checked: boolean) => {
    setSelectedVenues((prev) => ({
      ...prev,
      [venueId]: checked,
    }));
  };

  const handleSelectAllVenues = () => {
    const allSelected = venues.every((v) => selectedVenues[v.id]);
    const newSelection: Record<string, boolean> = {};
    venues.forEach((v) => {
      newSelection[v.id] = !allSelected;
    });
    setSelectedVenues(newSelection);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !selectedColor) {
      setError('Please fill in all required fields');
      return;
    }

    const venueAssignments = Object.entries(selectedVenues)
      .filter(([, isSelected]) => isSelected)
      .map(([venueId]) => ({
        venue_id: venueId,
        is_active: true,
      }));

    if (venueAssignments.length === 0) {
      setError('Please select at least one venue');
      return;
    }

    setIsLoading(true);

    try {
      const result = await createCategory({
        name,
        description: description || undefined,
        color: selectedColor,
        venue_assignments: venueAssignments,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        // Fetch the full category with venue assignments
        const fullCategory = await getCategoryById(result.data.id);
        if (fullCategory.data) {
          onCategoryAdded(fullCategory.data);
        }
        handleClose();
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setSelectedColor(COLORS[0].value);
    setSelectedVenues({});
    setError('');
    onOpenChange(false);
  };

  const selectedCount = Object.values(selectedVenues).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Category</DialogTitle>
          <DialogDescription>
            Create a new product category and assign it to venues
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
              placeholder="Enter category name"
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
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === color.value
                      ? 'border-black scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Venue Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Available at Venues <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAllVenues}
                className="h-auto py-1 px-2 text-xs"
              >
                {venues.every((v) => selectedVenues[v.id])
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
              {venues.map((venue) => (
                <div key={venue.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`venue-${venue.id}`}
                    checked={selectedVenues[venue.id] || false}
                    onCheckedChange={(checked) =>
                      handleVenueToggle(venue.id, checked as boolean)
                    }
                  />
                  <label
                    htmlFor={`venue-${venue.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {venue.name}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedCount} venue{selectedCount !== 1 ? 's' : ''} selected
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
              {isLoading ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
