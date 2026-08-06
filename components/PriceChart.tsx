"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { ChartRange, ChartResponse } from "@/lib/types";
import { usePoll } from "./usePoll";

const RANGES: ChartRange[] = ["1D", "1W", "1M", "1Y"];

const PAD = { top: 12, right: 62, bottom: 24, left: 8 };

function formatTick(t: number, range: ChartRange): string {
  const d = new Date(t);
  if (range === "1D") {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (range === "1W") {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (range === "1M") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatTooltipTime(t: number, range: ChartRange): string {
  const d = new Date(t);
  if (range === "1D" || range === "1W") {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PriceChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>("1D");
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
      setSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const points = data?.points ?? [];
  const { w, h } = size;
  const plotW = Math.max(0, w - PAD.left - PAD.right);
  const plotH = Math.max(0, h - PAD.top - PAD.bottom);
  const ready = points.length >= 2 && plotW > 0 && plotH > 0;

  let content: React.ReactNode = null;

  if (ready && data) {
    const showPrevClose = range === "1D" && data.previousClose != null;
    const domainValues = points.map((p) => p.c);
    if (showPrevClose) domainValues.push(data.previousClose as number);
    let min = Math.min(...domainValues);
    let max = Math.max(...domainValues);
    if (max === min) {
      max += 0.5;
      min -= 0.5;
    }
    const padY = (max - min) * 0.06;
    min -= padY;
    max += padY;

    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const x = (t: number) =>
      PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

    const reference = showPrevClose
      ? (data.previousClose as number)
      : points[0].c;
    const up = points[points.length - 1].c >= reference;
    const color = up ? "var(--up)" : "var(--down)";

    const line = points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.c).toFixed(1)}`,
      )
      .join("");
    const area = `${line}L${x(t1).toFixed(1)},${PAD.top + plotH}L${PAD.left},${PAD.top + plotH}Z`;

    const gridValues = Array.from(
      { length: 4 },
      (_, i) => min + ((i + 0.5) / 4) * (max - min),
    );
    const tickTimes = [t0, t0 + (t1 - t0) / 2, t1];

    const hovered = hover != null ? points[hover] : null;

    content = (
      <>
        <svg
          width={w}
          height={h}
          role="img"
          aria-label={`${symbol} ${range} price chart`}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const frac = (e.clientX - rect.left - PAD.left) / plotW;
            const i = Math.round(frac * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, i)));
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
              <line
                x1={PAD.left}
                y1={y(v)}
                x2={PAD.left + plotW}
                y2={y(v)}
                stroke="#17171b"
                strokeWidth="1"
              />
              <text
                x={w - 6}
                y={y(v) + 3.5}
                textAnchor="end"
                fill="#5f5f68"
                fontSize="10.5"
                fontFamily="var(--mono)"
              >
                {formatPrice(v)}
              </text>
            </g>
          ))}

          {showPrevClose && (
            <line
              x1={PAD.left}
              y1={y(reference)}
              x2={PAD.left + plotW}
              y2={y(reference)}
              stroke="#4a4a52"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          )}

          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {tickTimes.map((t, i) => (
            <text
              key={t}
              x={x(t)}
              y={h - 6}
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
              fill="#5f5f68"
              fontSize="10.5"
              fontFamily="var(--mono)"
            >
              {formatTick(t, range)}
            </text>
          ))}

          {hovered && (
            <g>
              <line
                x1={x(hovered.t)}
                y1={PAD.top}
                x2={x(hovered.t)}
                y2={PAD.top + plotH}
                stroke="#3a3a42"
                strokeWidth="1"
              />
              <circle
                cx={x(hovered.t)}
                cy={y(hovered.c)}
                r="3.5"
                fill={color}
                stroke="var(--bg)"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
        {hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.max(60, Math.min(w - 60, x(hovered.t))),
              top: 0,
            }}
          >
            {formatPrice(hovered.c)}
            <span className="tt-time">{formatTooltipTime(hovered.t, range)}</span>
          </div>
        )}
      </>
    );
  } else if (loading) {
    content = <div className="skeleton" style={{ height: "100%" }} />;
  } else if (error) {
    content = (
      <div className="chart-empty">
        {error}&ensp;
        <button type="button" onClick={reload} style={{ color: "var(--ink-2)" }}>
          [retry]
        </button>
      </div>
    );
  } else {
    content = <div className="chart-empty">No chart data available.</div>;
  }

  return (
    <div>
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
      <div className="chart-wrap" ref={wrapRef}>
        {content}
      </div>
    </div>
  );
}
