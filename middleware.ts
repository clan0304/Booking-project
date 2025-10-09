// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
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
  const { userId } = await auth();

  // If user is not signed in and trying to access protected route
  if (!userId && isProtectedRoute(req)) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // If user is signed in and trying to access protected routes
  if (userId && isProtectedRoute(req)) {
    // Fetch user roles from Supabase (single source of truth)
    // Use maybeSingle() instead of single() to handle missing users gracefully
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('roles, onboarding_completed')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user in middleware:', error);
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }

    // If user not found in database, they might be a new user
    // Redirect to sign-in which will trigger the webhook
    if (!user) {
      console.warn(
        `User ${userId} not found in Supabase, redirecting to sign-in`
      );
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    const roles: UserRole[] = user.roles || ['client'];

    // Check if user is trying to access admin route
    if (isAdminRoute(req)) {
      const isAuthorized =
        roles.includes('admin') || roles.includes('team_member');

      if (!isAuthorized) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    // Check onboarding status (skip for onboarding route itself and admin routes)
    if (
      !isOnboardingRoute(req) &&
      !isAdminRoute(req) &&
      isProtectedRoute(req)
    ) {
      if (!user.onboarding_completed) {
        return NextResponse.redirect(new URL('/onboarding', req.url));
      }
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
