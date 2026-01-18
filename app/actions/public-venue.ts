// app/actions/public-venue.ts
'use server';

import { supabaseAdmin } from '@/lib/supabase/server';

// =====================================================
// TYPES
// =====================================================

export interface PublicTeamMember {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  average_rating: number;
  total_reviews: number;
}

export interface PublicReview {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  client: {
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
  };
  team_member: {
    id: string;
    first_name: string;
    last_name: string | null;
  };
}

export interface VenueReviewStats {
  average_rating: number;
  total_reviews: number;
}

// =====================================================
// PUBLIC VENUE ACTIONS (No auth required)
// =====================================================

/**
 * Get team members for a venue with their average ratings
 * Public endpoint - no auth required
 */
export async function getPublicVenueTeamMembers(
  venueId: string
): Promise<{ success: boolean; data?: PublicTeamMember[]; error?: string }> {
  try {
    // Get team members assigned to this venue
    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from('team_member_venues')
      .select(
        `
        team_member_id,
        display_order,
        users!team_member_venues_team_member_id_fkey (
          id,
          first_name,
          last_name,
          photo_url
        )
      `
      )
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (assignmentError) {
      console.error('Error fetching team members:', assignmentError);
      return { success: false, error: 'Failed to fetch team members' };
    }

    if (!assignments || assignments.length === 0) {
      return { success: true, data: [] };
    }

    // Get team member IDs
    const teamMemberIds = assignments.map((a) => a.team_member_id);

    // Get review stats for all team members in one query
    const { data: reviews, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('team_member_id, rating')
      .eq('venue_id', venueId)
      .eq('status', 'published')
      .in('team_member_id', teamMemberIds);

    if (reviewError) {
      console.error('Error fetching review stats:', reviewError);
    }

    // Calculate ratings per team member
    const ratingMap = new Map<
      string,
      { total: number; count: number; average: number }
    >();
    (reviews || []).forEach((review) => {
      const existing = ratingMap.get(review.team_member_id) || {
        total: 0,
        count: 0,
        average: 0,
      };
      existing.total += review.rating;
      existing.count += 1;
      existing.average =
        Math.round((existing.total / existing.count) * 10) / 10;
      ratingMap.set(review.team_member_id, existing);
    });

    // Transform data
    const teamMembers: PublicTeamMember[] = assignments
      .map((assignment) => {
        // Handle Supabase returning array or single object
        const user = Array.isArray(assignment.users)
          ? assignment.users[0]
          : assignment.users;

        if (!user) return null;

        const stats = ratingMap.get(assignment.team_member_id) || {
          total: 0,
          count: 0,
          average: 0,
        };

        return {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          photo_url: user.photo_url,
          average_rating: stats.average,
          total_reviews: stats.count,
        };
      })
      .filter((tm): tm is PublicTeamMember => tm !== null);

    return { success: true, data: teamMembers };
  } catch (error) {
    console.error('Error in getPublicVenueTeamMembers:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get public reviews for a venue
 * Public endpoint - no auth required
 */
export async function getPublicVenueReviews(
  venueId: string,
  options?: { limit?: number; offset?: number }
): Promise<{
  success: boolean;
  data?: PublicReview[];
  total?: number;
  stats?: VenueReviewStats;
  error?: string;
}> {
  try {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;

    // Get total count and stats first
    const { data: allReviews, error: statsError } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('venue_id', venueId)
      .eq('status', 'published');

    if (statsError) {
      console.error('Error fetching review stats:', statsError);
      return { success: false, error: 'Failed to fetch reviews' };
    }

    const total = allReviews?.length || 0;
    let stats: VenueReviewStats = { average_rating: 0, total_reviews: 0 };

    if (allReviews && allReviews.length > 0) {
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      stats = {
        average_rating: Math.round((totalRating / allReviews.length) * 10) / 10,
        total_reviews: allReviews.length,
      };
    }

    // Get paginated reviews with client and team member info
    const { data: reviews, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select(
        `
        id,
        rating,
        review_text,
        created_at,
        client:users!reviews_client_id_fkey (
          first_name,
          last_name,
          photo_url
        ),
        team_member:users!reviews_team_member_id_fkey (
          id,
          first_name,
          last_name
        )
      `
      )
      .eq('venue_id', venueId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reviewError) {
      console.error('Error fetching reviews:', reviewError);
      return { success: false, error: 'Failed to fetch reviews' };
    }

    // Transform the data
    const transformedReviews: PublicReview[] = (reviews || []).map((review) => {
      // Handle Supabase returning array or single object
      const client = Array.isArray(review.client)
        ? review.client[0]
        : review.client;
      const teamMember = Array.isArray(review.team_member)
        ? review.team_member[0]
        : review.team_member;

      return {
        id: review.id,
        rating: review.rating,
        review_text: review.review_text,
        created_at: review.created_at,
        client: {
          first_name: client?.first_name || 'Anonymous',
          last_name: client?.last_name || null,
          photo_url: client?.photo_url || null,
        },
        team_member: {
          id: teamMember?.id || '',
          first_name: teamMember?.first_name || 'Unknown',
          last_name: teamMember?.last_name || null,
        },
      };
    });

    return {
      success: true,
      data: transformedReviews,
      total,
      stats,
    };
  } catch (error) {
    console.error('Error in getPublicVenueReviews:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
