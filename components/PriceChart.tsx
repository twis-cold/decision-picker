"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { bollinger, ema, macd, rsi, sma } from "@/lib/indicators";
import type { ChartRange, ChartResponse } from "@/lib/types";
import { usePoll } from "./usePoll";

const RANGES: ChartRange[] = ["1D", "1W", "1M", "1Y", "5Y", "MAX"];

type ChartType = "line" | "candle" | "bar";
type Indicator = "SMA" | "EMA" | "BB" | "RSI" | "MACD";

const INDICATORS: Indicator[] = ["SMA", "EMA", "BB", "RSI", "MACD"];

// Validated cyan/amber/violet trio (same as the compare view) — never
// green/red, which are reserved for price direction.
const IND_COLOR: Record<"SMA" | "EMA" | "BB", string> = {
  SMA: "#1a9db3",
  EMA: "#ab8526",
  BB: "#8d70e8",
};

const PAD = { top: 12, right: 62, bottom: 24, left: 8 };
const SUB_H = 92;

function formatTick(t: number, range: ChartRange): string {
  const d = new Date(t);
  if (range === "1D") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false });
  }
  if (range === "1W") {
    return d.toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: false });
  }
  if (range === "1M") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatTooltipTime(t: number, range: ChartRange): string {
  const d = new Date(t);
  if (range === "1D" || range === "1W") {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: false });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Line path through non-null values aligned to xs/ys. */
