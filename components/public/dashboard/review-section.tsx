// components/public/dashboard/review-section.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, Loader2, Check } from 'lucide-react';
import { createReview } from '@/app/actions/reviews';
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

interface StarRatingInputProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function StarRatingInput({
  rating,
  onRatingChange,
  disabled,
  size = 'lg',
}: StarRatingInputProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isActive = star <= (hoverRating || rating);
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onRatingChange(star)}
            onMouseEnter={() => !disabled && setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className={cn(
              'transition-transform',
              !disabled && 'hover:scale-110',
              disabled && 'cursor-not-allowed'
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                'transition-colors',
                isActive
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

interface SingleReviewFormProps {
  bookingId: string;
  teamMember: TeamMemberForReview;
  existingReview: DashboardReview | null;
  onReviewSubmitted: (
    teamMemberId: string,
    reviewId: string,
    rating: number,
    reviewText: string | null
  ) => void;
}

function SingleReviewForm({
  bookingId,
  teamMember,
  existingReview,
  onReviewSubmitted,
}: SingleReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [reviewText, setReviewText] = useState(
    existingReview?.review_text || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(!!existingReview);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createReview(
        bookingId,
        teamMember.id,
        rating,
        reviewText.trim() || undefined
      );

      if (result.success && result.reviewId) {
        setIsSubmitted(true);
        onReviewSubmitted(
          teamMember.id,
          result.reviewId,
          rating,
          reviewText.trim() || null
        );
      } else {
        setError(result.error || 'Failed to submit review');
      }
    } catch (err) {
      setError(`${err} An error occurred. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted && existingReview) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Check className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <p className="font-medium text-green-800">
            Thank you for your review!
          </p>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  'w-4 h-4',
                  star <= existingReview.rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Team Member Info */}
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {teamMember.photo_url ? (
            <Image
              src={teamMember.photo_url}
              alt={teamMember.first_name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
              <span className="text-lg font-semibold text-purple-600">
                {teamMember.first_name.charAt(0)}
              </span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900">
            {teamMember.first_name} {teamMember.last_name?.charAt(0) || ''}.
          </p>
          <p className="text-sm text-gray-500">
            {teamMember.services.join(', ')}
          </p>
        </div>
      </div>

      {/* Star Rating */}
      <div className="flex justify-center py-2">
        <StarRatingInput
          rating={rating}
          onRatingChange={setRating}
          disabled={isSubmitting}
        />
      </div>

      {/* Review Text (optional, shown after rating) */}
      {rating > 0 && (
        <div>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share your experience (optional)"
            disabled={isSubmitting}
            className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50"
            rows={3}
          />
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Submit Button */}
      {rating > 0 && (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Review'
          )}
        </button>
      )}
    </div>
  );
}

export function ReviewSection({
  bookingId,
  venueName,
  teamMembers,
  existingReviews,
  onReviewSubmitted,
}: ReviewSectionProps) {
  // Find existing review for each team member
  const getExistingReview = (teamMemberId: string) => {
    return (
      existingReviews.find((r) => r.team_member_id === teamMemberId) || null
    );
  };

  // Check if all team members have been reviewed
  const allReviewed = teamMembers.every((tm) => getExistingReview(tm.id));

  if (teamMembers.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 mb-4">
      <div className="text-center mb-4">
        <h3 className="font-semibold text-gray-900">
          How was your experience at {venueName}?
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {allReviewed
            ? 'Thanks for your feedback!'
            : 'Let us know your thoughts'}
        </p>
      </div>

      {/* If single team member, show inline */}
      {teamMembers.length === 1 ? (
        <SingleReviewForm
          bookingId={bookingId}
          teamMember={teamMembers[0]}
          existingReview={getExistingReview(teamMembers[0].id)}
          onReviewSubmitted={(tmId, reviewId, rating, text) =>
            onReviewSubmitted(bookingId, tmId, reviewId, rating, text)
          }
        />
      ) : (
        /* Multiple team members - show each */
        <div className="space-y-4">
          {teamMembers.map((tm) => (
            <div
              key={tm.id}
              className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
            >
              <SingleReviewForm
                bookingId={bookingId}
                teamMember={tm}
                existingReview={getExistingReview(tm.id)}
                onReviewSubmitted={(tmId, reviewId, rating, text) =>
                  onReviewSubmitted(bookingId, tmId, reviewId, rating, text)
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
