"use client";

import Link from "next/link";
import { formatPercent } from "@/lib/format";
import type { QuotesResponse } from "@/lib/types";
import { useApp } from "./AppProviders";
import PriceTicker from "./PriceTicker";
import { usePoll } from "./usePoll";

/**
 * Compact watchlist quick-view on the homepage: one row per saved ticker,
 * linking to the full /watchlist page.
 */
export default function WatchlistStrip() {
  const { watchlist, pro } = useApp();
  const url =
    watchlist.length > 0
      ? `/api/quotes?symbols=${encodeURIComponent(watchlist.join(","))}`
      : null;
  const { data } = usePoll<QuotesResponse>(
    url ?? "/api/quotes?symbols=",
    pro ? 30_000 : 60_000,
  );

  if (watchlist.length === 0) return null;

  return (
    <section className="watch-strip">
      <h2 className="section-title">
        <span className="tick neutral" aria-hidden="true">
          ★
        </span>
        WATCHLIST
        <Link href="/watchlist" className="strip-link">
          VIEW ALL →
        </Link>
      </h2>
      <div className="strip-row">
        {(data?.quotes ?? []).map((q) => {
          const up = q.changePercent >= 0;
          return (
            <Link
              key={q.symbol}
              href={`/stock/${encodeURIComponent(q.symbol)}`}
              className="strip-item"
            >
              <span className="ticker">{q.symbol}</span>
              <PriceTicker value={q.price} />
              <span className={`chip ${up ? "up" : "down"}`}>
                {up ? "▲" : "▼"} {formatPercent(q.changePercent)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
