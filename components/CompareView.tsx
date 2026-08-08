"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { CompareResponse } from "@/lib/types";
import MultiLineChart, { SERIES_COLORS } from "./MultiLineChart";

const RANGES: { label: string; days: number }[] = [
  { label: "1M", days: 30 },
  { label: "6M", days: 182 },
  { label: "1Y", days: 365 },
  { label: "5Y", days: 5 * 365 },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function CompareView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = (searchParams.get("symbols") ?? "").split(",").filter(Boolean);

  const [inputs, setInputs] = useState<string[]>([
    initial[0] ?? "",
    initial[1] ?? "",
    initial[2] ?? "",
  ]);
  const [range, setRange] = useState("1Y");
  const [customFrom, setCustomFrom] = useState(
    searchParams.get("from") ?? isoDaysAgo(365),
  );
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fromDate =
    range === "CUSTOM"
      ? customFrom
      : isoDaysAgo(RANGES.find((r) => r.label === range)?.days ?? 365);

  const run = useCallback(
    async (symbols: string[], from: string) => {
      const clean = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (clean.length < 2 || !from) return;
      setBusy(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ symbols: clean.join(","), from });
        const res = await fetch(`/api/compare?${qs}`);
        const body = (await res.json()) as CompareResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Comparison failed.");
        setResult(body);
        router.replace(`/compare?${qs}`, { scroll: false });
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : "Comparison failed.");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // Auto-run from a shared link.
  useEffect(() => {
    const syms = (searchParams.get("symbols") ?? "").split(",").filter(Boolean);
    const from = searchParams.get("from");
    if (syms.length >= 2 && from && !result && !busy && !error) {
      setRange("CUSTOM");
      setCustomFrom(from);
      run(syms, from);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run automatically when the range changes on an existing comparison.
  const pickRange = (label: string) => {
    setRange(label);
    if (result) {
      const from =
        label === "CUSTOM"
          ? customFrom
          : isoDaysAgo(RANGES.find((r) => r.label === label)?.days ?? 365);
      run(inputs, from);
    }
  };

  return (
    <div className="tool-page compare-page">
      <h1 className="dash-title">COMPARE</h1>
      <p className="tool-intro">
        $100 into each ticker on the same day — one chart, head to head.
      </p>

      <form
        className="tool-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(inputs, fromDate);
        }}
      >
        {inputs.map((value, i) => (
          <label key={i}>
            {`TICKER ${i + 1}${i === 2 ? " (OPT.)" : ""}`}
            <input
              type="text"
              value={value}
              placeholder={["NVDA", "AMD", "INTC"][i]}
              required={i < 2}
              maxLength={12}
              spellCheck={false}
              onChange={(e) => {
                const next = [...inputs];
                next[i] = e.target.value.toUpperCase();
                setInputs(next);
              }}
            />
          </label>
        ))}
        <button type="submit" className="tool-submit" disabled={busy}>
          {busy ? "COMPARING…" : "COMPARE"}
        </button>
      </form>

      <div className="range-toggle" role="group" aria-label="Comparison range">
        {[...RANGES.map((r) => r.label), "CUSTOM"].map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={label === range}
            onClick={() => pickRange(label)}
          >
            {label}
          </button>
        ))}
        {range === "CUSTOM" && (
          <input
            type="date"
            className="custom-date"
            value={customFrom}
            max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              if (result && e.target.value) run(inputs, e.target.value);
            }}
          />
        )}
      </div>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="result-card">
          {result.sampleData && <span className="badge-sample">SAMPLE DATA</span>}
          <p className="result-lede">
            {formatMoney(100)} into each on {formatDate(result.startDate ? new Date(result.startDate).getTime() : result.from)}
          </p>

          <div className="legend-row" aria-hidden="true">
            {result.series.map((s, i) => (
              <span key={s.symbol} className="legend-item">
                <span
                  className="legend-swatch"
                  style={{ background: SERIES_COLORS[i] }}
                />
                {s.symbol}
              </span>
            ))}
          </div>

          <MultiLineChart series={result.series} />

          <table className="compare-table">
            <thead>
              <tr>
                <th>TICKER</th>
                <th>START</th>
                <th>NOW</th>
                <th>RETURN</th>
              </tr>
            </thead>
            <tbody>
              {result.series.map((s, i) => {
                const up = s.returnPercent >= 0;
                return (
                  <tr key={s.symbol}>
                    <td>
                      <span
                        className="legend-swatch"
                        style={{ background: SERIES_COLORS[i] }}
                      />
                      {s.symbol}
                    </td>
                    <td>{formatMoney(100)}</td>
                    <td>{formatMoney(s.endValue)}</td>
                    <td className={up ? "up" : "down"}>
                      {up ? "▲" : "▼"} {formatPercent(s.returnPercent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
