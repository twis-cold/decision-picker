"use client";

import { useEffect, useState } from "react";
import type { NewsFeedResponse } from "@/lib/types";
import NewsList from "./NewsList";

const CATEGORIES = [
  ["general", "GENERAL"],
  ["merger", "M&A"],
  ["crypto", "CRYPTO"],
  ["forex", "FOREX"],
] as const;

export default function NewsFeed() {
  const [category, setCategory] = useState("general");
  const [symbolInput, setSymbolInput] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [data, setData] = useState<NewsFeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const qs = new URLSearchParams({ category });
        if (symbol) qs.set("symbol", symbol);
        const res = await fetch(`/api/newsfeed?${qs}`);
        const body = (await res.json()) as NewsFeedResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to load news.");
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load news.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, symbol]);

  return (
    <div className="tool-page">
      <div className="dash-meta">
        <h1 className="dash-title">MARKET NEWS</h1>
        {data?.sampleData && <span className="badge-sample">SAMPLE DATA</span>}
      </div>

      <div className="chart-controls">
        <div className="range-toggle" role="group" aria-label="Category">
          {CATEGORIES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={category === id && !symbol}
              onClick={() => {
                setSymbol(null);
                setSymbolInput("");
                setCategory(id);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className="news-symbol-filter"
          onSubmit={(e) => {
            e.preventDefault();
            setSymbol(symbolInput.trim() ? symbolInput.trim().toUpperCase() : null);
          }}
        >
          <input
            type="text"
            value={symbolInput}
            placeholder="Filter by ticker…"
            maxLength={12}
            spellCheck={false}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
          />
          <button type="submit" className="tool-submit ghost">GO</button>
          {symbol && (
            <button
              type="button"
              className="tool-submit ghost"
              onClick={() => {
                setSymbol(null);
                setSymbolInput("");
              }}
            >
              CLEAR {symbol}
            </button>
          )}
        </form>
      </div>

      {loading && <div className="skeleton" style={{ height: 240 }} />}
      {error && <div className="error-box">{error}</div>}
      {data && !loading && (
        <>
          <NewsList items={data.items} />
          <p className="news-provider">
            headlines via{" "}
            {data.provider === "finnhub"
              ? "Finnhub"
              : data.provider === "yahoo"
                ? "Yahoo Finance (add a Finnhub key for the full categorized feed)"
                : "sample data"}
          </p>
        </>
      )}
    </div>
  );
}
