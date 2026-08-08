"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatDate, formatPercent, formatPrice } from "@/lib/format";
import type { JumpResponse } from "@/lib/types";
import NewsletterSignup from "./NewsletterSignup";
import NewsList from "./NewsList";
import ValueChart from "./ValueChart";

export default function JumpExplainer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [symbol, setSymbol] = useState(searchParams.get("symbol") ?? "");
  const [date, setDate] = useState(searchParams.get("date") ?? "");
  const [result, setResult] = useState<JumpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (sym: string, d: string) => {
      if (!sym.trim() || !d) return;
      setBusy(true);
      setError(null);
      setLimited(false);
      try {
        const qs = new URLSearchParams({
          symbol: sym.trim().toUpperCase(),
          date: d,
        });
        const res = await fetch(`/api/jump?${qs}`);
        const body = (await res.json()) as JumpResponse & {
          error?: string;
          limit?: boolean;
        };
        if (!res.ok) {
          setLimited(Boolean(body.limit));
          throw new Error(body.error ?? "Lookup failed.");
        }
        setResult(body);
        router.replace(`/jump?${qs}`, { scroll: false });
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : "Lookup failed.");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // Auto-run when arriving via a shared link.
  useEffect(() => {
    const s = searchParams.get("symbol");
    const d = searchParams.get("date");
    if (s && d && !result && !busy && !error) run(s, d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const up = result ? result.changePercent >= 0 : true;

  return (
    <div className="tool-page">
      <h1 className="dash-title">EXPLAIN THE JUMP</h1>
      <p className="tool-intro">
        Enter a ticker and a past date — see how the stock moved that day and
        why, reconstructed from headlines of the time.
      </p>

      <form
        className="tool-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(symbol, date);
        }}
      >
        <label>
          TICKER
          <input
            type="text"
            value={symbol}
            placeholder="TSLA"
            required
            maxLength={12}
            spellCheck={false}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          DATE
          <input
            type="date"
            value={date}
            required
            min="2000-01-01"
            max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button type="submit" className="tool-submit" disabled={busy}>
          {busy ? "DIGGING…" : "EXPLAIN"}
        </button>
      </form>

      {error && (
        <div className="error-box" role="alert">
          {error}
          {limited && (
            <>
              <br />
              <Link className="upgrade-link" href="/pro">
                GO PRO FOR UNLIMITED LOOKUPS →
              </Link>
            </>
          )}
        </div>
      )}

      {result && (
        <div className="result-card">
          {result.sampleData && <span className="badge-sample">SAMPLE DATA</span>}
          <p className="result-lede">
            <strong>{result.symbol}</strong> on {formatDate(result.highlightT)}
            {result.dateShifted &&
              ` (market was closed on ${formatDate(result.requestedDate)} — showing the next trading day)`}
          </p>
          <p className={`result-value ${up ? "up" : "down"}`}>
            {up ? "▲" : "▼"} {formatPercent(result.changePercent)}
          </p>
          <p className="result-return neutral">
            closed at {formatPrice(result.close)} vs{" "}
            {formatPrice(result.previousClose)} the day before
            {result.marketChangePercent != null &&
              ` · S&P 500 that day: ${formatPercent(result.marketChangePercent)}`}
          </p>

          <p className="explain-card">
            <span className="cat">{result.explanation.category}</span>
            {result.explanation.text}
          </p>

          <ValueChart
            points={result.series.map((p) => ({ t: p.t, v: p.c }))}
            money={false}
            highlightT={result.highlightT}
          />

          {result.items.length > 0 && (
            <>
              <h2 className="detail-section-title">HEADLINES FROM THAT PERIOD</h2>
              <NewsList items={result.items} />
            </>
          )}
          {result.provider === "none" && (
            <p className="news-provider">
              No headline archive available — add a Finnhub API key to pull
              historical news (free tier covers roughly the last year).
            </p>
          )}

          {result.remaining != null && (
            <p className="quota-note">
              {result.remaining} free lookup{result.remaining === 1 ? "" : "s"}{" "}
              left today · <Link href="/pro">go Pro for unlimited</Link>
            </p>
          )}

          <NewsletterSignup variant="inline" />
        </div>
      )}
    </div>
  );
}
