// components/admin/products/products-tab.tsx
'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, MoreVertical, Pencil, Trash2 } from 'lucide-react';
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
import AddProductModal from './add-product-modal';
import EditProductModal from './edit-product-modal';
import DeleteProductDialog from './delete-product-dialog';
import type { Product, Category } from '@/app/actions/products';
import Image from 'next/image';

type Venue = {
  id: string;
  name: string;
};

type ProductWithCategory = Product & {
  category: Category | null;
};

type ProductsTabProps = {
  initialProducts: ProductWithCategory[];
  categories: Category[];
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
    useState<ProductWithCategory | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesVenue =
        selectedVenue === 'all' || product.venue_id === selectedVenue;

      const matchesCategory =
        selectedCategory === 'all' || product.category_id === selectedCategory;

      return matchesSearch && matchesVenue && matchesCategory;
    });
  }, [products, searchQuery, selectedVenue, selectedCategory]);

  // Get stock status
  const getStockStatus = (quantity: number) => {
    if (quantity === 0)
      return { label: 'Out of Stock', color: 'destructive' as const };
    if (quantity < 10)
      return { label: 'Low Stock', color: 'secondary' as const };
    return { label: 'In Stock', color: 'default' as const };
  };

  const handleProductAdded = (newProduct: Product) => {
    setProducts((prev) => [{ ...newProduct, category: null }, ...prev]);
  };

  const handleProductUpdated = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === updatedProduct.id
          ? { ...updatedProduct, category: p.category }
          : p
      )
    );
  };

  const handleProductDeleted = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Venues" />
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
          <p className="text-2xl font-bold">{filteredProducts.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">In Stock</p>
          <p className="text-2xl font-bold">
            {filteredProducts.filter((p) => p.quantity > 0).length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
          <p className="text-2xl font-bold">
            {
              filteredProducts.filter((p) => p.quantity > 0 && p.quantity < 10)
                .length
            }
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Out of Stock
          </p>
          <p className="text-2xl font-bold">
            {filteredProducts.filter((p) => p.quantity === 0).length}
          </p>
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
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product.quantity);
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          className="h-12 w-12 rounded object-cover"
                          width={12}
                          height={12}
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            No image
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
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
                    <TableCell className="font-medium">
                      ${product.price.toFixed(2)}
                    </TableCell>
                    <TableCell>{product.quantity}</TableCell>
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
