"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatDate, formatMoney, formatPrice } from "@/lib/format";

const PAD = { top: 12, right: 66, bottom: 24, left: 8 };

interface Point {
  t: number;
  v: number;
}

/**
 * General-purpose line chart for the hindsight calculator (dollar value over
 * time) and Explain-the-Jump (price context around a date, with the analyzed
 * day highlighted). Same rendering rules as PriceChart: 2px line, recessive
 * grid, crosshair + tooltip.
 */
export default function ValueChart({
  points,
  money = true,
  highlightT,
  height = 260,
}: {
  points: Point[];
  money?: boolean;
  highlightT?: number;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);
  const fmt = money ? formatMoney : formatPrice;

  let svg: React.ReactNode = null;
  let tooltip: React.ReactNode = null;

  if (points.length >= 2 && plotW > 0) {
    let min = Math.min(...points.map((p) => p.v));
    let max = Math.max(...points.map((p) => p.v));
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

    const up = points[points.length - 1].v >= points[0].v;
    const color = up ? "var(--up)" : "var(--down)";

    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join("");
    const area = `${line}L${x(t1).toFixed(1)},${PAD.top + plotH}L${PAD.left},${PAD.top + plotH}Z`;

    const gridValues = Array.from(
      { length: 4 },
      (_, i) => min + ((i + 0.5) / 4) * (max - min),
    );
    const spanDays = (t1 - t0) / (24 * 3600 * 1000);
    const tickTimes = [t0, t0 + (t1 - t0) / 2, t1];
    const tickLabel = (t: number) =>
      spanDays > 500
        ? new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const highlight =
      highlightT != null
        ? points.find((p) => p.t === highlightT) ?? null
        : null;
    const hovered = hover != null ? points[hover] : null;

    svg = (
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Value over time"
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
              x={width - 6}
              y={y(v) + 3.5}
              textAnchor="end"
              fill="#5f5f68"
              fontSize="10.5"
              fontFamily="var(--mono)"
            >
              {fmt(v)}
            </text>
          </g>
        ))}

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
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            fill="#5f5f68"
            fontSize="10.5"
            fontFamily="var(--mono)"
          >
            {tickLabel(t)}
          </text>
        ))}

        {highlight && (
          <g>
            <line
              x1={x(highlight.t)}
              y1={PAD.top}
              x2={x(highlight.t)}
              y2={PAD.top + plotH}
              stroke="#4a4a52"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <circle
              cx={x(highlight.t)}
              cy={y(highlight.v)}
              r="4.5"
              fill={color}
              stroke="var(--bg)"
              strokeWidth="2"
            />
          </g>
        )}

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
              cy={y(hovered.v)}
              r="3.5"
              fill={color}
              stroke="var(--bg)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    );

    if (hovered) {
      tooltip = (
        <div
          className="chart-tooltip"
          style={{ left: Math.max(70, Math.min(width - 70, x(hovered.t))), top: 0 }}
        >
          {fmt(hovered.v)}
          <span className="tt-time">{formatDate(hovered.t)}</span>
        </div>
      );
    }
  }

  return (
    <div className="chart-wrap" style={{ height }} ref={wrapRef}>
      {svg}
      {tooltip}
    </div>
  );
}
