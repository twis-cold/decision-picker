"use client";

import { formatClock } from "@/lib/format";
import type { MoversResponse, StockSummary } from "@/lib/types";
import AdSlot from "./AdSlot";
import { useApp } from "./AppProviders";
import StockCard from "./StockCard";
import { usePoll } from "./usePoll";
import WatchlistStrip from "./WatchlistStrip";

function Section({
  title,
  tick,
  tickClass,
  stocks,
  adAfter,
}: {
  title: string;
  tick: string;
  tickClass: string;
  stocks: StockSummary[];
  adAfter?: number;
}) {
  return (
    <section>
      <h2 className="section-title">
        <span className={`tick ${tickClass}`} aria-hidden="true">
          {tick}
        </span>
        {title}
      </h2>
      {stocks.map((s, i) => (
        <div key={s.symbol}>
          <StockCard stock={s} />
          {adAfter === i && <AdSlot variant="native" />}
        </div>
      ))}
    </section>
  );
}

function Skeletons() {
  return (
    <div className="movers-grid" aria-hidden="true">
      {Array.from({ length: 3 }, (_, col) => (
        <section key={col}>
          <div
            className="skeleton"
            style={{ height: 14, width: 120, margin: "30px 0 16px" }}
          />
          {Array.from({ length: 6 }, (_, row) => (
            <div
              key={row}
              className="skeleton"
              style={{ height: 44, margin: "0 0 14px" }}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { pro } = useApp();
  // Pro perk: priority refresh (30s instead of 60s).
  const { data, error, loading, reload } = usePoll<MoversResponse>(
    "/api/movers",
    pro ? 30_000 : 60_000,
  );

  if (loading && !data) return <Skeletons />;

  if (error && !data) {
    return (
      <div className="error-box" role="alert">
        <strong>Couldn&rsquo;t load market movers.</strong>
        <br />
        {error}
        <br />
        <button type="button" onClick={reload}>
          RETRY
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="dash-layout">
      <div>
        <WatchlistStrip />
        <div className="dash-meta">
          <h1 className="dash-title">MARKET MOVERS</h1>
          <span className="updated">
            updated {formatClock(new Date(data.asOf))} · refreshes every{" "}
            {pro ? "30s" : "60s"}
          </span>
          {data.sampleData && <span className="badge-sample">SAMPLE DATA</span>}
          {error && (
            <span className="stale-note">refresh failed — showing last data</span>
          )}
        </div>
        <div className="movers-grid">
          <Section
            title="TOP GAINERS"
            tick="▲"
            tickClass=""
            stocks={data.gainers}
          />
          <Section
            title="TOP LOSERS"
            tick="▼"
            tickClass="down"
            stocks={data.losers}
          />
          <Section
            title="MOST ACTIVE"
            tick="≡"
            tickClass="neutral"
            stocks={data.actives}
            adAfter={3}
          />
          {data.highs52w.length > 0 && (
            <Section
              title="NEAR 52W HIGH"
              tick="↑"
              tickClass=""
              stocks={data.highs52w}
            />
          )}
          {data.lows52w.length > 0 && (
            <Section
              title="NEAR 52W LOW"
              tick="↓"
              tickClass="down"
              stocks={data.lows52w}
            />
          )}
        </div>
        <AdSlot variant="banner" />
      </div>
      <aside className="rail">
        <AdSlot variant="rail" />
      </aside>
    </div>
  );
}
