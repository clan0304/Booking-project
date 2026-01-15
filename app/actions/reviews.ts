'use server';

import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAuth, requireStaff } from '@/lib/auth';

// =====================================================
// TYPES
// =====================================================

export interface Review {
  id: string;
  booking_group_id: string;
  client_id: string;
  venue_id: string;
  team_member_id: string;
  rating: number;
  review_text: string | null;
  status: 'published' | 'hidden';
  created_at: string;
  updated_at: string;
}

export interface ReviewWithDetails extends Review {
  team_member: {
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  } | null;
  venue: {
    name: string;
  } | null;
  booking_group: {
    booking_date: string;
  } | null;
  services: string[]; // Services performed by this team member
}

export interface ReviewWithClient extends Review {
  client: {
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  } | null;
  team_member: {
    first_name: string;
    last_name: string | null;
  } | null;
  booking_group: {
    booking_date: string;
  } | null;
}

export interface BookingStylistForReview {
  team_member_id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  services: string[];
  existing_review: Review | null;
}

// =====================================================
// CLIENT ACTIONS
// =====================================================

/**
 * Get stylists available for review from a completed booking
 * Returns unique stylists with their services and existing review (if any)
 */
export async function getBookingStylistsForReview(
  bookingGroupId: string
): Promise<{
  success: boolean;
  data?: BookingStylistForReview[];
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Verify booking belongs to this client and is completed
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .select('id, client_id, status')
      .eq('id', bookingGroupId)
      .single();

    if (bookingError || !booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.client_id !== user.supabaseUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (booking.status !== 'completed') {
      return {
        success: false,
        error: 'Reviews can only be left for completed bookings',
      };
    }

    // Get all appointments with team member details
    const { data: appointments, error: aptError } = await supabaseAdmin
      .from('appointments')
      .select(
        `
        team_member_id,
        service_name,
        team_member:users!appointments_team_member_id_fkey (
          first_name,
          last_name,
          photo_url
        )
      `
      )
      .eq('booking_group_id', bookingGroupId);

    if (aptError) {
      console.error('Error fetching appointments:', aptError);
      return { success: false, error: 'Failed to fetch booking details' };
    }

    // Get existing reviews for this booking
    const { data: existingReviews, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('booking_group_id', bookingGroupId)
      .eq('client_id', user.supabaseUserId);

    if (reviewError) {
      console.error('Error fetching existing reviews:', reviewError);
    }

    // Group by team member
    const stylistMap = new Map<string, BookingStylistForReview>();

    appointments?.forEach((apt) => {
      const teamMemberId = apt.team_member_id;
      // Supabase join can return array or single object - handle both
      const teamMemberRaw = apt.team_member;
      const teamMember = Array.isArray(teamMemberRaw)
        ? (teamMemberRaw[0] as
            | {
                first_name: string;
                last_name: string | null;
                photo_url: string | null;
              }
            | undefined)
        : (teamMemberRaw as {
            first_name: string;
            last_name: string | null;
            photo_url: string | null;
          } | null);

      if (!stylistMap.has(teamMemberId)) {
        const existingReview =
          existingReviews?.find((r) => r.team_member_id === teamMemberId) ||
          null;

        stylistMap.set(teamMemberId, {
          team_member_id: teamMemberId,
          first_name: teamMember?.first_name || 'Unknown',
          last_name: teamMember?.last_name || null,
          photo_url: teamMember?.photo_url || null,
          services: [apt.service_name],
          existing_review: existingReview,
        });
      } else {
        // Add service to existing stylist
        const stylist = stylistMap.get(teamMemberId)!;
        if (!stylist.services.includes(apt.service_name)) {
          stylist.services.push(apt.service_name);
        }
      }
    });

    return { success: true, data: Array.from(stylistMap.values()) };
  } catch (error) {
    console.error('Error in getBookingStylistsForReview:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Create a new review
 * Client can only review completed bookings they own
 */
export async function createReview(
  bookingGroupId: string,
  teamMemberId: string,
  rating: number,
  reviewText?: string
): Promise<{ success: boolean; reviewId?: string; error?: string }> {
  try {
    const user = await requireAuth();

    // Validate rating
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }

    // Verify booking belongs to this client and is completed
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('booking_groups')
      .select('id, client_id, venue_id, status')
      .eq('id', bookingGroupId)
      .single();

    if (bookingError || !booking) {
      return { success: false, error: 'Booking not found' };
    }

    if (booking.client_id !== user.supabaseUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    if (booking.status !== 'completed') {
      return {
        success: false,
        error: 'Reviews can only be left for completed bookings',
      };
    }

    // Verify team member was part of this booking
    const { data: appointment, error: aptError } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('booking_group_id', bookingGroupId)
      .eq('team_member_id', teamMemberId)
      .limit(1)
      .single();

    if (aptError || !appointment) {
      return {
        success: false,
        error: 'This stylist was not part of your booking',
      };
    }

    // Create the review
    const { data: review, error: createError } = await supabaseAdmin
      .from('reviews')
      .insert({
        booking_group_id: bookingGroupId,
        client_id: user.supabaseUserId,
        venue_id: booking.venue_id,
        team_member_id: teamMemberId,
        rating,
        review_text: reviewText?.trim() || null,
      })
      .select('id')
      .single();

    if (createError) {
      // Check for unique constraint violation
      if (createError.code === '23505') {
        return {
          success: false,
          error: 'You have already reviewed this stylist for this booking',
        };
      }
      console.error('Error creating review:', createError);
      return { success: false, error: 'Failed to create review' };
    }

    return { success: true, reviewId: review?.id };
  } catch (error) {
    console.error('Error in createReview:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update an existing review
 * Client can only edit their own reviews
 */
export async function updateReview(
  reviewId: string,
  rating: number,
  reviewText?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Validate rating
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5' };
    }

    // Verify review belongs to this client
    const { data: existingReview, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('id, client_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existingReview) {
      return { success: false, error: 'Review not found' };
    }

    if (existingReview.client_id !== user.supabaseUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Update the review
    const { error: updateError } = await supabaseAdmin
      .from('reviews')
      .update({
        rating,
        review_text: reviewText?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Error updating review:', updateError);
      return { success: false, error: 'Failed to update review' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateReview:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete a review
 * Client can only delete their own reviews
 */
export async function deleteReview(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Verify review belongs to this client
    const { data: existingReview, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('id, client_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existingReview) {
      return { success: false, error: 'Review not found' };
    }

    if (existingReview.client_id !== user.supabaseUserId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Delete the review
    const { error: deleteError } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (deleteError) {
      console.error('Error deleting review:', deleteError);
      return { success: false, error: 'Failed to delete review' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get all reviews by the current client
 * For client dashboard
 */
export async function getClientReviews(): Promise<{
  success: boolean;
  data?: ReviewWithDetails[];
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select(
        `
        *,
        team_member:users!reviews_team_member_id_fkey (
          first_name,
          last_name,
          photo_url
        ),
        venue:venues!reviews_venue_id_fkey (
          name
        ),
        booking_group:booking_groups!reviews_booking_group_id_fkey (
          booking_date
        )
      `
      )
      .eq('client_id', user.supabaseUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching client reviews:', error);
      return { success: false, error: 'Failed to fetch reviews' };
    }

    // Get services for each review
    const reviewsWithServices: ReviewWithDetails[] = await Promise.all(
      (reviews || []).map(async (review) => {
        const { data: appointments } = await supabaseAdmin
          .from('appointments')
          .select('service_name')
          .eq('booking_group_id', review.booking_group_id)
          .eq('team_member_id', review.team_member_id);

        return {
          ...review,
          services: appointments?.map((a) => a.service_name) || [],
        } as ReviewWithDetails;
      })
    );

    return { success: true, data: reviewsWithServices };
  } catch (error) {
    console.error('Error in getClientReviews:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// =====================================================
// ADMIN ACTIONS
// =====================================================

/**
 * Get all reviews for admin
 * Can filter by venue, team member, status
 */
export async function getAdminReviews(options?: {
  venueId?: string;
  teamMemberId?: string;
  status?: 'published' | 'hidden' | 'all';
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  data?: ReviewWithClient[];
  total?: number;
  error?: string;
}> {
  try {
    await requireStaff();

    let query = supabaseAdmin.from('reviews').select(
      `
        *,
        client:users!reviews_client_id_fkey (
          first_name,
          last_name,
          photo_url
        ),
        team_member:users!reviews_team_member_id_fkey (
          first_name,
          last_name
        ),
        booking_group:booking_groups!reviews_booking_group_id_fkey (
          booking_date
        )
      `,
      { count: 'exact' }
    );

    // Apply filters
    if (options?.venueId) {
      query = query.eq('venue_id', options.venueId);
    }

    if (options?.teamMemberId) {
      query = query.eq('team_member_id', options.teamMemberId);
    }

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    // Apply pagination
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1
      );
    }

    // Order by date
    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching admin reviews:', error);
      return { success: false, error: 'Failed to fetch reviews' };
    }

    return {
      success: true,
      data: data as ReviewWithClient[],
      total: count || 0,
    };
  } catch (error) {
    console.error('Error in getAdminReviews:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get reviews for a specific client (admin view in client profile)
 */
export async function getClientReviewsAdmin(
  clientId: string
): Promise<{ success: boolean; data?: ReviewWithDetails[]; error?: string }> {
  try {
    await requireStaff();

    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select(
        `
        *,
        team_member:users!reviews_team_member_id_fkey (
          first_name,
          last_name,
          photo_url
        ),
        venue:venues!reviews_venue_id_fkey (
          name
        ),
        booking_group:booking_groups!reviews_booking_group_id_fkey (
          booking_date
        )
      `
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching client reviews:', error);
      return { success: false, error: 'Failed to fetch reviews' };
    }

    // Get services for each review
    const reviewsWithServices: ReviewWithDetails[] = await Promise.all(
      (reviews || []).map(async (review) => {
        const { data: appointments } = await supabaseAdmin
          .from('appointments')
          .select('service_name')
          .eq('booking_group_id', review.booking_group_id)
          .eq('team_member_id', review.team_member_id);

        return {
          ...review,
          services: appointments?.map((a) => a.service_name) || [],
        } as ReviewWithDetails;
      })
    );

    return { success: true, data: reviewsWithServices };
  } catch (error) {
    console.error('Error in getClientReviewsAdmin:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Hide a review (admin only)
 */
export async function hideReview(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireStaff();

    const { error } = await supabaseAdmin
      .from('reviews')
      .update({
        status: 'hidden',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (error) {
      console.error('Error hiding review:', error);
      return { success: false, error: 'Failed to hide review' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in hideReview:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Unhide a review (admin only)
 */
export async function unhideReview(
  reviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireStaff();

    const { error } = await supabaseAdmin
      .from('reviews')
      .update({
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (error) {
      console.error('Error unhiding review:', error);
      return { success: false, error: 'Failed to unhide review' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in unhideReview:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get review statistics for a team member
 */
export async function getTeamMemberReviewStats(teamMemberId: string): Promise<{
  success: boolean;
  data?: {
    averageRating: number;
    totalReviews: number;
    ratingBreakdown: { rating: number; count: number }[];
  };
  error?: string;
}> {
  try {
    await requireStaff();

    // Get all published reviews for this team member
    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('team_member_id', teamMemberId)
      .eq('status', 'published');

    if (error) {
      console.error('Error fetching review stats:', error);
      return { success: false, error: 'Failed to fetch review stats' };
    }

    if (!reviews || reviews.length === 0) {
      return {
        success: true,
        data: {
          averageRating: 0,
          totalReviews: 0,
          ratingBreakdown: [
            { rating: 5, count: 0 },
            { rating: 4, count: 0 },
            { rating: 3, count: 0 },
            { rating: 2, count: 0 },
            { rating: 1, count: 0 },
          ],
        },
      };
    }

    // Calculate average
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = Math.round((totalRating / reviews.length) * 10) / 10;

    // Calculate breakdown
    const ratingBreakdown = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: reviews.filter((r) => r.rating === rating).length,
    }));

    return {
      success: true,
      data: {
        averageRating,
        totalReviews: reviews.length,
        ratingBreakdown,
      },
    };
  } catch (error) {
    console.error('Error in getTeamMemberReviewStats:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get venue review statistics
 */
export async function getVenueReviewStats(venueId: string): Promise<{
  success: boolean;
  data?: {
    averageRating: number;
    totalReviews: number;
    ratingBreakdown: { rating: number; count: number }[];
  };
  error?: string;
}> {
  try {
    await requireStaff();

    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('venue_id', venueId)
      .eq('status', 'published');

    if (error) {
      console.error('Error fetching venue review stats:', error);
      return { success: false, error: 'Failed to fetch review stats' };
    }

    if (!reviews || reviews.length === 0) {
      return {
        success: true,
        data: {
          averageRating: 0,
          totalReviews: 0,
          ratingBreakdown: [
            { rating: 5, count: 0 },
            { rating: 4, count: 0 },
            { rating: 3, count: 0 },
            { rating: 2, count: 0 },
            { rating: 1, count: 0 },
          ],
        },
      };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = Math.round((totalRating / reviews.length) * 10) / 10;

    const ratingBreakdown = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: reviews.filter((r) => r.rating === rating).length,
    }));

    return {
      success: true,
      data: {
        averageRating,
        totalReviews: reviews.length,
        ratingBreakdown,
      },
    };
  } catch (error) {
    console.error('Error in getVenueReviewStats:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
