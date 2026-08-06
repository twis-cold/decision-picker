"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";
import type { NewsResponse } from "@/lib/types";

/**
 * The expandable "why is this moving" content under a stock card:
 * a heuristic explanation plus the headlines it was derived from.
 * Fetched lazily — only when the user expands the panel.
 */
export default function WhyPanel({
  symbol,
  changePercent,
}: {
  symbol: string;
  changePercent: number;
}) {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/news/${encodeURIComponent(symbol)}?change=${changePercent.toFixed(2)}`,
        );
        const body = (await res.json()) as NewsResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to load news");
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load news");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, changePercent]);

  if (error) return <div className="why-panel">{error}</div>;
  if (!data) return <div className="why-panel">Reading recent headlines…</div>;

  return (
    <div className="why-panel">
      <p className="explanation">
        <span className="cat">{data.explanation.category}</span>
        {data.explanation.text}
      </p>
      {data.items.slice(0, 3).map((n) => (
        <a
          key={n.id}
          className="headline"
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="headline-title">{n.title}</span>
          <span className="headline-meta">
            {n.source} · {timeAgo(n.publishedAt)}
          </span>
        </a>
      ))}
    </div>
  );
}
