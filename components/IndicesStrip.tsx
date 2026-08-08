"use client";

import { formatPercent } from "@/lib/format";
import type { IndicesResponse } from "@/lib/types";
import { usePoll } from "./usePoll";

/** Compact market indices bar shown under the nav on every page. */
export default function IndicesStrip() {
  const { data } = usePoll<IndicesResponse>("/api/indices", 60_000);
  if (!data || data.indices.length === 0) return null;

  return (
    <div className="indices-strip" aria-label="Market indices">
      <div className="container indices-row">
        {data.indices.map((idx) => {
          const up = idx.changePercent >= 0;
          return (
            <span key={idx.symbol} className="index-item">
              <span className="index-label">{idx.label}</span>
              <span className="index-value">
                {idx.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </span>
              <span className={`chip ${up ? "up" : "down"}`}>
                {up ? "▲" : "▼"} {formatPercent(idx.changePercent)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
