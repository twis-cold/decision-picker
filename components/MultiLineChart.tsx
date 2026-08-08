"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import type { CompareSeries } from "@/lib/types";

/**
 * Normalized comparison chart (2–3 series). Line colors are a fixed-order
 * cyan/amber/violet trio, validated for colorblind separation and contrast
 * on the black surface — deliberately NOT green/red, which the rest of the
 * UI reserves for gain/loss.
 */
export const SERIES_COLORS = ["#1a9db3", "#ab8526", "#8d70e8"];

const PAD = { top: 14, right: 66, bottom: 24, left: 8 };

export default function MultiLineChart({
  series,
  height = 300,
}: {
  series: CompareSeries[];
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverT, setHoverT] = useState<number | null>(null);

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

  if (series.length === 0) return null;

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length < 2 || plotW <= 0) {
    return <div className="chart-wrap" style={{ height }} ref={wrapRef} />;
  }

  let min = Math.min(...allPoints.map((p) => p.v));
  let max = Math.max(...allPoints.map((p) => p.v));
  if (max === min) {
    max += 1;
    min -= 1;
  }
  const padY = (max - min) * 0.06;
  min -= padY;
  max += padY;

  const t0 = Math.min(...allPoints.map((p) => p.t));
  const t1 = Math.max(...allPoints.map((p) => p.t));
  const x = (t: number) => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

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

  // Nearest point per series for the hovered timestamp.
  const hovered =
    hoverT == null
      ? null
      : series.map((s) => {
          let best = s.points[0];
          for (const p of s.points) {
            if (Math.abs(p.t - hoverT) < Math.abs(best.t - hoverT)) best = p;
          }
          return { symbol: s.symbol, point: best };
        });

  return (
    <div className="chart-wrap" style={{ height }} ref={wrapRef}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Comparison of normalized investment value over time"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientX - rect.left - PAD.left) / plotW;
          setHoverT(t0 + Math.max(0, Math.min(1, frac)) * (t1 - t0));
        }}
        onPointerLeave={() => setHoverT(null)}
      >
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
              {formatMoney(v)}
            </text>
          </g>
        ))}

        {/* $100 baseline — everyone starts here */}
        <line
          x1={PAD.left}
          y1={y(100)}
          x2={PAD.left + plotW}
          y2={y(100)}
          stroke="#4a4a52"
          strokeWidth="1"
          strokeDasharray="3 4"
        />

        {series.map((s, i) => (
          <path
            key={s.symbol}
            d={s.points
              .map(
                (p, j) =>
                  `${j === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`,
              )
              .join("")}
            fill="none"
            stroke={SERIES_COLORS[i]}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

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

        {hovered && (
          <g>
            <line
              x1={x(hoverT as number)}
              y1={PAD.top}
              x2={x(hoverT as number)}
              y2={PAD.top + plotH}
              stroke="#3a3a42"
              strokeWidth="1"
            />
            {hovered.map((h, i) => (
              <circle
                key={h.symbol}
                cx={x(h.point.t)}
                cy={y(h.point.v)}
                r="3.5"
                fill={SERIES_COLORS[i]}
                stroke="var(--bg)"
                strokeWidth="2"
              />
            ))}
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.max(90, Math.min(width - 90, x(hoverT as number))),
            top: 0,
          }}
        >
          {hovered.map((h, i) => (
            <span key={h.symbol} className="tt-row">
              <span className="tt-dot" style={{ background: SERIES_COLORS[i] }} />
              {h.symbol} {formatMoney(h.point.v)}
            </span>
          ))}
          <span className="tt-time">{formatDate(hovered[0].point.t)}</span>
        </div>
      )}
    </div>
  );
}
