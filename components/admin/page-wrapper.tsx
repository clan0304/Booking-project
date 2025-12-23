// components/admin/page-wrapper.tsx
interface PageWrapperProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Wrapper component for admin pages.
 * - Default: constrained width with padding (for most pages)
 * - fullWidth: no constraints (for calendar, etc.)
 */
export function PageWrapper({ children, fullWidth = false }: PageWrapperProps) {
  if (fullWidth) {
    return <div className="h-full">{children}</div>;
  }

  return <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>;
}
