"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPercent } from "@/lib/format";
import type { SparkResponse, StockSummary } from "@/lib/types";
import PriceTicker from "./PriceTicker";
import Sparkline from "./Sparkline";
import WhyPanel from "./WhyPanel";

export default function StockCard({ stock }: { stock: StockSummary }) {
  const [spark, setSpark] = useState<SparkResponse | null>(null);
  const [open, setOpen] = useState(false);
  const up = stock.changePercent >= 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/spark/${encodeURIComponent(stock.symbol)}`);
        if (!res.ok) return;
        const body = (await res.json()) as SparkResponse;
        if (!cancelled) setSpark(body);
      } catch {
        // Sparkline is decorative — the card works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stock.symbol]);

  return (
    <div className="card">
      <Link
        className="card-main"
        href={`/stock/${encodeURIComponent(stock.symbol)}`}
      >
        <div className="card-id">
          <span className="ticker">{stock.symbol}</span>
          <span className="name">{stock.name}</span>
        </div>
        <Sparkline
          points={spark?.points ?? []}
          previousClose={spark?.previousClose ?? null}
          up={up}
        />
        <div className="card-nums">
          <PriceTicker value={stock.price} />
          <span className={`chip ${up ? "up" : "down"}`}>
            {up ? "▲" : "▼"} {formatPercent(stock.changePercent)}
          </span>
        </div>
      </Link>
      <button
        type="button"
        className="why-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="arrow" aria-hidden="true">
          ▶
        </span>
        WHY IS THIS MOVING
      </button>
      {open && (
        <WhyPanel symbol={stock.symbol} changePercent={stock.changePercent} />
      )}
    </div>
  );
}
