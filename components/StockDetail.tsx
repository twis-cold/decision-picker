"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatChange, formatPercent } from "@/lib/format";
import type { NewsResponse, QuoteDetail } from "@/lib/types";
import AdSlot from "./AdSlot";
import AlertForm from "./AlertForm";
import { useApp } from "./AppProviders";
import Financials from "./Financials";
import NewsList from "./NewsList";
import OptionsChain from "./OptionsChain";
import OrderPanel from "./OrderPanel";
import PriceChart from "./PriceChart";
import PriceTicker from "./PriceTicker";
import Ratings from "./Ratings";
import StatGrid from "./StatGrid";
import { usePoll } from "./usePoll";
import WatchStar from "./WatchStar";

type DetailTab = "overview" | "financials" | "options";

export default function StockDetail({ symbol }: { symbol: string }) {
  const { pro, earningsToday } = useApp();
  const { data: quote, error, loading, reload } = usePoll<QuoteDetail>(
    `/api/quote/${encodeURIComponent(symbol)}`,
    pro ? 30_000 : 60_000,
  );
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");

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
            <WatchStar symbol={quote.symbol} size={18} />
            {quote.exchange && (
              <span className="detail-exchange">{quote.exchange}</span>
            )}
            {earningsToday[quote.symbol] && (
              <span className="earnings-chip">
                EARNINGS{" "}
                {earningsToday[quote.symbol] === "bmo"
                  ? "BMO"
                  : earningsToday[quote.symbol] === "amc"
                    ? "AMC"
                    : "TODAY"}
              </span>
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

      <OrderPanel symbol={quote.symbol} price={quote.price} />
      <AlertForm symbol={quote.symbol} price={quote.price} />

      <h2 className="detail-section-title">KEY STATS</h2>
      <StatGrid quote={quote} />

      <AdSlot variant="banner" />

      <div className="range-toggle detail-tabs" role="tablist" aria-label="Detail sections">
        {(
          [
            ["overview", "OVERVIEW"],
            ["financials", "FINANCIALS"],
            ["options", "OPTIONS"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <Ratings symbol={quote.symbol} currentPrice={quote.price} />

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
        </>
      )}
      {tab === "financials" && <Financials symbol={quote.symbol} />}
      {tab === "options" && <OptionsChain symbol={quote.symbol} />}
    </div>
  );
}
