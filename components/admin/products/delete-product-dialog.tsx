// components/admin/products/delete-product-dialog.tsx
'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteProduct, deleteProductImage } from '@/app/actions/products';
import type { ProductWithDetails } from '@/app/actions/products';

type DeleteProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithDetails;
  onProductDeleted: (productId: string) => void;
};

export default function DeleteProductDialog({
  open,
  onOpenChange,
  product,
  onProductDeleted,
}: DeleteProductDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Delete image from storage if exists
      if (product.image_url) {
        await deleteProductImage(product.image_url);
      }

      // Delete product from database (cascade handles venue assignments)
      const result = await deleteProduct(product.id);

      if (result.error) {
        setError(result.error);
      } else {
        onProductDeleted(product.id);
        onOpenChange(false);
      }
    } catch (err) {
      setError(`${err} An unexpected error occurred`);
    } finally {
      setIsLoading(false);
    }
  };

  const venueCount = product.product_venues.filter((pv) => pv.is_active).length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{product.name}</strong>
            {venueCount > 0 && (
              <>
                {' '}
                from {venueCount} venue{venueCount !== 1 ? 's' : ''}
              </>
            )}
            . This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Deleting...' : 'Delete Product'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
