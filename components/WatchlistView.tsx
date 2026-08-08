"use client";

import Link from "next/link";
import type { QuotesResponse } from "@/lib/types";
import { useApp } from "./AppProviders";
import StockCard from "./StockCard";
import { usePoll } from "./usePoll";

export default function WatchlistView() {
  const { watchlist, email, pro } = useApp();
  const url = `/api/quotes?symbols=${encodeURIComponent(watchlist.join(","))}`;
  const { data, error, loading } = usePoll<QuotesResponse>(
    url,
    pro ? 30_000 : 60_000,
  );

  return (
    <div className="tool-page">
      <div className="dash-meta">
        <h1 className="dash-title">WATCHLIST</h1>
        {data?.sampleData && <span className="badge-sample">SAMPLE DATA</span>}
      </div>

      {watchlist.length === 0 ? (
        <p className="tool-intro">
          Nothing saved yet — tap the ☆ on any stock card or detail page and
          it&rsquo;ll show up here (and as a quick-view on the{" "}
          <Link href="/">dashboard</Link>).
        </p>
      ) : (
        <>
          {loading && !data && (
            <div className="skeleton" style={{ height: 200 }} />
          )}
          {error && !data && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          {data?.quotes.map((q) => <StockCard key={q.symbol} stock={q} />)}
        </>
      )}

      <p className="fine-print">
        {email ? (
          <>Your watchlist is saved in this browser.</>
        ) : (
          <>
            Saved in this browser only —{" "}
            <Link href="/account?next=/watchlist">sign in</Link> to tie it to
            your account.
          </>
        )}
      </p>
    </div>
  );
}
