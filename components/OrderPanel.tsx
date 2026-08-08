"use client";

import { useState } from "react";
import { formatMoney, formatPrice } from "@/lib/format";
import { usePaper } from "./PaperProvider";

/**
 * Simulated order form. Everything here is PAPER ONLY — fake cash against
 * the site's delayed quotes. No real order is ever routed anywhere.
 */
export default function OrderPanel({
  symbol,
  price,
}: {
  symbol: string;
  price: number;
}) {
  const { paper, trade, placeOrder } = usePaper();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [kind, setKind] = useState<"market" | "limit" | "stop">("market");
  const [shares, setShares] = useState("10");
  const [trigger, setTrigger] = useState("");
  const [gtc, setGtc] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const held = paper.holdings[symbol]?.shares ?? 0;
  const shareCount = Number.parseFloat(shares);
  const estCost = Number.isFinite(shareCount) ? shareCount * price : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!(shareCount > 0)) {
      setMessage({ ok: false, text: "Enter a valid share count." });
      return;
    }
    if (kind === "market") {
      const error = trade(side, symbol, shareCount, price);
      setMessage(
        error
          ? { ok: false, text: error }
          : {
              ok: true,
              text: `Simulated ${side} of ${shareCount} ${symbol} filled @ ${formatPrice(price)} — paper money only, no real trade occurred.`,
            },
      );
      return;
    }
    const triggerPrice = Number.parseFloat(trigger);
    if (!(triggerPrice > 0)) {
      setMessage({ ok: false, text: `Enter a ${kind === "stop" ? "stop" : "limit"} price.` });
      return;
    }
    if (kind === "stop" && side === "buy") {
      setMessage({ ok: false, text: "Stop-loss is a sell-side order here — switch to SELL." });
      return;
    }
    // Marketable limit orders fill immediately at the current quote.
    const marketable =
      kind === "limit" &&
      (side === "buy" ? price <= triggerPrice : price >= triggerPrice);
    if (marketable) {
      const error = trade(side, symbol, shareCount, price);
      setMessage(
        error
          ? { ok: false, text: error }
          : {
              ok: true,
              text: `Limit was marketable — simulated ${side} filled @ ${formatPrice(price)}. Paper money only.`,
            },
      );
      return;
    }
    placeOrder({ symbol, side, kind, triggerPrice, shares: shareCount, gtc });
    setMessage({
      ok: true,
      text: `${kind === "stop" ? "Stop-loss" : "Limit"} order placed (${gtc ? "GTC" : "day only"}) — simulated; it fills if the delayed quote crosses ${formatPrice(triggerPrice)} while the app is open.`,
    });
  };

  const openForSymbol = paper.orders.filter((o) => o.symbol === symbol);

  return (
    <div className="order-panel">
      <div className="order-head">
        <h2 className="detail-section-title" style={{ margin: 0 }}>
          TRADE (SIMULATED)
        </h2>
        <span className="paper-badge">PAPER — NOT REAL MONEY</span>
      </div>
      <form className="order-form" onSubmit={submit}>
        <div className="range-toggle" role="group" aria-label="Side">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="range-toggle" role="group" aria-label="Order type">
          {(["market", "limit", "stop"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              title={k === "stop" ? "Stop-loss (sell when price drops to trigger)" : undefined}
            >
              {k === "stop" ? "STOP-LOSS" : k.toUpperCase()}
            </button>
          ))}
        </div>
        <label className="order-field">
          SHARES
          <input
            type="number"
            min="0.0001"
            step="any"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
          />
        </label>
        {kind !== "market" && (
          <label className="order-field">
            {kind === "stop" ? "STOP PRICE" : "LIMIT PRICE"}
            <input
              type="number"
              min="0.01"
              step="any"
              value={trigger}
              placeholder={formatPrice(price)}
              onChange={(e) => setTrigger(e.target.value)}
            />
          </label>
        )}
        {kind !== "market" && (
          <label className="order-gtc">
            <input type="checkbox" checked={gtc} onChange={(e) => setGtc(e.target.checked)} />
            GTC
          </label>
        )}
        <button type="submit" className="tool-submit">
          {side === "buy" ? "BUY" : "SELL"} {symbol}
        </button>
      </form>
      <p className="order-meta">
        est. {side === "buy" ? "cost" : "proceeds"} {formatMoney(estCost)} · cash{" "}
        {formatMoney(paper.cash)} · holding {held > 0 ? `${held} sh` : "none"}
      </p>
      {message && (
        <p className={`upgrade-banner ${message.ok ? "ok" : "err"}`}>{message.text}</p>
      )}
      {openForSymbol.length > 0 && (
        <p className="order-meta">
          {openForSymbol.length} open simulated order
          {openForSymbol.length > 1 ? "s" : ""} on {symbol} — manage on the{" "}
          <a href="/portfolio">portfolio page</a>.
        </p>
      )}
    </div>
  );
}
