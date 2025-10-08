// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { UserRole } from '@/types/database';

// Define protected routes
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isOnboardingRoute = createRouteMatcher(['/onboarding']);
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/profile(.*)',
  '/bookings(.*)',
  '/admin(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // If user is not signed in and trying to access protected route
  if (!userId && isProtectedRoute(req)) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // If user is signed in
  if (userId) {
    // Get user roles from JWT claims
    const roles =
      (sessionClaims?.metadata as { roles?: UserRole[] })?.roles || [];

    // Check if user is trying to access admin route
    if (isAdminRoute(req)) {
      const isAuthorized =
        roles.includes('admin') || roles.includes('team_member');

      if (!isAuthorized) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    // Check onboarding status (skip for onboarding route itself and admin routes)
    if (!isOnboardingRoute(req) && !isAdminRoute(req)) {
      // Note: We can't check onboarding_completed here without a DB call
      // So we'll redirect from the dashboard if needed
      // Or you can add onboarding_completed to JWT claims
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
