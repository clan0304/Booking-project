// components/admin/products/categories-tab.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
import AddCategoryModal from './add-category-modal';
import EditCategoryModal from './edit-category-modal';
import DeleteCategoryDialog from './delete-category-dialog';
import type { CategoryWithVenues } from '@/app/actions/products';

type Venue = {
  id: string;
  name: string;
};

type CategoriesTabProps = {
  initialCategories: CategoryWithVenues[];
  venues: Venue[];
};

export default function CategoriesTab({
  initialCategories,
  venues,
}: CategoriesTabProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<string>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CategoryWithVenues | null>(null);
  const [deletingCategory, setDeletingCategory] =
    useState<CategoryWithVenues | null>(null);

  // Filter categories
  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      const matchesSearch = category.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesVenue =
        selectedVenue === 'all' ||
        category.category_venues.some(
          (cv) => cv.venue_id === selectedVenue && cv.is_active
        );

      return matchesSearch && matchesVenue;
    });
  }, [categories, searchQuery, selectedVenue]);

  // Get venue names for a category
  const getVenueNames = (category: CategoryWithVenues) => {
    const activeVenueIds = category.category_venues
      .filter((cv) => cv.is_active)
      .map((cv) => cv.venue_id);

    return venues
      .filter((v) => activeVenueIds.includes(v.id))
      .map((v) => v.name);
  };

  const handleCategoryAdded = (newCategory: CategoryWithVenues) => {
    setCategories((prev) => [newCategory, ...prev]);
  };

  const handleCategoryUpdated = (updatedCategory: CategoryWithVenues) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === updatedCategory.id ? updatedCategory : c))
    );
  };

  const handleCategoryDeleted = (categoryId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
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
        </div>

        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Total Categories
          </p>
          <p className="text-2xl font-bold">{filteredCategories.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Active Venues
          </p>
          <p className="text-2xl font-bold">{venues.length}</p>
        </div>
      </div>

      {/* Categories Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Color</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Venues</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No categories found.
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => {
                const venueNames = getVenueNames(category);
                return (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div
                        className="w-8 h-8 rounded-full border"
                        style={{ backgroundColor: category.color }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.description || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {venueNames.length > 0 ? (
                          venueNames.map((name) => (
                            <Badge
                              key={name}
                              variant="secondary"
                              className="text-xs"
                            >
                              {name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No venues assigned
                          </span>
                        )}
                      </div>
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
                            onClick={() => setEditingCategory(category)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Category
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingCategory(category)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Category
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
      <AddCategoryModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        venues={venues}
        onCategoryAdded={handleCategoryAdded}
      />

      {editingCategory && (
        <EditCategoryModal
          open={!!editingCategory}
          onOpenChange={(open) => !open && setEditingCategory(null)}
          category={editingCategory}
          venues={venues}
          onCategoryUpdated={handleCategoryUpdated}
        />
      )}

      {deletingCategory && (
        <DeleteCategoryDialog
          open={!!deletingCategory}
          onOpenChange={(open) => !open && setDeletingCategory(null)}
          category={deletingCategory}
          onCategoryDeleted={handleCategoryDeleted}
        />
      )}
    </div>
  );
}
