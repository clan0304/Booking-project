// components/admin/products/add-product-modal.tsx
'use client';

import { useState } from 'react';
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
import { createProduct, uploadProductImage } from '@/app/actions/products';
import type { Product, Category } from '@/app/actions/products';
import Image from 'next/image';

type Venue = {
  id: string;
  name: string;
};

type AddProductModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venues: Venue[];
  categories: Category[];
  onProductAdded: (product: Product) => void;
};

export default function AddProductModal({
  open,
  onOpenChange,
  venues,
  categories,
  onProductAdded,
}: AddProductModalProps) {
  const [venueId, setVenueId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

    if (!venueId || !name || !price || !quantity) {
      setError('Please fill in all required fields');
      return;
    }

    const priceNum = parseFloat(price);
    const quantityNum = parseInt(quantity);

    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price');
      return;
    }

    if (isNaN(quantityNum) || quantityNum < 0) {
      setError('Please enter a valid quantity');
      return;
    }

    setIsLoading(true);

    try {
      // Upload image if provided
      let imageUrl: string | undefined;
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        const uploadResult = await uploadProductImage(venueId, formData);
        if (uploadResult.error) {
          setError(uploadResult.error);
          setIsLoading(false);
          return;
        }
        imageUrl = uploadResult.url || undefined;
      }

      // Create product
      const result = await createProduct({
        venue_id: venueId,
        name,
        description: description || undefined,
        price: priceNum,
        quantity: quantityNum,
        category_id: categoryId || undefined,
        image_url: imageUrl,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        onProductAdded(result.data);
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
    setPrice('');
    setQuantity('');
    setCategoryId('');
    setImageFile(null);
    setImagePreview(null);
    setError('');
    onOpenChange(false);
  };

  // Filter categories by selected venue
  const filteredCategories = categories.filter(
    (cat) => cat.venue_id === venueId
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Add a new product to your inventory
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

          {/* Price and Quantity */}
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
              <Label htmlFor="quantity">
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={!venueId || filteredCategories.length === 0}
            >
              <SelectTrigger id="category">
                <SelectValue
                  placeholder={
                    !venueId
                      ? 'Select venue first'
                      : filteredCategories.length === 0
                      ? 'No categories available'
                      : 'Select category'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Product Image</Label>
            {imagePreview ? (
              <div className="relative w-full h-48">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                  fill
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WEBP up to 5MB
                </p>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mt-2"
                />
              </div>
            )}
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
              {isLoading ? 'Adding...' : 'Add Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
