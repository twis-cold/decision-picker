"use client";

import { useEffect, useState } from "react";
import { formatDate, formatPrice } from "@/lib/format";
import type { OptionsResponse } from "@/lib/types";

/**
 * Minimal near-term options chain: nearest expiration, strikes around the
 * money, last/bid/ask only — deliberately no greeks or IV modeling.
 */
export default function OptionsChain({ symbol }: { symbol: string }) {
  const [data, setData] = useState<OptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/options/${encodeURIComponent(symbol)}`);
        if (!res.ok) return;
        const body = (await res.json()) as OptionsResponse;
        if (!cancelled) setData(body);
      } catch {
        // handled by the not-available message below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (loading) return <div className="skeleton" style={{ height: 180 }} />;
  if (!data || !data.available) {
    return (
      <p className="tool-intro">
        No options chain available for this symbol.
      </p>
    );
  }

  const strikes = [...new Set([...data.calls, ...data.puts].map((c) => c.strike))].sort(
    (a, b) => a - b,
  );
  const bySide = (side: "calls" | "puts", strike: number) =>
    data[side].find((c) => c.strike === strike);

  return (
    <div>
      <p className="tool-intro" style={{ marginBottom: 12 }}>
        Nearest expiration{data.expiration ? `: ${formatDate(data.expiration)}` : ""} ·
        last / bid / ask per contract
      </p>
      <div className="table-scroll">
        <table className="fin-table options-table">
          <thead>
            <tr>
              <th colSpan={3} className="side-head">CALLS</th>
              <th className="strike-head">STRIKE</th>
              <th colSpan={3} className="side-head">PUTS</th>
            </tr>
            <tr>
              <th>LAST</th>
              <th>BID</th>
              <th>ASK</th>
              <th className="strike-head" />
              <th>LAST</th>
              <th>BID</th>
              <th>ASK</th>
            </tr>
          </thead>
          <tbody>
            {strikes.map((strike) => {
              const call = bySide("calls", strike);
              const put = bySide("puts", strike);
              return (
                <tr key={strike}>
                  <td>{call ? formatPrice(call.last) : "—"}</td>
                  <td>{call ? formatPrice(call.bid) : "—"}</td>
                  <td>{call ? formatPrice(call.ask) : "—"}</td>
                  <td className="strike-cell">{formatPrice(strike)}</td>
                  <td>{put ? formatPrice(put.last) : "—"}</td>
                  <td>{put ? formatPrice(put.bid) : "—"}</td>
                  <td>{put ? formatPrice(put.ask) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fine-print">
        Reference data only — options cannot be traded here, even on paper.
      </p>
    </div>
  );
}
