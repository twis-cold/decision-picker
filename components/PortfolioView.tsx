"use client";

import Link from "next/link";
import { useState } from "react";
import {
  formatDate,
  formatMoney,
  formatPercent,
  formatPrice,
} from "@/lib/format";
import { STARTING_CASH, txnsForPerformance } from "@/lib/paper";
import type { PaperPerformanceResponse, QuotesResponse } from "@/lib/types";
import AllocationDonut from "./AllocationDonut";
import { useApp } from "./AppProviders";
import MultiLineChart from "./MultiLineChart";
import { usePaper } from "./PaperProvider";
import { usePoll } from "./usePoll";

export default function PortfolioView() {
  const { pro } = useApp();
  const { paper, cancelOrder, resetPaper } = usePaper();
  const symbols = Object.keys(paper.holdings);
  const { data: quotesData } = usePoll<QuotesResponse>(
    `/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`,
    pro ? 30_000 : 60_000,
  );
  const [perf, setPerf] = useState<PaperPerformanceResponse | null>(null);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [perfBusy, setPerfBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const quotes = new Map(
    (quotesData?.quotes ?? []).map((q) => [q.symbol, q]),
  );

  let holdingsValue = 0;
  let dayPnl = 0;
  let costBasis = 0;
  const rows = symbols.map((symbol) => {
    const holding = paper.holdings[symbol];
    const quote = quotes.get(symbol);
    const price = quote?.price ?? holding.cost / holding.shares;
    const value = holding.shares * price;
    holdingsValue += value;
    costBasis += holding.cost;
    if (quote) dayPnl += holding.shares * quote.change;
    return {
      symbol,
      shares: holding.shares,
      avgCost: holding.cost / holding.shares,
      price,
      value,
      unrealized: value - holding.cost,
      changePercent: quote?.changePercent ?? 0,
    };
  });
  const totalValue = paper.cash + holdingsValue;
  const unrealized = holdingsValue - costBasis;

  const loadPerformance = async () => {
    setPerfBusy(true);
    setPerfError(null);
    try {
      const res = await fetch("/api/paper/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: txnsForPerformance(paper),
          initialCash: STARTING_CASH,
        }),
      });
      const body = (await res.json()) as PaperPerformanceResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load performance.");
      setPerf(body);
    } catch (err) {
      setPerfError(err instanceof Error ? err.message : "Failed to load performance.");
    } finally {
      setPerfBusy(false);
    }
  };

  return (
    <div>
      <div className="dash-meta">
        <h1 className="dash-title">PORTFOLIO</h1>
        <span className="paper-badge">PAPER TRADING — NOT REAL MONEY</span>
        {quotesData?.sampleData && <span className="badge-sample">SAMPLE DATA</span>}
      </div>

      <div className="portfolio-summary">
        <div className="stat">
          <dt>TOTAL VALUE</dt>
          <dd>{formatMoney(totalValue)}</dd>
        </div>
        <div className="stat">
          <dt>CASH</dt>
          <dd>{formatMoney(paper.cash)}</dd>
        </div>
        <div className="stat">
          <dt>DAY P&L</dt>
          <dd className={dayPnl >= 0 ? "up-text" : "down-text"}>
            {dayPnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(dayPnl))}
          </dd>
        </div>
        <div className="stat">
          <dt>UNREALIZED</dt>
          <dd className={unrealized >= 0 ? "up-text" : "down-text"}>
            {unrealized >= 0 ? "+" : "−"}{formatMoney(Math.abs(unrealized))}
          </dd>
        </div>
        <div className="stat">
          <dt>TOTAL RETURN</dt>
          <dd className={totalValue >= STARTING_CASH ? "up-text" : "down-text"}>
            {formatPercent(((totalValue - STARTING_CASH) / STARTING_CASH) * 100)}
          </dd>
        </div>
      </div>

      {rows.length === 0 && paper.txns.length === 0 ? (
        <p className="tool-intro">
          You have {formatMoney(paper.cash)} of simulated cash. Open any{" "}
          <Link href="/">stock page</Link> and use the TRADE panel to place
          your first paper order.
        </p>
      ) : (
        <>
          {rows.length > 0 && (
            <div className="portfolio-cols">
              <div className="table-scroll">
                <table className="fin-table holdings-table">
                  <thead>
                    <tr>
                      <th>TICKER</th>
                      <th>SHARES</th>
                      <th>AVG COST</th>
                      <th>PRICE</th>
                      <th>VALUE</th>
                      <th>UNRLZD</th>
                      <th>TODAY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.symbol}>
                        <td>
                          <Link href={`/stock/${encodeURIComponent(r.symbol)}`} className="ticker" style={{ textDecoration: "none" }}>
                            {r.symbol}
                          </Link>
                        </td>
                        <td>{r.shares.toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                        <td>{formatPrice(r.avgCost)}</td>
                        <td>{formatPrice(r.price)}</td>
                        <td>{formatMoney(r.value)}</td>
                        <td className={r.unrealized >= 0 ? "up-text" : "down-text"}>
                          {r.unrealized >= 0 ? "+" : "−"}{formatMoney(Math.abs(r.unrealized))}
                        </td>
                        <td className={r.changePercent >= 0 ? "up-text" : "down-text"}>
                          {formatPercent(r.changePercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AllocationDonut
                holdings={rows.map((r) => ({ label: r.symbol, value: r.value }))}
                cash={paper.cash}
              />
            </div>
          )}

          {paper.orders.length > 0 && (
            <>
              <h2 className="detail-section-title">OPEN ORDERS (SIMULATED)</h2>
              {paper.orders.map((o) => (
                <p key={o.id} className="order-row">
                  <span className="ticker">{o.symbol}</span>
                  <span>
                    {o.side.toUpperCase()} {o.shares} @ {o.kind === "stop" ? "stop" : "limit"}{" "}
                    {formatPrice(o.triggerPrice)} · {o.gtc ? "GTC" : "day"}
                  </span>
                  <button type="button" onClick={() => cancelOrder(o.id)}>CANCEL</button>
                </p>
              ))}
            </>
          )}

          <h2 className="detail-section-title">PERFORMANCE VS S&P 500</h2>
          {perf ? (
            <>
              <div className="legend-row" aria-hidden="true">
                {perf.series.map((s, i) => (
                  <span key={s.symbol} className="legend-item">
                    <span className="legend-swatch" style={{ background: ["#1a9db3", "#ab8526"][i] }} />
                    {s.symbol} {formatPercent(s.returnPercent)}
                  </span>
                ))}
              </div>
              <MultiLineChart series={perf.series} height={260} />
            </>
          ) : (
            <p className="tool-intro">
              {perfError ?? "Chart your simulated returns against the S&P 500 from your first trade."}{" "}
              <button type="button" className="tool-submit ghost" onClick={loadPerformance} disabled={perfBusy || paper.txns.length === 0}>
                {perfBusy ? "LOADING…" : "LOAD CHART"}
              </button>
            </p>
          )}

          <h2 className="detail-section-title">TRANSACTION HISTORY (SIMULATED)</h2>
          {paper.txns.length === 0 ? (
            <p className="tool-intro">No simulated trades yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>WHEN</th>
                    <th>SIDE</th>
                    <th>TICKER</th>
                    <th>SHARES</th>
                    <th>PRICE</th>
                    <th>TOTAL</th>
                    <th>TYPE</th>
                  </tr>
                </thead>
                <tbody>
                  {paper.txns.slice(0, 50).map((t) => (
                    <tr key={t.id}>
                      <td>{formatDate(new Date(t.at).getTime())}{" "}
                        <span className="headline-meta" style={{ display: "inline" }}>
                          {new Date(t.at).toLocaleTimeString("en-US", { hour12: false })}
                        </span>
                      </td>
                      <td className={t.side === "buy" ? "up-text" : "down-text"}>{t.side.toUpperCase()}</td>
                      <td>{t.symbol}</td>
                      <td>{t.shares}</td>
                      <td>{formatPrice(t.price)}</td>
                      <td>{formatMoney(t.total)}</td>
                      <td>{t.kind.toUpperCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="fine-print">
            All positions, orders, and P&amp;L on this page are simulated with
            paper money against delayed quotes. Nothing here is a real
            brokerage account or investment advice.{" "}
            {confirmReset ? (
              <>
                Reset wipes all simulated holdings and history —{" "}
                <button type="button" className="link-btn" onClick={() => { resetPaper(); setConfirmReset(false); }}>
                  confirm reset
                </button>{" "}
                ·{" "}
                <button type="button" className="link-btn" onClick={() => setConfirmReset(false)}>
                  keep
                </button>
              </>
            ) : (
              <button type="button" className="link-btn" onClick={() => setConfirmReset(true)}>
                Reset paper portfolio
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}
