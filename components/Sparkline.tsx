/**
 * Tiny intraday SVG sparkline: 2px-ish line with a faint fill and a dashed
 * previous-close baseline. Colored by the day's direction via `currentColor`.
 */
export default function Sparkline({
  points,
  previousClose,
  up,
  width = 110,
  height = 34,
}: {
  points: number[];
  previousClose: number | null;
  up: boolean;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  const values =
    previousClose != null ? [...points, previousClose] : points;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) {
    max += 0.5;
    min -= 0.5;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;

  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;

  const line = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join("");
  const area = `${line}L${width},${height}L0,${height}Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ color: up ? "var(--up)" : "var(--down)", flexShrink: 0 }}
    >
      {previousClose != null && (
        <line
          x1="0"
          y1={y(previousClose)}
          x2={width}
          y2={y(previousClose)}
          stroke="#3a3a42"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}
      <path d={area} fill="currentColor" opacity="0.08" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
