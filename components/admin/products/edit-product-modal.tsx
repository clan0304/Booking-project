// components/admin/products/edit-product-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  updateProduct,
  uploadProductImage,
  deleteProductImage,
  getProductById,
} from '@/app/actions/products';
import type {
  ProductWithDetails,
  CategoryWithVenues,
} from '@/app/actions/products';
import Image from 'next/image';

type Venue = {
  id: string;
  name: string;
};

type VenueQuantity = {
  is_active: boolean;
  quantity: number;
};

type EditProductModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithDetails;
  venues: Venue[];
  categories: CategoryWithVenues[];
  onProductUpdated: (product: ProductWithDetails) => void;
};

export default function EditProductModal({
  open,
  onOpenChange,
  product,
  venues,
  categories,
  onProductUpdated,
}: EditProductModalProps) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState(product.price.toString());
  const [categoryId, setCategoryId] = useState(product.category_id || '');
  const [venueQuantities, setVenueQuantities] = useState<
    Record<string, VenueQuantity>
  >({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    product.image_url
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync state when modal opens or product changes
  useEffect(() => {
    if (open) {
      setName(product.name);
      setDescription(product.description || '');
      setPrice(product.price.toString());
      setCategoryId(product.category_id || '');
      setImagePreview(product.image_url);
      setImageFile(null);
      setError('');

      // Initialize venue quantities from product_venues
      const vq: Record<string, VenueQuantity> = {};
      product.product_venues.forEach((pv) => {
        vq[pv.venue_id] = {
          is_active: pv.is_active,
          quantity: pv.quantity,
        };
      });
      setVenueQuantities(vq);
    }
  }, [open, product]);

  const handleVenueToggle = (venueId: string, checked: boolean) => {
    setVenueQuantities((prev) => ({
      ...prev,
      [venueId]: {
        is_active: checked,
        quantity: prev[venueId]?.quantity || 0,
      },
    }));
  };

  const handleQuantityChange = (venueId: string, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    setVenueQuantities((prev) => ({
      ...prev,
      [venueId]: {
        is_active: prev[venueId]?.is_active || false,
        quantity: qty < 0 ? 0 : qty,
      },
    }));
  };

  const handleSelectAllVenues = () => {
    const allSelected = venues.every((v) => venueQuantities[v.id]?.is_active);
    const newQuantities: Record<string, VenueQuantity> = {};
    venues.forEach((v) => {
      newQuantities[v.id] = {
        is_active: !allSelected,
        quantity: venueQuantities[v.id]?.quantity || 0,
      };
    });
    setVenueQuantities(newQuantities);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !price) {
      setError('Please fill in all required fields');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price');
      return;
    }

    const venueAssignments = Object.entries(venueQuantities)
      .filter(([, vq]) => vq.is_active)
      .map(([venueId, vq]) => ({
        venue_id: venueId,
        is_active: true,
        quantity: vq.quantity,
      }));

    if (venueAssignments.length === 0) {
      setError('Please select at least one venue');
      return;
    }

    setIsLoading(true);

    try {
      let imageUrl: string | undefined | null = product.image_url;

      // Handle image changes
      if (imageFile) {
        // Delete old image if exists
        if (product.image_url) {
          await deleteProductImage(product.image_url);
        }

        // Upload new image
        const formData = new FormData();
        formData.append('file', imageFile);

        const uploadResult = await uploadProductImage(formData);
        if (uploadResult.error) {
          setError(uploadResult.error);
          setIsLoading(false);
          return;
        }
        imageUrl = uploadResult.url;
      } else if (!imagePreview && product.image_url) {
        // Image was removed
        await deleteProductImage(product.image_url);
        imageUrl = null;
      }

      // Update product
      const result = await updateProduct(product.id, {
        name,
        description: description || undefined,
        price: priceNum,
        category_id: categoryId || null,
        image_url: imageUrl,
        venue_assignments: venueAssignments,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        // Fetch the full product with details
        const fullProduct = await getProductById(result.data.id);
        if (fullProduct.data) {
          onProductUpdated(fullProduct.data);
        }
        onOpenChange(false);
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = Object.values(venueQuantities).filter(
    (vq) => vq.is_active
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update product information and venue stock quantities
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter product name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter product description"
              rows={3}
            />
          </div>

          {/* Price and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">
                Price ($) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={categoryId || 'none'}
                onValueChange={(value) =>
                  setCategoryId(value === 'none' ? '' : value)
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Venue Selection with Quantities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Venues & Stock <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAllVenues}
                className="h-auto py-1 px-2 text-xs"
              >
                {venues.every((v) => venueQuantities[v.id]?.is_active)
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            <div className="border rounded-lg p-3 space-y-3 max-h-48 overflow-y-auto">
              {venues.map((venue) => {
                const vq = venueQuantities[venue.id] || {
                  is_active: false,
                  quantity: 0,
                };
                return (
                  <div
                    key={venue.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center space-x-2 flex-1">
                      <Checkbox
                        id={`edit-venue-${venue.id}`}
                        checked={vq.is_active}
                        onCheckedChange={(checked) =>
                          handleVenueToggle(venue.id, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`edit-venue-${venue.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {venue.name}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Qty:
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={vq.quantity}
                        onChange={(e) =>
                          handleQuantityChange(venue.id, e.target.value)
                        }
                        disabled={!vq.is_active}
                        className="w-20 h-8 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedCount} venue{selectedCount !== 1 ? 's' : ''} selected
            </p>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Product Image</Label>
            {imagePreview ? (
              <div className="relative w-32 h-32">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-2">
                  Upload Image
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-muted-foreground">Max 5MB</p>
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
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
