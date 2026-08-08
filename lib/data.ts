import { cached } from "./cache";
import { explainJump, explainMove } from "./explain";
import {
  fetchEarningsCalendar,
  fetchFinnhubNews,
  fetchFinnhubNewsBetween,
  finnhubEnabled,
} from "./finnhub";
import {
  mockChart,
  mockDailyHistory,
  mockEarnings,
  mockJumpNews,
  mockMovers,
  mockNews,
  mockQuote,
  mockSearch,
} from "./mock";
import type {
  ChartPoint,
  ChartRange,
  ChartResponse,
  CompareResponse,
  CompareSeries,
  DigestResponse,
  EarningsResponse,
  HindsightResponse,
  JumpResponse,
  MoversResponse,
  NewsItem,
  NewsResponse,
  QuoteDetail,
  QuotesResponse,
  SearchResponse,
  SparkResponse,
  ValuePoint,
} from "./types";
import * as yahoo from "./yahoo";

/**
 * Single entry point for all market data. API routes call these functions;
 * they handle caching (rate-limit protection) and the MOCK_DATA switch.
 *
 * TTLs are chosen so a dashboard auto-refreshing every 60s stays cheap:
 * the movers list is 1 request/min regardless of visitor count, and
 * charts/news are effectively static between refreshes.
 */

const TTL = {
  movers: 55 * 1000,
  quote: 30 * 1000,
  spark: 5 * 60 * 1000,
  chart1D: 2 * 60 * 1000,
  chart: 10 * 60 * 1000,
  news: 10 * 60 * 1000,
  search: 60 * 60 * 1000,
  history: 10 * 60 * 1000,
  jump: 60 * 60 * 1000,
  digest: 10 * 60 * 1000,
  earnings: 6 * 60 * 60 * 1000,
};

const useMock = () => process.env.MOCK_DATA === "1";

const SYMBOL_RE = /^[A-Z0-9.^=-]{1,12}$/;

export function normalizeSymbol(raw: string): string {
  const symbol = decodeURIComponent(raw).trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) {
    throw new UserError(`"${raw}" doesn't look like a valid ticker.`);
  }
  return symbol;
}

export async function getMovers(): Promise<MoversResponse> {
  if (useMock()) {
    return { ...mockMovers(), asOf: new Date().toISOString(), sampleData: true };
  }
  return cached("movers", TTL.movers, async () => {
    const [gainers, losers, actives] = await Promise.all([
      yahoo.fetchGainers(),
      yahoo.fetchLosers(),
      yahoo.fetchActives(),
    ]);
    return {
      gainers,
      losers,
      actives,
      asOf: new Date().toISOString(),
      sampleData: false,
    };
  });
}

export async function getQuote(symbol: string): Promise<QuoteDetail> {
  if (useMock()) return mockQuote(symbol);
  return cached(`quote:${symbol}`, TTL.quote, () => yahoo.fetchQuote(symbol));
}

export async function getSpark(symbol: string): Promise<SparkResponse> {
  if (useMock()) {
    const { points, previousClose } = mockChart(symbol, "1D");
    return {
      symbol,
      points: points.map((p) => p.c),
      previousClose,
      sampleData: true,
    };
  }
  return cached(`spark:${symbol}`, TTL.spark, async () => {
    const { points, previousClose } = await yahoo.fetchSpark(symbol);
    return { symbol, points, previousClose, sampleData: false };
  });
}

export async function getChart(
  symbol: string,
  range: ChartRange,
): Promise<ChartResponse> {
  if (useMock()) {
    return { symbol, range, ...mockChart(symbol, range), sampleData: true };
  }
  const ttl = range === "1D" ? TTL.chart1D : TTL.chart;
  return cached(`chart:${symbol}:${range}`, ttl, async () => {
    const { points, previousClose } = await yahoo.fetchChart(symbol, range);
    return { symbol, range, points, previousClose, sampleData: false };
  });
}

export async function getNews(
  symbol: string,
  changePercent: number,
): Promise<NewsResponse> {
  if (useMock()) {
    const items = mockNews(symbol);
    return {
      symbol,
      items,
      explanation: explainMove(symbol, changePercent, items),
      provider: "sample",
      sampleData: true,
    };
  }
  return cached(`news:${symbol}:${changePercent.toFixed(2)}`, TTL.news, async () => {
    let items;
    let provider: "finnhub" | "yahoo" = "yahoo";
    if (finnhubEnabled()) {
      try {
        items = await fetchFinnhubNews(symbol);
        provider = "finnhub";
      } catch {
        items = await yahoo.fetchYahooNews(symbol);
      }
    } else {
      items = await yahoo.fetchYahooNews(symbol);
    }
    return {
      symbol,
      items,
      explanation: explainMove(symbol, changePercent, items),
      provider,
      sampleData: false,
    };
  });
}

