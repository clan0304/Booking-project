// app/admin/products/page.tsx
import { getProducts, getCategories } from '@/app/actions/products';
import { supabaseAdmin } from '@/lib/supabase/server';
import ProductsContent from '@/components/admin/products/products-content';
import { PageWrapper } from '@/components/admin';

// ✅ Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductsPage() {
  // Fetch initial data
  const [productsResult, categoriesResult, venuesResult] = await Promise.all([
    getProducts(),
    getCategories(),
    supabaseAdmin.from('venues').select('id, name').order('name'),
  ]);

  const products = productsResult.data || [];
  const categories = categoriesResult.data || [];
  const venues = venuesResult.data || [];

  return (
    <PageWrapper>
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Products</h2>
            <p className="text-muted-foreground mt-1">
              Manage your products and categories across all venues
            </p>
          </div>
        </div>

        <ProductsContent
          initialProducts={products}
          initialCategories={categories}
          venues={venues}
        />
      </div>
    </PageWrapper>
  );
}
