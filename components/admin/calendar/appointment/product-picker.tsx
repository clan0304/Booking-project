// components/admin/calendar/appointment/product-picker.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search, Package, Plus, Minus } from 'lucide-react';
import { getProducts } from '@/app/actions/products';
import type { ProductWithDetails } from '@/app/actions/products';
import Image from 'next/image';

export interface SelectedProduct {
  id: string; // Unique instance ID
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  maxQuantity: number; // Available stock at venue
  imageUrl: string | null;
}

interface ProductPickerProps {
  venueId: string;
  onSelectProduct: (product: SelectedProduct) => void;
  onClose: () => void;
  existingProducts?: SelectedProduct[]; // Already added products (to check stock)
}

export function ProductPicker({
  venueId,
  onSelectProduct,
  onClose,
  existingProducts = [],
}: ProductPickerProps) {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      const result = await getProducts(venueId);
      if (result.data) {
        setProducts(result.data);
      }
      setIsLoading(false);
    };
    loadProducts();
  }, [venueId]);

  // Get available quantity for a product at this venue
  const getAvailableQuantity = useCallback(
    (product: ProductWithDetails): number => {
      const venueProduct = product.product_venues.find(
        (pv) => pv.venue_id === venueId && pv.is_active
      );
      if (!venueProduct) return 0;

      // Subtract already added quantities
      const alreadyAdded = existingProducts
        .filter((p) => p.productId === product.id)
        .reduce((sum, p) => sum + p.quantity, 0);

      return Math.max(0, venueProduct.quantity - alreadyAdded);
    },
    [venueId, existingProducts]
  );

  // Filter products by search and only show those with stock
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const hasStock = getAvailableQuantity(product) > 0;
      return matchesSearch && hasStock;
    });
  }, [products, searchQuery, getAvailableQuantity]);

  // Group products by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, ProductWithDetails[]> = {};

    filteredProducts.forEach((product) => {
      const categoryName = product.category?.name || 'Uncategorized';
      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }
      grouped[categoryName].push(product);
    });

    return grouped;
  }, [filteredProducts]);

  const handleSelectProduct = (product: ProductWithDetails) => {
    const availableQty = getAvailableQuantity(product);
    if (availableQty <= 0) return;

    const selectedProduct: SelectedProduct = {
      id: `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: 1,
      maxQuantity: availableQty,
      imageUrl: product.image_url,
    };

    onSelectProduct(selectedProduct);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-end">
      <div className="w-full max-w-md h-full bg-white shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">Add Product</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          </div>
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Package className="w-8 h-8 mb-2" />
              <p className="text-sm">No products available</p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {Object.entries(productsByCategory).map(
                ([categoryName, categoryProducts]) => (
                  <div key={categoryName}>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {categoryName}
                    </h4>
                    <div className="space-y-2">
                      {categoryProducts.map((product) => {
                        const availableQty = getAvailableQuantity(product);
                        return (
                          <button
                            key={product.id}
                            onClick={() => handleSelectProduct(product)}
                            className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
                          >
                            {/* Product Image */}
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            )}

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {product.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {availableQty} in stock
                              </p>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                A${product.price.toFixed(2)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline product quantity editor component
interface ProductQuantityEditorProps {
  product: SelectedProduct;
  onUpdateQuantity?: (productId: string, quantity: number) => void;
  onRemove?: (productId: string) => void;
}

export function ProductQuantityEditor({
  product,
  onUpdateQuantity,
  onRemove,
}: ProductQuantityEditorProps) {
  const isReadOnly = !onUpdateQuantity || !onRemove;

  const handleDecrease = () => {
    if (!onUpdateQuantity || !onRemove) return;
    if (product.quantity <= 1) {
      onRemove(product.id);
    } else {
      onUpdateQuantity(product.id, product.quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (!onUpdateQuantity) return;
    if (product.quantity < product.maxQuantity) {
      onUpdateQuantity(product.id, product.quantity + 1);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      {/* Product Image */}
      {product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt={product.productName}
          width={40}
          height={40}
          className="rounded-lg object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
          <Package className="w-5 h-5 text-gray-400" />
        </div>
      )}

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">
          {product.productName}
        </p>
        <p className="text-xs text-gray-500">
          A${product.unitPrice.toFixed(2)} each
        </p>
      </div>

      {/* Quantity Controls - show buttons or just quantity based on mode */}
      {isReadOnly ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Qty: {product.quantity}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrease}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center font-medium">
            {product.quantity}
          </span>
          <button
            onClick={handleIncrease}
            disabled={product.quantity >= product.maxQuantity}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Total Price */}
      <div className="text-right min-w-[60px]">
        <p className="font-semibold text-gray-900">
          A${(product.unitPrice * product.quantity).toFixed(2)}
        </p>
      </div>
    </div>
  );
}
