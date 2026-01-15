// components/public/dashboard/review-section.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, Check } from 'lucide-react';
import { ReviewModal } from './review-modal';
import { cn } from '@/lib/utils';
import type { DashboardBooking } from '@/app/actions/bookings';

// Extract review type from DashboardBooking
type DashboardReview = DashboardBooking['reviews'][number];

interface TeamMemberForReview {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  services: string[];
}

interface ReviewSectionProps {
  bookingId: string;
  venueName: string;
  venuePhotoUrl: string | null;
  teamMembers: TeamMemberForReview[];
  existingReviews: DashboardReview[];
  onReviewSubmitted: (
    bookingId: string,
    teamMemberId: string,
    reviewId: string,
    rating: number,
    reviewText: string | null
  ) => void;
}

// Display stars (read-only)
function StarRatingDisplay({
  rating,
  size = 'sm',
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClasses[size],
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          )}
        />
      ))}
    </div>
  );
}

// Component to show a submitted review (read-only)
interface SubmittedReviewDisplayProps {
  teamMember: TeamMemberForReview;
  review: DashboardReview;
}

function SubmittedReviewDisplay({
  teamMember,
  review,
}: SubmittedReviewDisplayProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {teamMember.photo_url ? (
            <Image
              src={teamMember.photo_url}
              alt={teamMember.first_name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
              <span className="text-sm font-semibold text-purple-600">
                {teamMember.first_name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900">
              {teamMember.first_name} {teamMember.last_name?.charAt(0) || ''}.
            </p>
            <div className="flex items-center gap-1 text-green-600">
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Reviewed</span>
            </div>
          </div>

          {/* Stars */}
          <StarRatingDisplay rating={review.rating} size="sm" />

          {/* Review Text */}
          {review.review_text && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-3">
              &ldquo;{review.review_text}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Separate component for star rating prompt (clickable)
interface StarRatingPromptProps {
  teamMember: TeamMemberForReview;
  onRatingClick: (rating: number) => void;
  size?: 'sm' | 'lg';
  centered?: boolean;
}

function StarRatingPrompt({
  teamMember,
  onRatingClick,
  size = 'sm',
  centered = false,
}: StarRatingPromptProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const starSize = size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';
  const avatarSize = size === 'lg' ? 'w-14 h-14' : 'w-12 h-12';
  const initialsSize = size === 'lg' ? 'text-xl' : 'text-lg';

  if (centered) {
    return (
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'relative rounded-full overflow-hidden bg-gray-100 mb-3',
            avatarSize
          )}
        >
          {teamMember.photo_url ? (
            <Image
              src={teamMember.photo_url}
              alt={teamMember.first_name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
              <span
                className={cn('font-semibold text-purple-600', initialsSize)}
              >
                {teamMember.first_name.charAt(0)}
              </span>
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 mb-2">
          {teamMember.first_name} {teamMember.last_name?.charAt(0) || ''}.
        </p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isActive = star <= hoverRating;
            return (
              <button
                key={star}
                type="button"
                onClick={() => onRatingClick(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    'transition-colors',
                    starSize,
                    isActive
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-gray-200 text-gray-200'
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Team Member Avatar */}
      <div
        className={cn(
          'relative rounded-full overflow-hidden bg-gray-100 flex-shrink-0',
          avatarSize
        )}
      >
        {teamMember.photo_url ? (
          <Image
            src={teamMember.photo_url}
            alt={teamMember.first_name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
            <span className={cn('font-semibold text-purple-600', initialsSize)}>
              {teamMember.first_name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Name and Stars */}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 mb-1">
          {teamMember.first_name} {teamMember.last_name?.charAt(0) || ''}.
        </p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isActive = star <= hoverRating;
            return (
              <button
                key={star}
                type="button"
                onClick={() => onRatingClick(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    'transition-colors',
                    starSize,
                    isActive
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-gray-200 text-gray-200'
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ReviewSection({
  bookingId,
  venueName,
  venuePhotoUrl,
  teamMembers,
  existingReviews,
  onReviewSubmitted,
}: ReviewSectionProps) {
  // Track locally submitted reviews (for optimistic UI)
  const [localReviews, setLocalReviews] = useState<
    Map<string, { rating: number; text: string | null }>
  >(new Map());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] =
    useState<TeamMemberForReview | null>(null);
  const [initialRating, setInitialRating] = useState(0);

  // Get existing review for a team member
  const getExistingReview = (teamMemberId: string): DashboardReview | null => {
    return (
      existingReviews.find((r) => r.team_member_id === teamMemberId) || null
    );
  };

  // Get locally submitted review
  const getLocalReview = (teamMemberId: string) => {
    return localReviews.get(teamMemberId) || null;
  };

  // Check if stylist has been reviewed (existing or local)
  const hasReview = (teamMemberId: string): boolean => {
    return !!getExistingReview(teamMemberId) || !!getLocalReview(teamMemberId);
  };

  // Separate reviewed and unreviewed
  const reviewedTeamMembers = teamMembers.filter((tm) => hasReview(tm.id));
  const unreviewedTeamMembers = teamMembers.filter((tm) => !hasReview(tm.id));

  // Handle star click - open modal
  const handleRatingClick = (
    teamMember: TeamMemberForReview,
    rating: number
  ) => {
    setSelectedTeamMember(teamMember);
    setInitialRating(rating);
    setModalOpen(true);
  };

  // Handle review submitted from modal
  const handleReviewSubmitted = (
    teamMemberId: string,
    reviewId: string,
    rating: number,
    reviewText: string | null
  ) => {
    // Track locally for optimistic UI
    setLocalReviews((prev) => {
      const next = new Map(prev);
      next.set(teamMemberId, { rating, text: reviewText });
      return next;
    });
    // Notify parent
    onReviewSubmitted(bookingId, teamMemberId, reviewId, rating, reviewText);
  };

  // Don't render if no team members at all
  if (teamMembers.length === 0) {
    return null;
  }

  // All reviewed - show summary
  const allReviewed = unreviewedTeamMembers.length === 0;

  return (
    <>
      <div className="border border-gray-200 rounded-xl p-5 mb-4">
        {/* Header */}
        <div className="text-center mb-5">
          <h3 className="font-semibold text-gray-900">
            {allReviewed
              ? `Your reviews for ${venueName}`
              : `How was your experience at ${venueName}?`}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {allReviewed
              ? 'Thanks for your feedback!'
              : 'Let us know your thoughts'}
          </p>
        </div>

        {/* Unreviewed Stylists */}
        {unreviewedTeamMembers.length > 0 && (
          <div className="mb-4">
            {unreviewedTeamMembers.length === 1 &&
            reviewedTeamMembers.length === 0 ? (
              // Single stylist, none reviewed - centered layout
              <StarRatingPrompt
                teamMember={unreviewedTeamMembers[0]}
                onRatingClick={(rating) =>
                  handleRatingClick(unreviewedTeamMembers[0], rating)
                }
                size="lg"
                centered
              />
            ) : (
              // Multiple or mixed - list layout
              <div className="space-y-3">
                {unreviewedTeamMembers.map((tm) => (
                  <StarRatingPrompt
                    key={tm.id}
                    teamMember={tm}
                    onRatingClick={(rating) => handleRatingClick(tm, rating)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider if both sections exist */}
        {unreviewedTeamMembers.length > 0 && reviewedTeamMembers.length > 0 && (
          <div className="border-t border-gray-200 my-4" />
        )}

        {/* Reviewed Stylists */}
        {reviewedTeamMembers.length > 0 && (
          <div className="space-y-3">
            {reviewedTeamMembers.map((tm) => {
              // Get review data (existing or local)
              const existingReview = getExistingReview(tm.id);
              const localReview = getLocalReview(tm.id);

              // Build review object for display
              const reviewData: DashboardReview = existingReview || {
                id: 'local',
                team_member_id: tm.id,
                rating: localReview?.rating || 0,
                review_text: localReview?.text || null,
                status: 'published',
                created_at: new Date().toISOString(),
              };

              return (
                <SubmittedReviewDisplay
                  key={tm.id}
                  teamMember={tm}
                  review={reviewData}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedTeamMember && (
        <ReviewModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedTeamMember(null);
            setInitialRating(0);
          }}
          bookingId={bookingId}
          venueName={venueName}
          venuePhotoUrl={venuePhotoUrl}
          teamMember={selectedTeamMember}
          initialRating={initialRating}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </>
  );
}
