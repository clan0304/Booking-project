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
import {
  updateProduct,
  uploadProductImage,
  deleteProductImage,
} from '@/app/actions/products';
import type { Product, Category } from '@/app/actions/products';
import Image from 'next/image';

type Venue = {
  id: string;
  name: string;
};

type ProductWithCategory = Product & {
  category: Category | null;
};

type EditProductModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithCategory;
  venues: Venue[];
  categories: Category[];
  onProductUpdated: (product: Product) => void;
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
  const [quantity, setQuantity] = useState(product.quantity.toString());
  const [categoryId, setCategoryId] = useState(product.category_id || '');
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
      setQuantity(product.quantity.toString());
      setCategoryId(product.category_id || '');
      setImagePreview(product.image_url);
      setImageFile(null);
      setError('');
    }
  }, [open, product]);

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

  const handleRemoveImage = async () => {
    if (product.image_url && !imageFile) {
      // Delete existing image from storage
      await deleteProductImage(product.image_url);
    }
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !price || !quantity) {
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
      let imageUrl: string | undefined = product.image_url || undefined;

      // Upload new image if provided
      if (imageFile) {
        // Delete old image first
        if (product.image_url) {
          await deleteProductImage(product.image_url);
        }

        const formData = new FormData();
        formData.append('file', imageFile);

        const uploadResult = await uploadProductImage(
          product.venue_id,
          formData
        );
        if (uploadResult.error) {
          setError(uploadResult.error);
          setIsLoading(false);
          return;
        }
        imageUrl = uploadResult.url || undefined;
      } else if (!imagePreview && product.image_url) {
        // Image was removed
        imageUrl = undefined;
      }

      // Update product
      const result = await updateProduct(product.id, {
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
        onProductUpdated(result.data);
        onOpenChange(false);
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter categories by product's venue
  const filteredCategories = categories.filter(
    (cat) => cat.venue_id === product.venue_id
  );

  const venue = venues.find((v) => v.id === product.venue_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update product information for {venue?.name}
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
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
