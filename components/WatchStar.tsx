"use client";

import { useApp } from "./AppProviders";

/**
 * Watchlist toggle: subtle outline star, filled when saved. Deliberately
 * ink-colored (not green/red) so it never reads as a gain/loss signal.
 */
export default function WatchStar({
  symbol,
  size = 16,
}: {
  symbol: string;
  size?: number;
}) {
  const { isWatched, toggleWatch } = useApp();
  const watched = isWatched(symbol);

  return (
    <button
      type="button"
      className={`watch-star${watched ? " watched" : ""}`}
      aria-label={
        watched
          ? `Remove ${symbol} from watchlist`
          : `Add ${symbol} to watchlist`
      }
      aria-pressed={watched}
      title={watched ? "Remove from watchlist" : "Add to watchlist"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWatch(symbol);
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={watched ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l2.7 5.8 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3.1 1.2-6.2L3 9.6l6.3-.8z" />
      </svg>
    </button>
  );
}