function linePath(
  values: (number | null)[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string {
  let d = "";
  let pen = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

export default function PriceChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>("1D");
  const [ctype, setCtype] = useState<ChartType>("line");
  const [inds, setInds] = useState<Indicator[]>([]);
  const { data, error, loading, reload } = usePoll<ChartResponse>(
    `/api/chart/${encodeURIComponent(symbol)}?range=${range}`,
    2 * 60_000,
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(() => data?.points ?? [], [data]);
  const closes = useMemo(() => points.map((p) => p.c), [points]);
  const hasOHLC = points.length > 0 && points.every((p) => p.o != null);

  const overlays = useMemo(() => {
    if (closes.length === 0) return null;
    return {
      sma: inds.includes("SMA") ? sma(closes, 20) : null,
      ema: inds.includes("EMA") ? ema(closes, 20) : null,
      bb: inds.includes("BB") ? bollinger(closes, 20, 2) : null,
      rsi: inds.includes("RSI") ? rsi(closes, 14) : null,
      macd: inds.includes("MACD") ? macd(closes) : null,
    };
  }, [closes, inds]);

  const { w, h } = size;
  const plotW = Math.max(0, w - PAD.left - PAD.right);
  const plotH = Math.max(0, h - PAD.top - PAD.bottom);
  const ready = points.length >= 2 && plotW > 0 && plotH > 0;

  const toggleInd = (ind: Indicator) =>
    setInds((cur) => (cur.includes(ind) ? cur.filter((i) => i !== ind) : [...cur, ind]));

  let mainSvg: React.ReactNode = null;
  let tooltip: React.ReactNode = null;
  let subPanels: React.ReactNode = null;

  if (ready && data) {
    const showPrevClose = range === "1D" && data.previousClose != null;
    const domain: number[] = [];
    for (const p of points) {
      domain.push(p.c);
      if (ctype !== "line" && p.h != null && p.l != null) domain.push(p.h, p.l);
    }
    if (showPrevClose) domain.push(data.previousClose as number);
    if (overlays?.bb) {
      for (const v of overlays.bb.upper) if (v != null) domain.push(v);
      for (const v of overlays.bb.lower) if (v != null) domain.push(v);
    }
    let min = Math.min(...domain);
    let max = Math.max(...domain);
    if (max === min) {
      max += 0.5;
      min -= 0.5;
    }
    const padY = (max - min) * 0.06;
    min -= padY;
    max += padY;

    const n = points.length;
    const xAt = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * plotW;
    const yAt = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

    const reference = showPrevClose ? (data.previousClose as number) : points[0].c;
    const up = points[n - 1].c >= reference;
    const color = up ? "var(--up)" : "var(--down)";

    const gridValues = Array.from({ length: 4 }, (_, i) => min + ((i + 0.5) / 4) * (max - min));
    const tickIdx = [0, Math.floor((n - 1) / 2), n - 1];
    const hovered = hover != null ? points[hover] : null;
    const candleW = Math.max(1.2, Math.min(9, (plotW / n) * 0.65));

    mainSvg = (
      <svg
        width={w}
        height={h}
        role="img"
        aria-label={`${symbol} ${range} price chart`}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientX - rect.left - PAD.left) / plotW;
          const i = Math.round(frac * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={yAt(v)} x2={PAD.left + plotW} y2={yAt(v)} stroke="#17171b" strokeWidth="1" />
            <text x={w - 6} y={yAt(v) + 3.5} textAnchor="end" fill="#5f5f68" fontSize="10.5" fontFamily="var(--mono)">
              {formatPrice(v)}
            </text>
          </g>
        ))}

        {showPrevClose && (
          <line
            x1={PAD.left}
            y1={yAt(reference)}
            x2={PAD.left + plotW}
            y2={yAt(reference)}
            stroke="#4a4a52"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        )}

        {/* Bollinger band fill under everything else */}
        {overlays?.bb && (
          <>
            <path
              d={(() => {
                const upperPath = linePath(overlays.bb.upper, xAt, yAt);
                const lowerRev = overlays.bb.lower
                  .map((v, i) => ({ v, i }))
                  .filter((x) => x.v != null)
                  .reverse()
                  .map((x, j) => `${j === 0 ? "L" : "L"}${xAt(x.i).toFixed(1)},${yAt(x.v as number).toFixed(1)}`)
                  .join("");
                return upperPath && lowerRev ? `${upperPath}${lowerRev}Z` : "";
              })()}
              fill={IND_COLOR.BB}
              opacity="0.07"
            />
            <path d={linePath(overlays.bb.upper, xAt, yAt)} fill="none" stroke={IND_COLOR.BB} strokeWidth="1" opacity="0.7" />
            <path d={linePath(overlays.bb.lower, xAt, yAt)} fill="none" stroke={IND_COLOR.BB} strokeWidth="1" opacity="0.7" />
            <path d={linePath(overlays.bb.middle, xAt, yAt)} fill="none" stroke={IND_COLOR.BB} strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
          </>
        )}

        {/* Price */}
        {ctype === "line" && (
          <>
            <path
              d={`${linePath(closes, xAt, yAt)}L${xAt(n - 1).toFixed(1)},${PAD.top + plotH}L${PAD.left},${PAD.top + plotH}Z`}
              fill={`url(#${gradientId})`}
            />
            <path d={linePath(closes, xAt, yAt)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {ctype !== "line" &&
          hasOHLC &&
          points.map((p, i) => {
            const upBar = p.c >= (p.o as number);
            const barColor = upBar ? "var(--up)" : "var(--down)";
            const cx = xAt(i);
            return (
              <g key={p.t} stroke={barColor} strokeWidth="1.2">
                <line x1={cx} y1={yAt(p.h as number)} x2={cx} y2={yAt(p.l as number)} />
                {ctype === "candle" ? (
                  <rect
                    x={cx - candleW / 2}
                    y={Math.min(yAt(p.o as number), yAt(p.c))}
                    width={candleW}
                    height={Math.max(1, Math.abs(yAt(p.o as number) - yAt(p.c)))}
                    fill={upBar ? "var(--bg)" : barColor}
                    strokeWidth="1.2"
                  />
                ) : (
                  <>
                    <line x1={cx - candleW / 2} y1={yAt(p.o as number)} x2={cx} y2={yAt(p.o as number)} />
                    <line x1={cx} y1={yAt(p.c)} x2={cx + candleW / 2} y2={yAt(p.c)} />
                  </>
                )}
              </g>
            );
          })}

        {/* Moving averages on top of price */}
        {overlays?.sma && <path d={linePath(overlays.sma, xAt, yAt)} fill="none" stroke={IND_COLOR.SMA} strokeWidth="1.4" />}
        {overlays?.ema && <path d={linePath(overlays.ema, xAt, yAt)} fill="none" stroke={IND_COLOR.EMA} strokeWidth="1.4" />}

        {tickIdx.map((i, k) => (
          <text
            key={k}
            x={xAt(i)}
            y={h - 6}
            textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
            fill="#5f5f68"
            fontSize="10.5"
            fontFamily="var(--mono)"
          >
            {formatTick(points[i].t, range)}
          </text>
        ))}

        {hovered && (
          <g>
            <line x1={xAt(hover as number)} y1={PAD.top} x2={xAt(hover as number)} y2={PAD.top + plotH} stroke="#3a3a42" strokeWidth="1" />
            <circle cx={xAt(hover as number)} cy={yAt(hovered.c)} r="3.5" fill={color} stroke="var(--bg)" strokeWidth="2" />
          </g>
        )}
      </svg>
    );

    if (hovered) {
      tooltip = (
        <div className="chart-tooltip" style={{ left: Math.max(70, Math.min(w - 70, xAt(hover as number))), top: 0 }}>
          {ctype !== "line" && hovered.o != null ? (
            <>
              O {formatPrice(hovered.o)} · H {formatPrice(hovered.h)} · L {formatPrice(hovered.l)} · C {formatPrice(hovered.c)}
            </>
          ) : (
            formatPrice(hovered.c)
          )}
          <span className="tt-time">{formatTooltipTime(hovered.t, range)}</span>
        </div>
      );
    }

    // ── RSI / MACD sub-panels (standard: below the price chart) ──────────
    const subs: React.ReactNode[] = [];
    const subPlotH = SUB_H - 20;
    if (overlays?.rsi) {
      const yR = (v: number) => 8 + (1 - v / 100) * subPlotH;
      subs.push(
        <div className="sub-panel" key="rsi">
          <span className="sub-label">RSI 14</span>
          <svg width={w} height={SUB_H}>
            {[30, 70].map((lvl) => (
              <line key={lvl} x1={PAD.left} y1={yR(lvl)} x2={PAD.left + plotW} y2={yR(lvl)} stroke="#26262c" strokeWidth="1" strokeDasharray="2 3" />
            ))}
            <path d={linePath(overlays.rsi, xAt, yR)} fill="none" stroke={IND_COLOR.SMA} strokeWidth="1.4" />
            <text x={w - 6} y={yR(70) + 3} textAnchor="end" fill="#5f5f68" fontSize="9.5" fontFamily="var(--mono)">70</text>
            <text x={w - 6} y={yR(30) + 3} textAnchor="end" fill="#5f5f68" fontSize="9.5" fontFamily="var(--mono)">30</text>
          </svg>
        </div>,
      );
    }
    if (overlays?.macd) {
      const vals = [
        ...overlays.macd.macd,
        ...overlays.macd.signal,
        ...overlays.macd.histogram,
      ].filter((v): v is number => v != null);
      if (vals.length > 0) {
        const mMax = Math.max(...vals.map(Math.abs), 1e-9);
        const yM = (v: number) => 8 + (1 - (v + mMax) / (2 * mMax)) * subPlotH;
        subs.push(
          <div className="sub-panel" key="macd">
            <span className="sub-label">MACD 12·26·9</span>
            <svg width={w} height={SUB_H}>
              <line x1={PAD.left} y1={yM(0)} x2={PAD.left + plotW} y2={yM(0)} stroke="#26262c" strokeWidth="1" />
              {overlays.macd.histogram.map((v, i) =>
                v != null ? (
                  <rect
                    key={i}
                    x={xAt(i) - 1}
                    y={Math.min(yM(0), yM(v))}
                    width="2"
                    height={Math.max(1, Math.abs(yM(v) - yM(0)))}
                    fill="#4a4a52"
                  />
                ) : null,
              )}
              <path d={linePath(overlays.macd.macd, xAt, yM)} fill="none" stroke={IND_COLOR.SMA} strokeWidth="1.4" />
              <path d={linePath(overlays.macd.signal, xAt, yM)} fill="none" stroke={IND_COLOR.EMA} strokeWidth="1.4" />
            </svg>
          </div>,
        );
      }
    }
    subPanels = subs;
  } else if (loading) {
    mainSvg = <div className="skeleton" style={{ height: "100%" }} />;
  } else if (error) {
    mainSvg = (
      <div className="chart-empty">
        {error}&ensp;
        <button type="button" onClick={reload} style={{ color: "var(--ink-2)" }}>
          [retry]
        </button>
      </div>
    );
  } else {
    mainSvg = <div className="chart-empty">No chart data available.</div>;
  }

  return (
    <div>
      <div className="chart-controls">
        <div className="range-toggle" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => {
                setHover(null);
                setRange(r);
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="range-toggle" role="group" aria-label="Chart type">
          {(["line", "candle", "bar"] as ChartType[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={t === ctype}
              disabled={t !== "line" && !hasOHLC}
              title={t !== "line" && !hasOHLC ? "OHLC data unavailable for this range" : undefined}
              onClick={() => setCtype(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="range-toggle ind-toggle" role="group" aria-label="Indicators">
          {INDICATORS.map((ind) => (
            <button key={ind} type="button" aria-pressed={inds.includes(ind)} onClick={() => toggleInd(ind)}>
              {ind}
            </button>
          ))}
        </div>
      </div>
      {(inds.includes("SMA") || inds.includes("EMA") || inds.includes("BB")) && (
        <div className="legend-row chart-legend" aria-hidden="true">
          {inds.includes("SMA") && (
            <span className="legend-item"><span className="legend-swatch" style={{ background: IND_COLOR.SMA }} />SMA 20</span>
          )}
          {inds.includes("EMA") && (
            <span className="legend-item"><span className="legend-swatch" style={{ background: IND_COLOR.EMA }} />EMA 20</span>
          )}
          {inds.includes("BB") && (
            <span className="legend-item"><span className="legend-swatch" style={{ background: IND_COLOR.BB }} />BOLL 20·2</span>
          )}
        </div>
      )}
      <div className="chart-wrap" ref={wrapRef}>
        {mainSvg}
        {tooltip}
      </div>
      {subPanels}
    </div>
  );
}
