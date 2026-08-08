"use client";

/**
 * Asset-allocation donut. Top holdings get the validated cyan/amber/violet
 * trio in fixed order; everything else folds into OTHER, and CASH is always
 * neutral gray. Identity is never color-alone — the legend carries labels.
 */
const SLICE_COLORS = ["#1a9db3", "#ab8526", "#8d70e8"];
const OTHER_COLOR = "#3a3a42";
const CASH_COLOR = "#5f5f68";

export interface Slice {
  label: string;
  value: number;
}

export default function AllocationDonut({
  holdings,
  cash,
}: {
  holdings: Slice[];
  cash: number;
}) {
  const sorted = [...holdings].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 3);
  const otherValue = sorted.slice(3).reduce((a, s) => a + s.value, 0);

  const slices: { label: string; value: number; color: string }[] = [
    ...top.map((s, i) => ({ ...s, color: SLICE_COLORS[i] })),
    ...(otherValue > 0 ? [{ label: "OTHER", value: otherValue, color: OTHER_COLOR }] : []),
    ...(cash > 0 ? [{ label: "CASH", value: cash, color: CASH_COLOR }] : []),
  ];
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return null;

  const R = 56;
  const STROKE = 22;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Asset allocation">
        <g transform="rotate(-90 75 75)">
          {slices.map((s) => {
            const frac = s.value / total;
            // 2px surface gap between segments.
            const dash = Math.max(0, frac * C - 2);
            const el = (
              <circle
                key={s.label}
                cx="75"
                cy="75"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += frac * C;
            return el;
          })}
        </g>
      </svg>
      <div className="donut-legend">
        {slices.map((s) => (
          <span key={s.label} className="legend-item">
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.label} {((s.value / total) * 100).toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  );
}