/** Error whose message is safe (and useful) to show to the end user. */
export class UserError extends Error {}

const DAY_MS = 24 * 3600 * 1000;

function parseDateParam(dateStr: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new UserError("Enter a date in YYYY-MM-DD format.");
  }
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(t)) throw new UserError("That date doesn't exist.");
  if (t < Date.parse("1970-01-02T00:00:00Z")) {
    throw new UserError("Pick a date after 1970 — price data doesn't go back that far.");
  }
  if (t > Date.now() - DAY_MS) {
    throw new UserError("Pick a date in the past — at least one trading day ago.");
  }
  return t;
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function getDailyHistory(
  symbol: string,
  fromMs: number,
  toMs?: number,
): Promise<ChartPoint[]> {
  if (useMock()) return mockDailyHistory(symbol, fromMs, toMs);
  const key = `hist:${symbol}:${utcDay(fromMs)}:${toMs ? utcDay(toMs) : "now"}`;
  return cached(key, TTL.history, () =>
    yahoo.fetchDailyHistory(
      symbol,
      new Date(fromMs),
      toMs ? new Date(toMs) : undefined,
    ),
  );
}

export async function getHindsight(
  symbol: string,
  dateStr: string,
  amount: number,
): Promise<HindsightResponse> {
  if (!(amount >= 1) || amount > 1e8) {
    throw new UserError("Enter an amount between $1 and $100,000,000.");
  }
  const reqMs = parseDateParam(dateStr);

  // Small buffer before the requested date so we can tell "market closed
  // that day" apart from "the stock wasn't trading yet".
  const history = await getDailyHistory(symbol, reqMs - 7 * DAY_MS);
  if (history.length === 0) {
    throw new UserError(
      `No price history found for ${symbol} — it may be delisted or the ticker may be wrong.`,
    );
  }
  const startIdx = history.findIndex((p) => p.t >= reqMs);
  if (startIdx === -1) {
    throw new UserError(
      "That date is too recent — there's no completed trading day after it yet.",
    );
  }
  if (startIdx === 0 && history[0].t > reqMs + 10 * DAY_MS) {
    throw new UserError(
      `${symbol} wasn't publicly traded on ${dateStr} — its price data starts ${utcDay(history[0].t)}.`,
    );
  }

  const start = history[startIdx];
  const shares = amount / start.c;
  let series: ValuePoint[] = history
    .slice(startIdx)
    .map((p) => ({ t: p.t, v: shares * p.c }));

  // Freshen the endpoint with the live quote when we can; sample mode keeps
  // the series self-consistent instead.
  let name: string | null = null;
  if (!useMock()) {
    try {
      const quote = await getQuote(symbol);
      name = quote.name;
      series.push({ t: Date.now(), v: shares * quote.price });
    } catch {
      // series already ends at the latest close
    }
  } else {
    name = mockQuote(symbol).name;
  }

  // Keep the payload light for long histories.
  if (series.length > 400) {
    const step = Math.ceil(series.length / 400);
    const last = series[series.length - 1];
    series = series.filter((_, i) => i % step === 0);
    if (series[series.length - 1].t !== last.t) series.push(last);
  }

  const end = series[series.length - 1];
  return {
    symbol,
    name,
    requestedDate: dateStr,
    startDate: new Date(start.t).toISOString(),
    startPrice: start.c,
    shares,
    amountInvested: amount,
    valueNow: end.v,
    endDate: new Date(end.t).toISOString(),
    gain: end.v - amount,
    returnPercent: ((end.v - amount) / amount) * 100,
    series,
    sampleData: useMock(),
  };
}

