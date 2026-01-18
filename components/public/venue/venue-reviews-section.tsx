// components/public/venue/venue-reviews-section.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, ChevronDown, Loader2 } from 'lucide-react';
import { getPublicVenueReviews } from '@/app/actions/public-venue';
import type {
  PublicReview,
  VenueReviewStats,
} from '@/app/actions/public-venue';

interface VenueReviewsSectionProps {
  venueId: string;
  initialReviews: PublicReview[];
  initialTotal: number;
  stats: VenueReviewStats;
}

function formatReviewDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today
  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  }

  // Yesterday
  if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  }

  // Within a week
  if (diffDays < 7) {
    return `${date.toLocaleDateString('en-AU', {
      weekday: 'short',
    })}, ${date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} at ${date.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  }

  // Older
  return `${date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} at ${date.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
}

function formatClientName(firstName: string, lastName: string | null): string {
  if (lastName) {
    return `${firstName} ${lastName.charAt(0).toUpperCase()}`;
  }
  return firstName;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  const initial = review.client.first_name.charAt(0).toUpperCase();
  const clientName = formatClientName(
    review.client.first_name,
    review.client.last_name
  );

  return (
    <div className="py-4">
      {/* Header: Avatar + Name + Date */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-purple-100 flex items-center justify-center flex-shrink-0">
          {review.client.photo_url ? (
            <Image
              src={review.client.photo_url}
              alt={clientName}
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-sm font-semibold text-purple-500">
              {initial}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{clientName}</h4>
          <p className="text-sm text-gray-500">
            {formatReviewDate(review.created_at)}
          </p>
        </div>
      </div>

      {/* Star Rating */}
      <div className="mb-2">
        <StarRating rating={review.rating} />
      </div>

      {/* Review Text */}
      {review.review_text && (
        <p className="text-gray-700 leading-relaxed">{review.review_text}</p>
      )}
    </div>
  );
}

export function VenueReviewsSection({
  venueId,
  initialReviews,
  initialTotal,
  stats,
}: VenueReviewsSectionProps) {
  const [reviews, setReviews] = useState<PublicReview[]>(initialReviews);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialTotal > initialReviews.length);

  const loadMore = async () => {
    setLoading(true);
    try {
      const result = await getPublicVenueReviews(venueId, {
        limit: 10,
        offset: reviews.length,
      });

      if (result.success && result.data) {
        setReviews((prev) => [...prev, ...result.data!]);
        setHasMore(reviews.length + result.data.length < (result.total || 0));
      }
    } catch (error) {
      console.error('Error loading more reviews:', error);
    }
    setLoading(false);
  };

  // Don't render if no reviews
  if (stats.total_reviews === 0) {
    return null;
  }

  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Reviews</h2>

      {/* Overall Rating */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-6 h-6 ${
                star <= Math.round(stats.average_rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xl font-bold text-gray-900">
          {stats.average_rating.toFixed(1)}
        </span>
        <span className="text-purple-600 font-medium">
          ({stats.total_reviews.toLocaleString()})
        </span>
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show more reviews
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
