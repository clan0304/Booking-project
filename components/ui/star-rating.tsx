// components/ui/star-rating.tsx
'use client';

import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showValue?: boolean;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onChange,
  showValue = false,
}: StarRatingProps): React.ReactElement {
  const [hoverRating, setHoverRating] = React.useState<number>(0);

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const gapClasses = {
    sm: 'gap-0.5',
    md: 'gap-1',
    lg: 'gap-1.5',
  };

  const handleClick = (value: number) => {
    if (interactive && onChange) {
      onChange(value);
    }
  };

  const handleMouseEnter = (value: number) => {
    if (interactive) {
      setHoverRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className={`flex items-center ${gapClasses[size]}`}>
      {Array.from({ length: maxRating }, (_, index) => {
        const value = index + 1;
        const isFilled = value <= displayRating;

        return (
          <button
            key={index}
            type="button"
            onClick={() => handleClick(value)}
            onMouseEnter={() => handleMouseEnter(value)}
            onMouseLeave={handleMouseLeave}
            disabled={!interactive}
            className={`${
              interactive
                ? 'cursor-pointer hover:scale-110 transition-transform'
                : 'cursor-default'
            } disabled:cursor-default`}
          >
            <Star
              className={`${sizeClasses[size]} ${
                isFilled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-transparent text-gray-300'
              } transition-colors`}
            />
          </button>
        );
      })}
      {showValue && (
        <span className="ml-1.5 text-sm font-medium text-gray-700">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// Display-only variant for showing average ratings
interface RatingDisplayProps {
  rating: number;
  totalReviews?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingDisplay({
  rating,
  totalReviews,
  size = 'md',
}: RatingDisplayProps): React.ReactElement {
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex items-center gap-2">
      <StarRating rating={rating} size={size} />
      <span className={`font-medium text-gray-900 ${textSizes[size]}`}>
        {rating > 0 ? rating.toFixed(1) : '—'}
      </span>
      {totalReviews !== undefined && (
        <span className={`text-gray-500 ${textSizes[size]}`}>
          ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  );
}
