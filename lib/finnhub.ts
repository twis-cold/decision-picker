import type { EarningsItem, NewsItem } from "./types";

const BASE = "https://finnhub.io/api/v1";

export function finnhubEnabled(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

interface FinnhubNewsItem {
  id: number;
  datetime: number; // unix seconds
  headline: string;
  summary: string;
  source: string;
  url: string;
}

/** Company news from the last 7 days, newest first. */
export function fetchFinnhubNews(symbol: string): Promise<NewsItem[]> {
  const to = new Date();
  return fetchFinnhubNewsBetween(
    symbol,
    new Date(to.getTime() - 7 * 24 * 3600 * 1000),
    to,
  );
}

/**
 * Company news for an arbitrary window (powers "Explain the Jump").
 * Note: Finnhub's free tier only archives roughly the last year.
 */
export async function fetchFinnhubNewsBetween(
  symbol: string,
  from: Date,
  to: Date,
): Promise<NewsItem[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) throw new Error("FINNHUB_API_KEY not set");

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `${BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${token}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Finnhub responded ${res.status}`);

  const data = (await res.json()) as FinnhubNewsItem[];
  if (!Array.isArray(data)) throw new Error("Unexpected Finnhub response");

  return data
    .filter((n) => n.headline && n.url)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 8)
    .map((n) => ({
      id: String(n.id),
      title: n.headline,
      summary: n.summary?.trim() ? truncate(n.summary.trim(), 180) : null,
      source: n.source || "Finnhub",
      url: n.url,
      publishedAt: new Date(n.datetime * 1000).toISOString(),
    }));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

interface FinnhubEarningsEntry {
  date: string;
  symbol: string;
  hour: string; // "bmo" | "amc" | "dmh" | ""
  epsEstimate: number | null;
}

/**
 * Earnings calendar between two dates (Finnhub /calendar/earnings —
 * included in the free tier, same key as company news).
 */
export async function fetchEarningsCalendar(
  from: string,
  to: string,
): Promise<EarningsItem[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) throw new Error("FINNHUB_API_KEY not set");

  const url = `${BASE}/calendar/earnings?from=${from}&to=${to}&token=${token}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Finnhub responded ${res.status}`);

  const data = (await res.json()) as {
    earningsCalendar?: FinnhubEarningsEntry[];
  };
  return (data.earningsCalendar ?? [])
    .filter((e) => e.symbol && e.date)
    .map((e) => ({
      symbol: e.symbol,
      date: e.date,
      hour: e.hour === "bmo" ? "bmo" : e.hour === "amc" ? "amc" : "other",
      epsEstimate: e.epsEstimate ?? null,
    }));
}
