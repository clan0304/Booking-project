// components/admin/products/products-content.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductsTab from './products-tab';
import CategoriesTab from './categories-tab';
import type {
  ProductWithDetails,
  CategoryWithVenues,
} from '@/app/actions/products';

type Venue = {
  id: string;
  name: string;
};

type ProductsContentProps = {
  initialProducts: ProductWithDetails[];
  initialCategories: CategoryWithVenues[];
  venues: Venue[];
};

export default function ProductsContent({
  initialProducts,
  initialCategories,
  venues,
}: ProductsContentProps) {
  const [activeTab, setActiveTab] = useState('products');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
      </TabsList>

      <TabsContent value="products" className="space-y-4">
        <ProductsTab
          initialProducts={initialProducts}
          categories={initialCategories}
          venues={venues}
        />
      </TabsContent>

      <TabsContent value="categories" className="space-y-4">
        <CategoriesTab initialCategories={initialCategories} venues={venues} />
      </TabsContent>
    </Tabs>
  );
}
