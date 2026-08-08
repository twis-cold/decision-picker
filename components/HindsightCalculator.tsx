"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  formatDate,
  formatMoney,
  formatPercent,
  formatPrice,
} from "@/lib/format";
import type { HindsightResponse } from "@/lib/types";
import NewsletterSignup from "./NewsletterSignup";
import ValueChart from "./ValueChart";

/** Renders the result card to a 1200x630 PNG for sharing/screenshots. */
function buildShareImage(r: HindsightResponse): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const up = r.gain >= 0;
  const accent = up ? "#00e08c" : "#ff4d4d";
  const mono = "'JetBrains Mono', monospace";

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = "#e9e9ec";
  ctx.font = `700 26px ${mono}`;
  ctx.fillText("TRENDING·STOCKS", 70, 84);
  ctx.fillStyle = accent;
  ctx.fillRect(345, 62, 12, 24);

  ctx.fillStyle = "#9a9aa2";
  ctx.font = `400 30px ${mono}`;
  ctx.fillText(
    `${formatMoney(r.amountInvested)} in ${r.symbol} on ${formatDate(r.requestedDate)}`,
    70,
    212,
  );

  ctx.fillStyle = "#e9e9ec";
  ctx.font = `700 96px ${mono}`;
  ctx.fillText(`${formatMoney(r.valueNow)}`, 70, 330);
  ctx.fillStyle = "#5f5f68";
  ctx.font = `400 30px ${mono}`;
  ctx.fillText("today", 70, 380);

  ctx.fillStyle = accent;
  ctx.font = `700 54px ${mono}`;
  ctx.fillText(
    `${up ? "▲" : "▼"} ${formatPercent(r.returnPercent)}  (${up ? "+" : "−"}${formatMoney(Math.abs(r.gain)).slice(0)})`,
    70,
    470,
  );

  ctx.fillStyle = "#5f5f68";
  ctx.font = `400 22px ${mono}`;
  ctx.fillText("hindsight is 20/20 · not investment advice", 70, 570);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export default function HindsightCalculator() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [symbol, setSymbol] = useState(searchParams.get("symbol") ?? "");
  const [date, setDate] = useState(searchParams.get("date") ?? "");
  const [amount, setAmount] = useState(searchParams.get("amount") ?? "1000");
  const [result, setResult] = useState<HindsightResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareNote, setShareNote] = useState("");

  const run = useCallback(
    async (sym: string, d: string, amt: string) => {
      if (!sym.trim() || !d || !amt) return;
      setBusy(true);
      setError(null);
      setShareNote("");
      try {
        const qs = new URLSearchParams({
          symbol: sym.trim().toUpperCase(),
          date: d,
          amount: amt,
        });
        const res = await fetch(`/api/hindsight?${qs}`);
        const body = (await res.json()) as HindsightResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Lookup failed.");
        setResult(body);
        router.replace(`/hindsight?${qs}`, { scroll: false });
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
    const a = searchParams.get("amount");
    if (s && d && a && !result && !busy && !error) run(s, d, a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setShareNote("link copied ✓");
  };

  const downloadImage = async () => {
    if (!result) return;
    const blob = await buildShareImage(result);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.symbol}-hindsight.png`;
    a.click();
    URL.revokeObjectURL(url);
    setShareNote("image downloaded ✓");
  };

  const up = result ? result.gain >= 0 : true;

  return (
    <div className="tool-page">
      <h1 className="dash-title">WHAT WOULD I HAVE MADE</h1>
      <p className="tool-intro">
        Pick a ticker, a past date, and an amount — see what that investment
        would be worth today.
      </p>

      <form
        className="tool-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(symbol, date, amount);
        }}
      >
        <label>
          TICKER
          <input
            type="text"
            value={symbol}
            placeholder="AAPL"
            required
            maxLength={12}
            spellCheck={false}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </label>
        <label>
          DATE BOUGHT
          <input
            type="date"
            value={date}
            required
            max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          AMOUNT ($)
          <input
            type="number"
            value={amount}
            min={1}
            max={100000000}
            step="any"
            required
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button type="submit" className="tool-submit" disabled={busy}>
          {busy ? "CALCULATING…" : "CALCULATE"}
        </button>
      </form>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="result-card">
          {result.sampleData && <span className="badge-sample">SAMPLE DATA</span>}
          <p className="result-lede">
            {formatMoney(result.amountInvested)} of{" "}
            <strong>{result.symbol}</strong>
            {result.name ? ` (${result.name})` : ""} bought{" "}
            {formatDate(result.startDate ? new Date(result.startDate).getTime() : result.requestedDate)}{" "}
            at {formatPrice(result.startPrice)} would be worth
          </p>
          <p className={`result-value ${up ? "up" : "down"}`}>
            {formatMoney(result.valueNow)}
          </p>
          <p className={`result-return ${up ? "up" : "down"}`}>
            {up ? "▲" : "▼"} {formatPercent(result.returnPercent)} ·{" "}
            {result.gain >= 0 ? "+" : "−"}
            {formatMoney(Math.abs(result.gain))}
          </p>
          <ValueChart points={result.series} />
          <div className="share-row">
            <button type="button" onClick={copyLink}>
              COPY LINK
            </button>
            <button type="button" onClick={downloadImage}>
              DOWNLOAD IMAGE
            </button>
            {shareNote && <span className="share-note">{shareNote}</span>}
          </div>
          <NewsletterSignup variant="inline" />
        </div>
      )}
    </div>
  );
}
