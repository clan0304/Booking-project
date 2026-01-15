// components/public/dashboard/review-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Star, Loader2 } from 'lucide-react';
import { createReview } from '@/app/actions/reviews';
import { cn } from '@/lib/utils';

interface TeamMemberForReview {
  id: string;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  services: string[];
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  venueName: string;
  venuePhotoUrl: string | null;
  teamMember: TeamMemberForReview;
  initialRating: number;
  onReviewSubmitted: (
    teamMemberId: string,
    reviewId: string,
    rating: number,
    reviewText: string | null
  ) => void;
}

const STAR_LABELS = ['Terrible', 'Bad', 'Okay', 'Good', 'Great'];
const MAX_CHARACTERS = 600;

export function ReviewModal({
  isOpen,
  onClose,
  bookingId,
  venueName,
  venuePhotoUrl,
  teamMember,
  initialRating,
  onReviewSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setRating(initialRating);
      setHoverRating(0);
      setReviewText('');
      setError(null);
    }
  }, [isOpen, initialRating, teamMember.id]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
        onReviewSubmitted(
          teamMember.id,
          result.reviewId,
          rating,
          reviewText.trim() || null
        );
        onClose();
      } else {
        setError(result.error || 'Failed to submit review');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARACTERS) {
      setReviewText(text);
    }
  };

  if (!isOpen) return null;

  const displayRating = hoverRating || rating;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>

          {/* Content */}
          <div className="p-6 pt-12">
            {/* Image */}
            <div className="flex justify-center mb-6">
              <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 shadow-lg">
                {teamMember.photo_url ? (
                  <Image
                    src={teamMember.photo_url}
                    alt={teamMember.first_name}
                    fill
                    className="object-cover"
                  />
                ) : venuePhotoUrl ? (
                  <Image
                    src={venuePhotoUrl}
                    alt={venueName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                    <span className="text-3xl font-bold text-purple-400">
                      {teamMember.first_name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Rate your experience with {teamMember.first_name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">at {venueName}</p>
              {teamMember.services.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {teamMember.services.join(', ')}
                </p>
              )}
            </div>

            {/* Star Rating */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = star <= displayRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className={cn(
                        'transition-transform hover:scale-110',
                        isSubmitting && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <Star
                        className={cn(
                          'w-10 h-10 transition-colors',
                          isActive
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-gray-200 text-gray-200'
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Star Labels */}
              <div className="flex items-center justify-between w-full max-w-[280px] mt-2 px-1">
                {STAR_LABELS.map((label, index) => (
                  <span
                    key={label}
                    className={cn(
                      'text-xs transition-colors',
                      displayRating === index + 1
                        ? 'text-gray-900 font-medium'
                        : 'text-gray-400'
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Review Text */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Review
                </label>
                <span className="text-xs text-gray-400">
                  {reviewText.length}/{MAX_CHARACTERS}
                </span>
              </div>
              <textarea
                value={reviewText}
                onChange={handleTextChange}
                placeholder="How was your experience?"
                disabled={isSubmitting}
                className="w-full p-4 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                rows={4}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || rating === 0}
              className={cn(
                'w-full py-4 rounded-full font-medium text-white transition-all',
                rating === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gray-900 hover:bg-gray-800',
                isSubmitting && 'opacity-70 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
