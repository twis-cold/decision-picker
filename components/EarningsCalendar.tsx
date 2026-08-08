"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import type { EarningsResponse } from "@/lib/types";
import { useApp } from "./AppProviders";

const HOUR_LABEL = {
  bmo: "BEFORE OPEN",
  amc: "AFTER CLOSE",
  other: "—",
} as const;

export default function EarningsCalendar() {
  const { watchlist } = useApp();
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/earnings");
        const body = (await res.json()) as EarningsResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to load calendar.");
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load calendar.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const items = (data?.items ?? []).filter(
    (it) => !mineOnly || watchlist.includes(it.symbol),
  );
  const byDate = new Map<string, typeof items>();
  for (const it of items) {
    const list = byDate.get(it.date) ?? [];
    list.push(it);
    byDate.set(it.date, list);
  }

  return (
    <div className="tool-page">
      <div className="dash-meta">
        <h1 className="dash-title">EARNINGS CALENDAR</h1>
        {data && (
          <span className="updated">
            {formatDate(data.from)} – {formatDate(data.to)}
          </span>
        )}
        {data?.sampleData && <span className="badge-sample">SAMPLE DATA</span>}
      </div>
      <p className="tool-intro">
        Who reports this week and next — and whether it&rsquo;s before the bell
        or after the close.
      </p>

      <button
        type="button"
        className="beginner-toggle earnings-filter"
        role="switch"
        aria-checked={mineOnly}
        onClick={() => setMineOnly((m) => !m)}
      >
        MY COMPANIES ONLY
        <span className="switch" aria-hidden="true">
          <span className="knob" />
        </span>
      </button>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {!data && !error && <div className="skeleton" style={{ height: 240 }} />}

      {data?.needsKey && (
        <div className="error-box">
          The earnings calendar needs a (free) Finnhub API key — the same one
          that powers the news features. Add <code>FINNHUB_API_KEY</code> to
          your environment; see the README for setup.
        </div>
      )}

      {data && !data.needsKey && items.length === 0 && (
        <p className="tool-intro">
          {mineOnly
            ? "None of your watchlist companies report in this window."
            : "No reports found in this window."}
        </p>
      )}

      {[...byDate.entries()].map(([date, dayItems]) => (
        <section key={date} className="earnings-day">
          <h2 className={`section-title${date === today ? " today" : ""}`}>
            {formatDate(date)}
            {date === today && <span className="today-chip">TODAY</span>}
          </h2>
          {dayItems.map((it) => (
            <Link
              key={`${it.symbol}-${it.date}`}
              href={`/stock/${encodeURIComponent(it.symbol)}`}
              className="earnings-row"
            >
              <span className="ticker">{it.symbol}</span>
              <span className={`hour-chip ${it.hour}`}>
                {HOUR_LABEL[it.hour]}
              </span>
              <span className="eps">
                {it.epsEstimate != null
                  ? `est. EPS ${it.epsEstimate.toFixed(2)}`
                  : ""}
              </span>
              {watchlist.includes(it.symbol) && (
                <span className="watch-flag" title="On your watchlist">
                  ★
                </span>
              )}
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
