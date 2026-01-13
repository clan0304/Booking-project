// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { UserRole } from '@/types/database';

// ✅ DON'T import supabaseAdmin - create client inline for Edge Runtime
// import { supabaseAdmin } from '@/lib/supabase/server';  // ❌ REMOVE THIS

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
    try {
      // ✅ Create client inline - this is Edge Runtime safe
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: user, error } = await supabase
        .from('users')
        .select('roles, onboarding_completed')
        .eq('clerk_user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user in middleware:', error);
        // ✅ On error, allow request to continue instead of blocking
        return NextResponse.next();
      }

      if (!user) {
        console.warn(`User ${userId} not found in Supabase, allowing request`);
        // ✅ Allow request - webhook might still be processing
        return NextResponse.next();
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

      // Check onboarding status
      if (
        !isOnboardingRoute(req) &&
        !isAdminRoute(req) &&
        isProtectedRoute(req)
      ) {
        if (!user.onboarding_completed) {
          return NextResponse.redirect(new URL('/onboarding', req.url));
        }
      }
    } catch (error) {
      console.error('Middleware error:', error);
      // ✅ On any error, allow request to continue
      return NextResponse.next();
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
