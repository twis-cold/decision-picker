"use client";

import { useEffect, useState } from "react";
import { formatPercent, formatPrice } from "@/lib/format";
import type { RatingsResponse } from "@/lib/types";

/**
 * Analyst consensus: stacked buy/hold/sell bar + average price target.
 * Green/red here carry buy/sell status semantics (with text labels, never
 * color alone), consistent with the app's gain/loss convention.
 */
export default function Ratings({
  symbol,
  currentPrice,
}: {
  symbol: string;
  currentPrice: number;
}) {
  const [data, setData] = useState<RatingsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ratings/${encodeURIComponent(symbol)}`);
        if (!res.ok) return;
        const body = (await res.json()) as RatingsResponse;
        if (!cancelled) setData(body);
      } catch {
        // Ratings are optional enrichment.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!data || !data.available) return null;

  const segments = [
    { label: "STRONG BUY", n: data.strongBuy, color: "var(--up)" },
    { label: "BUY", n: data.buy, color: "rgba(0,224,140,0.55)" },
    { label: "HOLD", n: data.hold, color: "#5f5f68" },
    { label: "SELL", n: data.sell, color: "rgba(255,77,77,0.55)" },
    { label: "STRONG SELL", n: data.strongSell, color: "var(--down)" },
  ].filter((s) => s.n > 0);
  const total = segments.reduce((a, s) => a + s.n, 0);
  const upside =
    data.targetMean != null && currentPrice > 0
      ? ((data.targetMean - currentPrice) / currentPrice) * 100
      : null;

  return (
    <div className="ratings-block">
      <h2 className="detail-section-title">ANALYST RATINGS</h2>
      {total > 0 && (
        <>
          <div className="ratings-bar" role="img" aria-label={`${total} analyst ratings`}>
            {segments.map((s) => (
              <span
                key={s.label}
                style={{ width: `${(s.n / total) * 100}%`, background: s.color }}
                title={`${s.label}: ${s.n}`}
              />
            ))}
          </div>
          <div className="ratings-legend">
            {segments.map((s) => (
              <span key={s.label} className="legend-item">
                <span className="legend-swatch" style={{ background: s.color }} />
                {s.label} {s.n}
              </span>
            ))}
          </div>
        </>
      )}
      <p className="ratings-target">
        {data.recommendation && (
          <>
            consensus: <strong>{data.recommendation.toUpperCase().replace("_", " ")}</strong>
          </>
        )}
        {data.targetMean != null && (
          <>
            {data.recommendation ? " · " : ""}avg target {formatPrice(data.targetMean)}
            {upside != null && (
              <span className={upside >= 0 ? "up-text" : "down-text"}>
                {" "}({formatPercent(upside)} vs current)
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
}
