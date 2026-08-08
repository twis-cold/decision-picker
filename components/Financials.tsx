"use client";

import { useEffect, useState } from "react";
import { formatCompact } from "@/lib/format";
import type { FinancialsResponse, StatementType } from "@/lib/types";

const STATEMENTS: { id: StatementType; label: string }[] = [
  { id: "ic", label: "INCOME" },
  { id: "bs", label: "BALANCE SHEET" },
  { id: "cf", label: "CASH FLOW" },
];

// TODO: earnings call transcripts are not available on Finnhub's free tier;
// adding them would require a paid plan or a separate provider.
export default function Financials({ symbol }: { symbol: string }) {
  const [freq, setFreq] = useState<"quarterly" | "annual">("quarterly");
  const [statement, setStatement] = useState<StatementType>("ic");
  const [data, setData] = useState<FinancialsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/financials/${encodeURIComponent(symbol)}?freq=${freq}&statement=${statement}`,
        );
        const body = (await res.json()) as FinancialsResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to load financials.");
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load financials.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, freq, statement]);

  return (
    <div>
      <div className="chart-controls">
        <div className="range-toggle" role="group" aria-label="Statement">
          {STATEMENTS.map((s) => (
            <button key={s.id} type="button" aria-pressed={statement === s.id} onClick={() => setStatement(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="range-toggle" role="group" aria-label="Frequency">
          {(["quarterly", "annual"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={freq === f} onClick={() => setFreq(f)}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="skeleton" style={{ height: 200 }} />}
      {error && <div className="error-box">{error}</div>}
      {data?.needsKey && (
        <div className="error-box">
          Financial statements need a (free) Finnhub API key — add{" "}
          <code>FINNHUB_API_KEY</code> to your environment (see README).
          Free-tier note: history depth is limited; deeper archives need a
          paid plan.
        </div>
      )}
      {data && !data.needsKey && !loading && data.rows.length === 0 && (
        <p className="tool-intro">No reported data found for this company.</p>
      )}
      {data && data.rows.length > 0 && (
        <div className="table-scroll">
          <table className="fin-table">
            <thead>
              <tr>
                <th>{data.sampleData ? "LINE ITEM (SAMPLE)" : "LINE ITEM"}</th>
                {data.periods.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.label}>
                  <td className="fin-label">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className={v != null && v < 0 ? "down-text" : ""}>
                      {v != null ? formatCompact(v) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && !data.needsKey && (
        <p className="fine-print">
          As-reported figures via Finnhub; labels follow each company&rsquo;s own
          filings. Values in USD unless the filing says otherwise.
        </p>
      )}
    </div>
  );
}