async function getJumpNews(
  symbol: string,
  dateStr: string,
  reqMs: number,
): Promise<{ items: NewsItem[]; provider: JumpResponse["provider"] }> {
  if (useMock()) return { items: mockJumpNews(symbol, dateStr), provider: "sample" };
  // Historical headlines need Finnhub; Yahoo's news search only covers the
  // last few days, so it's only a valid source for very recent dates.
  if (finnhubEnabled()) {
    try {
      const items = await fetchFinnhubNewsBetween(
        symbol,
        new Date(reqMs - 3 * DAY_MS),
        new Date(reqMs + DAY_MS),
      );
      return { items, provider: "finnhub" };
    } catch {
      // fall through
    }
  }
  if (Date.now() - reqMs < 6 * DAY_MS) {
    try {
      const items = (await yahoo.fetchYahooNews(symbol)).filter(
        (n) => Math.abs(new Date(n.publishedAt).getTime() - reqMs) < 4 * DAY_MS,
      );
      return { items, provider: "yahoo" };
    } catch {
      // fall through
    }
  }
  return { items: [], provider: "none" };
}

export async function getJump(
  symbol: string,
  dateStr: string,
): Promise<Omit<JumpResponse, "remaining">> {
  const reqMs = parseDateParam(dateStr);
  if (reqMs < Date.parse("2000-01-01T00:00:00Z")) {
    throw new UserError(
      "News archives get patchy before 2000 — try a more recent date.",
    );
  }

  return cached(`jump:${symbol}:${dateStr}`, TTL.jump, async () => {
    const fromMs = reqMs - 45 * DAY_MS;
    const toMs = Math.min(Date.now(), reqMs + 45 * DAY_MS);
    const history = await getDailyHistory(symbol, fromMs, toMs);
    if (history.length === 0) {
      throw new UserError(
        `No price history found for ${symbol} around that date — it may be delisted or the ticker may be wrong.`,
      );
    }

    let idx = history.findIndex((p) => utcDay(p.t) === dateStr);
    let dateShifted = false;
    if (idx === -1) {
      idx = history.findIndex(
        (p) => p.t > reqMs && p.t < reqMs + 7 * DAY_MS,
      );
      dateShifted = idx > 0;
    }
    if (idx <= 0) {
      throw new UserError(
        idx === 0
          ? `Not enough trading history before ${dateStr} to measure that day's move.`
          : `${symbol} has no trading data around ${dateStr}.`,
      );
    }

    const day = history[idx];
    const prev = history[idx - 1];
    const change = day.c - prev.c;
    const changePercent = (change / prev.c) * 100;

    // S&P 500 context for the honest "market-wide move" fallback.
    let marketChangePercent: number | null = null;
    try {
      const spx = await getDailyHistory("^GSPC", fromMs, toMs);
      const mIdx = spx.findIndex((p) => utcDay(p.t) === utcDay(day.t));
      if (mIdx > 0) {
        marketChangePercent =
          ((spx[mIdx].c - spx[mIdx - 1].c) / spx[mIdx - 1].c) * 100;
      }
    } catch {
      // context is optional
    }

    const { items, provider } = await getJumpNews(symbol, dateStr, reqMs);
    const explanation = explainJump(
      symbol,
      utcDay(day.t),
      changePercent,
      marketChangePercent,
      items,
    );

    return {
      symbol,
      requestedDate: dateStr,
      date: new Date(day.t).toISOString(),
      dateShifted,
      close: day.c,
      previousClose: prev.c,
      change,
      changePercent,
      marketChangePercent,
      explanation,
      items: items.slice(0, 6),
      provider,
      series: history,
      highlightT: day.t,
      sampleData: useMock(),
    };
  });
}

/**
 * "Top 3 Unusual Moves Today" — the intended newsletter content, built from
 * the same movers + explanation pipeline as the dashboard. A future cron job
 * can fetch /api/digest and pipe `text` straight into an email service.
 */
export async function getDigest(): Promise<DigestResponse> {
  return cached("digest", TTL.digest, async () => {
    const movers = await getMovers();
    const seen = new Set<string>();
    const top = [...movers.gainers, ...movers.losers]
      .filter((s) => (seen.has(s.symbol) ? false : seen.add(s.symbol)))
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, 3);

    const items = await Promise.all(
      top.map(async (s) => {
        const news = await getNews(s.symbol, s.changePercent);
        return {
          symbol: s.symbol,
          name: s.name,
          price: s.price,
          changePercent: s.changePercent,
          explanation: news.explanation.text,
        };
      }),
    );

    const date = new Date().toISOString().slice(0, 10);
    const subject = `Top 3 unusual moves — ${date}`;
    const text = [
      `# ${subject}`,
      "",
      ...items.map((it, i) => {
        const sign = it.changePercent >= 0 ? "+" : "";
        return `${i + 1}. **${it.symbol}** (${it.name}) ${sign}${it.changePercent.toFixed(2)}%\n   ${it.explanation}`;
      }),
      "",
      "_Not investment advice. Unsubscribe anytime._",
    ].join("\n");

    return { date, subject, items, text, sampleData: movers.sampleData };
  });
}

