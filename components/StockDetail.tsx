"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatChange, formatPercent } from "@/lib/format";
import type { NewsResponse, QuoteDetail } from "@/lib/types";
import NewsList from "./NewsList";
import PriceChart from "./PriceChart";
import PriceTicker from "./PriceTicker";
import StatGrid from "./StatGrid";
import { usePoll } from "./usePoll";

export default function StockDetail({ symbol }: { symbol: string }) {
  const { data: quote, error, loading, reload } = usePoll<QuoteDetail>(
    `/api/quote/${encodeURIComponent(symbol)}`,
    60_000,
  );
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);

  // Fetch news once the first quote arrives (the explanation needs the
  // day's % change); don't refetch on every quote poll.
  useEffect(() => {
    if (!quote || news || newsError) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/news/${encodeURIComponent(symbol)}?change=${quote.changePercent.toFixed(2)}`,
        );
        const body = (await res.json()) as NewsResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to load news");
        if (!cancelled) setNews(body);
      } catch (err) {
        if (!cancelled)
          setNewsError(
            err instanceof Error ? err.message : "Failed to load news",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quote, news, newsError, symbol]);

  if (loading && !quote) {
    return (
      <div>
        <div className="skeleton" style={{ height: 64, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="error-box" role="alert">
        <strong>Couldn&rsquo;t load {symbol}.</strong>
        <br />
        {error}
        <br />
        <button type="button" onClick={reload}>
          RETRY
        </button>
      </div>
    );
  }

  if (!quote) return null;

  const up = quote.changePercent >= 0;

  return (
    <div>
      <Link href="/" className="back-link">
        ← MARKET MOVERS
      </Link>

      <div className="detail-head">
        <div>
          <h1 className="detail-symbol">
            {quote.symbol}
            {quote.exchange && (
              <span className="detail-exchange">{quote.exchange}</span>
            )}
            {quote.sampleData && (
              <span className="badge-sample" style={{ marginLeft: 10 }}>
                SAMPLE DATA
              </span>
            )}
          </h1>
          <p className="detail-name">{quote.name}</p>
        </div>
        <div className="detail-price-block">
          <PriceTicker value={quote.price} className="detail-price" />
          <div className={`detail-change ${up ? "up" : "down"}`}>
            {up ? "▲" : "▼"} {formatChange(quote.change)} (
            {formatPercent(quote.changePercent)})
          </div>
        </div>
      </div>

      <PriceChart symbol={quote.symbol} />

      <h2 className="detail-section-title">KEY STATS</h2>
      <StatGrid quote={quote} />

      <h2 className="detail-section-title">WHY IT&rsquo;S MOVING</h2>
      {news ? (
        <p className="explain-card">
          <span className="cat">{news.explanation.category}</span>
          {news.explanation.text}
        </p>
      ) : (
        <p className="explain-card">
          {newsError ?? "Reading recent headlines…"}
        </p>
      )}

      <h2 className="detail-section-title">RELATED NEWS</h2>
      {news ? (
        <>
          <NewsList items={news.items} />
          <p className="news-provider">
            headlines via{" "}
            {news.provider === "finnhub"
              ? "Finnhub"
              : news.provider === "yahoo"
                ? "Yahoo Finance"
                : "sample data"}
          </p>
        </>
      ) : (
        <div className="skeleton" style={{ height: 120 }} />
      )}
    </div>
  );
}
