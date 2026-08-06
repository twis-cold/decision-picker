import { formatCompact, formatPrice } from "@/lib/format";
import type { QuoteDetail } from "@/lib/types";

export default function StatGrid({ quote }: { quote: QuoteDetail }) {
  const stats: [string, string][] = [
    ["Market Cap", formatCompact(quote.marketCap)],
    ["P/E (TTM)", quote.trailingPE != null ? quote.trailingPE.toFixed(2) : "—"],
    ["52W High", formatPrice(quote.fiftyTwoWeekHigh)],
    ["52W Low", formatPrice(quote.fiftyTwoWeekLow)],
    ["Volume", formatCompact(quote.volume)],
    ["Avg Volume (3M)", formatCompact(quote.avgVolume)],
    [
      "Day Range",
      quote.dayLow != null && quote.dayHigh != null
        ? `${formatPrice(quote.dayLow)} – ${formatPrice(quote.dayHigh)}`
        : "—",
    ],
    ["Prev Close", formatPrice(quote.previousClose)],
  ];

  return (
    <dl className="stats-grid">
      {stats.map(([label, value]) => (
        <div className="stat" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
