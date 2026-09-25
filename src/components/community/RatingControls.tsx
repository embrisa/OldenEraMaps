import { Star } from "lucide-react";
import type { JSX } from "react";
import { cn } from "@/lib/utils";

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

export function formatRatingCount(count: number): string {
  return `${count} ${count === 1 ? "rating" : "ratings"}`;
}

export function RatingSummary({
  averageRating,
  ratingCount,
  viewerRating,
  className
}: {
  averageRating: number;
  ratingCount: number;
  viewerRating?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn("community-rating-summary", className)}>
      <strong className="community-rating-summary__score">
        <Star size={14} aria-hidden="true" />
        {averageRating.toFixed(1)} / 5
      </strong>
      <span>{formatRatingCount(ratingCount)}{viewerRating ? ` · your score ${viewerRating}` : ""}</span>
    </div>
  );
}

export function StarRatingButtons({
  mapTitle,
  viewerRating,
  disabled,
  disabledReason,
  onRate,
  className
}: {
  mapTitle: string;
  viewerRating?: number;
  disabled: boolean;
  disabledReason?: string;
  onRate(value: number): void;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn("community-rate-buttons star-rating", className)} role="group" aria-label={`Rate ${mapTitle}`}>
      {RATING_VALUES.map((value) => (
        <button
          key={value}
          type="button"
          className={cn("star-rating__star", viewerRating !== undefined && value <= viewerRating && "star-rating__star--filled")}
          onClick={() => onRate(value)}
          disabled={disabled}
          title={disabled ? disabledReason : `Rate ${value} of 5`}
          aria-label={`Rate ${value} stars for ${mapTitle}`}
          aria-pressed={viewerRating === value}
        >
          <Star size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
