// components/admin/products/products-tab.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Package,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import AddProductModal from './add-product-modal';
import EditProductModal from './edit-product-modal';
import DeleteProductDialog from './delete-product-dialog';
import type {
  ProductWithDetails,
  CategoryWithVenues,
} from '@/app/actions/products';
import Image from 'next/image';

type Venue = {
  id: string;
  name: string;
};

type ProductsTabProps = {
  initialProducts: ProductWithDetails[];
  categories: CategoryWithVenues[];
  venues: Venue[];
};

export default function ProductsTab({
  initialProducts,
  categories,
  venues,
}: ProductsTabProps) {
  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithDetails | null>(null);
  const [deletingProduct, setDeletingProduct] =
    useState<ProductWithDetails | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesVenue =
        selectedVenue === 'all' ||
        product.product_venues.some(
          (pv) => pv.venue_id === selectedVenue && pv.is_active
        );

      const matchesCategory =
        selectedCategory === 'all' || product.category_id === selectedCategory;

      return matchesSearch && matchesVenue && matchesCategory;
    });
  }, [products, searchQuery, selectedVenue, selectedCategory]);

  // Get total quantity across all venues
  const getTotalQuantity = (product: ProductWithDetails) => {
    return product.product_venues
      .filter((pv) => pv.is_active)
      .reduce((sum, pv) => sum + pv.quantity, 0);
  };

  // Get quantity for selected venue or total
  const getDisplayQuantity = (product: ProductWithDetails) => {
    if (selectedVenue === 'all') {
      return getTotalQuantity(product);
    }
    const venueProduct = product.product_venues.find(
      (pv) => pv.venue_id === selectedVenue && pv.is_active
    );
    return venueProduct?.quantity || 0;
  };

  // Get stock status based on quantity
  const getStockStatus = (quantity: number) => {
    if (quantity === 0)
      return { label: 'Out of Stock', color: 'destructive' as const };
    if (quantity < 10)
      return { label: 'Low Stock', color: 'secondary' as const };
    return { label: 'In Stock', color: 'default' as const };
  };

  // Get venue quantities tooltip content
  const getVenueQuantities = (product: ProductWithDetails) => {
    return product.product_venues
      .filter((pv) => pv.is_active)
      .map((pv) => {
        const venue = venues.find((v) => v.id === pv.venue_id);
        return `${venue?.name || 'Unknown'}: ${pv.quantity}`;
      })
      .join('\n');
  };

  const handleProductAdded = (newProduct: ProductWithDetails) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  const handleProductUpdated = (updatedProduct: ProductWithDetails) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  };

  const handleProductDeleted = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Calculate stats
  const totalProducts = filteredProducts.length;
  const inStockCount = filteredProducts.filter(
    (p) => getDisplayQuantity(p) > 0
  ).length;
  const lowStockCount = filteredProducts.filter((p) => {
    const qty = getDisplayQuantity(p);
    return qty > 0 && qty < 10;
  }).length;
  const outOfStockCount = filteredProducts.filter(
    (p) => getDisplayQuantity(p) === 0
  ).length;

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger
              className={`w-[52px] ${
                selectedVenue !== 'all' ? 'border-primary text-primary' : ''
              }`}
            >
              <MapPin className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Total Products
          </p>
          <p className="text-2xl font-bold">{totalProducts}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">In Stock</p>
          <p className="text-2xl font-bold text-green-600">{inStockCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Out of Stock
          </p>
          <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">
                {selectedVenue === 'all' ? 'Total Qty' : 'Qty'}
              </TableHead>
              <TableHead>Venues</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const quantity = getDisplayQuantity(product);
                const stockStatus = getStockStatus(quantity);
                const activeVenues = product.product_venues.filter(
                  (pv) => pv.is_active
                );

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          width={48}
                          height={48}
                          className="rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge
                          variant="outline"
                          style={{ borderColor: product.category.color }}
                        >
                          {product.category.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Uncategorized
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${product.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted">
                              {quantity}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="whitespace-pre-line text-xs">
                              {getVenueQuantities(product) ||
                                'No venues assigned'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {activeVenues.length > 0 ? (
                          activeVenues.length <= 2 ? (
                            activeVenues.map((pv) => {
                              const venue = venues.find(
                                (v) => v.id === pv.venue_id
                              );
                              return (
                                <Badge
                                  key={pv.venue_id}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {venue?.name || 'Unknown'}
                                </Badge>
                              );
                            })
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {activeVenues.length} venues
                            </Badge>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No venues
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stockStatus.color}>
                        {stockStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingProduct(product)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Product
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingProduct(product)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Product
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      <AddProductModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        venues={venues}
        categories={categories}
        onProductAdded={handleProductAdded}
      />

      {editingProduct && (
        <EditProductModal
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          product={editingProduct}
          venues={venues}
          categories={categories}
          onProductUpdated={handleProductUpdated}
        />
      )}

      {deletingProduct && (
        <DeleteProductDialog
          open={!!deletingProduct}
          onOpenChange={(open) => !open && setDeletingProduct(null)}
          product={deletingProduct}
          onProductDeleted={handleProductDeleted}
        />
      )}
    </div>
  );
}