/** Batch quotes for the watchlist page/widget. Bad symbols and failures are skipped. */
export async function getQuotes(symbols: string[]): Promise<QuotesResponse> {
  const normalized = symbols.flatMap((s) => {
    try {
      return [normalizeSymbol(s)];
    } catch {
      return [];
    }
  });
  const unique = [...new Set(normalized)].slice(0, 30);
  const settled = await Promise.allSettled(unique.map((s) => getQuote(s)));
  const quotes = settled
    .filter(
      (r): r is PromiseFulfilledResult<QuoteDetail> => r.status === "fulfilled",
    )
    .map((r) => r.value);
  return { quotes, sampleData: useMock() };
}

/**
 * Earnings calendar. Live data needs FINNHUB_API_KEY (the calendar is part
 * of Finnhub's free tier — no second provider required); without it we
 * return needsKey so the UI can explain, rather than showing nothing.
 */
export async function getEarnings(
  from: string,
  to: string,
): Promise<EarningsResponse> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new UserError("Invalid date range.");
  }
  if (useMock()) {
    return { from, to, items: mockEarnings(from, to), needsKey: false, sampleData: true };
  }
  if (!finnhubEnabled()) {
    return { from, to, items: [], needsKey: true, sampleData: false };
  }
  return cached(`earnings:${from}:${to}`, TTL.earnings, async () => {
    const items = (await fetchEarningsCalendar(from, to)).sort(
      (a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol),
    );
    return { from, to, items, needsKey: false, sampleData: false };
  });
}

/**
 * Comparison view: $100 in each symbol on the same start date. Reuses the
 * hindsight pipeline's getDailyHistory; series are aligned to the latest
 * common first trading day so late-IPO symbols don't skew the comparison.
 */
export async function getCompare(
  symbols: string[],
  fromStr: string,
): Promise<CompareResponse> {
  const unique = [...new Set(symbols.map((s) => normalizeSymbol(s)))].slice(0, 3);
  if (unique.length < 2) {
    throw new UserError("Pick at least two tickers to compare.");
  }
  const fromMs = parseDateParam(fromStr);

  const histories = await Promise.all(
    unique.map(async (symbol) => {
      const points = await getDailyHistory(symbol, fromMs - 7 * DAY_MS);
      if (points.length === 0) {
        throw new UserError(
          `No price history found for ${symbol} — it may be delisted or the ticker may be wrong.`,
        );
      }
      return { symbol, points };
    }),
  );

  // Latest first-available day across the set, but never before `from`.
  const commonStart = Math.max(
    fromMs,
    ...histories.map((h) => h.points[0].t),
  );

  const series: CompareSeries[] = histories.map(({ symbol, points }) => {
    const startIdx = points.findIndex((p) => p.t >= commonStart);
    if (startIdx === -1) {
      throw new UserError(`${symbol} has no trading data after ${fromStr}.`);
    }
    const base = points[startIdx].c;
    let values: ValuePoint[] = points
      .slice(startIdx)
      .map((p) => ({ t: p.t, v: (100 * p.c) / base }));
    if (values.length > 400) {
      const step = Math.ceil(values.length / 400);
      const last = values[values.length - 1];
      values = values.filter((_, i) => i % step === 0);
      if (values[values.length - 1].t !== last.t) values.push(last);
    }
    const end = values[values.length - 1].v;
    return {
      symbol,
      points: values,
      endValue: end,
      returnPercent: end - 100,
    };
  });

  const actualStart = Math.min(...series.map((s) => s.points[0].t));
  return {
    from: fromStr,
    startDate: new Date(actualStart).toISOString(),
    series,
    sampleData: useMock(),
  };
}

export async function getSearch(query: string): Promise<SearchResponse> {
  const q = query.trim();
  if (!q) return { query: q, results: [], sampleData: useMock() };
  if (useMock()) return { query: q, results: mockSearch(q), sampleData: true };
  return cached(`search:${q.toLowerCase()}`, TTL.search, async () => ({
    query: q,
    results: await yahoo.searchSymbols(q),
    sampleData: false,
  }));
}
