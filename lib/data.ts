import { cached } from "./cache";
import { explainJump, explainMove } from "./explain";
import {
  fetchEarningsCalendar,
  fetchFinancialsReported,
  fetchFinnhubNews,
  fetchFinnhubNewsBetween,
  fetchGeneralNews,
  fetchRecommendationTrends,
  finnhubEnabled,
} from "./finnhub";
import {
  mockChart,
  mockDailyHistory,
  mockEarnings,
  mockFinancials,
  mockGeneralNews,
  mockIndices,
  mockJumpNews,
  mockMovers,
  mockNews,
  mockOptions,
  mockQuote,
  mockRatings,
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
  FinancialsResponse,
  HindsightResponse,
  IndicesResponse,
  JumpResponse,
  MoversResponse,
  NewsFeedResponse,
  NewsItem,
  NewsResponse,
  OptionsResponse,
  PaperPerformanceRequest,
  PaperPerformanceResponse,
  QuoteDetail,
  QuotesResponse,
  RatingsResponse,
  SearchResponse,
  SparkResponse,
  StatementType,
  StockSummary,
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
  indices: 60 * 1000,
  financials: 6 * 60 * 60 * 1000,
  options: 10 * 60 * 1000,
  ratings: 6 * 60 * 60 * 1000,
  newsfeed: 5 * 60 * 1000,
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

/**
 * "Near 52-week high/low" computed from the movers universe we already
 * fetch — Yahoo has no dedicated screener for this, and this keeps it free.
 */
function fiftyTwoWeekLists(all: StockSummary[]): {
  highs52w: StockSummary[];
  lows52w: StockSummary[];
} {
  const seen = new Set<string>();
  const unique = all.filter((s) =>
    seen.has(s.symbol) ? false : seen.add(s.symbol),
  );
  const highs52w = unique
    .filter(
      (s) => s.fiftyTwoWeekHigh != null && s.price >= s.fiftyTwoWeekHigh * 0.97,
    )
    .sort(
      (a, b) =>
        b.price / (b.fiftyTwoWeekHigh as number) -
        a.price / (a.fiftyTwoWeekHigh as number),
    )
    .slice(0, 6);
  const lows52w = unique
    .filter(
      (s) => s.fiftyTwoWeekLow != null && s.price <= s.fiftyTwoWeekLow * 1.03,
    )
    .sort(
      (a, b) =>
        a.price / (a.fiftyTwoWeekLow as number) -
        b.price / (b.fiftyTwoWeekLow as number),
    )
    .slice(0, 6);
  return { highs52w, lows52w };
}

export async function getMovers(): Promise<MoversResponse> {
  if (useMock()) {
    const m = mockMovers();
    return {
      ...m,
      ...fiftyTwoWeekLists([...m.gainers, ...m.losers, ...m.actives]),
      asOf: new Date().toISOString(),
      sampleData: true,
    };
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
      ...fiftyTwoWeekLists([...gainers, ...losers, ...actives]),
      asOf: new Date().toISOString(),
      sampleData: false,
    };
  });
}

export async function getIndices(): Promise<IndicesResponse> {
  if (useMock()) return { indices: mockIndices(), sampleData: true };
  return cached("indices", TTL.indices, async () => ({
    indices: await yahoo.fetchIndices(),
    sampleData: false,
  }));
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

export async function getFinancials(
  symbol: string,
  freq: "quarterly" | "annual",
  statement: StatementType,
): Promise<FinancialsResponse> {
  if (useMock()) {
    return {
      symbol,
      freq,
      statement,
      ...mockFinancials(symbol, freq, statement),
      needsKey: false,
      sampleData: true,
    };
  }
  if (!finnhubEnabled()) {
    return {
      symbol,
      freq,
      statement,
      periods: [],
      rows: [],
      needsKey: true,
      sampleData: false,
    };
  }
  return cached(`fin:${symbol}:${freq}:${statement}`, TTL.financials, async () => ({
    symbol,
    freq,
    statement,
    ...(await fetchFinancialsReported(symbol, freq, statement)),
    needsKey: false,
    sampleData: false,
  }));
}

export async function getOptions(symbol: string): Promise<OptionsResponse> {
  if (useMock()) {
    return { symbol, ...mockOptions(symbol), available: true, sampleData: true };
  }
  return cached(`options:${symbol}`, TTL.options, async () => {
    try {
      const quote = await getQuote(symbol);
      const chain = await yahoo.fetchOptions(symbol, quote.price);
      return {
        symbol,
        ...chain,
        available: chain.calls.length > 0 || chain.puts.length > 0,
        sampleData: false,
      };
    } catch {
      return {
        symbol,
        expiration: null,
        calls: [],
        puts: [],
        available: false,
        sampleData: false,
      };
    }
  });
}

/**
 * Analyst consensus: buy/hold/sell counts from Finnhub's free
 * recommendation-trends endpoint when a key exists, plus average price
 * target from Yahoo's financialData (Finnhub's own price-target endpoint
 * is premium-only).
 */
export async function getRatings(symbol: string): Promise<RatingsResponse> {
  if (useMock()) return mockRatings(symbol);
  return cached(`ratings:${symbol}`, TTL.ratings, async () => {
    let counts = { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 };
    let haveCounts = false;
    if (finnhubEnabled()) {
      try {
        const rec = await fetchRecommendationTrends(symbol);
        if (rec) {
          counts = {
            strongBuy: rec.strongBuy,
            buy: rec.buy,
            hold: rec.hold,
            sell: rec.sell,
            strongSell: rec.strongSell,
          };
          haveCounts = true;
        }
      } catch {
        // fall through to Yahoo-only
      }
    }
    let targetMean: number | null = null;
    let recommendation: string | null = null;
    try {
      const yq = await yahoo.fetchYahooRatings(symbol);
      targetMean = yq.targetMean;
      recommendation = yq.recommendation;
    } catch {
      // optional
    }
    return {
      symbol,
      ...counts,
      targetMean,
      recommendation,
      available: haveCounts || targetMean != null || recommendation != null,
      sampleData: false,
    };
  });
}

/**
 * General market news feed. Finnhub /news with a key; without one, fall
 * back to Yahoo headlines for a market-wide query. Per-ticker filtering
 * reuses the existing company-news path.
 */
export async function getNewsFeed(
  symbol: string | null,
  category: string,
): Promise<NewsFeedResponse> {
  const cat = ["general", "merger", "crypto", "forex"].includes(category)
    ? category
    : "general";
  if (useMock()) {
    const items = symbol ? mockNews(symbol) : mockGeneralNews(cat);
    return {
      items,
      filter: { symbol, category: cat },
      provider: "sample",
      sampleData: true,
    };
  }
  if (symbol) {
    const news = await getNews(symbol, 0);
    return {
      items: news.items,
      filter: { symbol, category: cat },
      provider: news.provider === "sample" ? "yahoo" : news.provider,
      sampleData: false,
    };
  }
  return cached(`feed:${cat}`, TTL.newsfeed, async () => {
    if (finnhubEnabled()) {
      try {
        return {
          items: await fetchGeneralNews(cat),
          filter: { symbol: null, category: cat },
          provider: "finnhub" as const,
          sampleData: false,
        };
      } catch {
        // fall through
      }
    }
    // Keyless fallback: blend recent headlines for market bellwethers.
    const symbols = ["SPY", "AAPL", "NVDA", "TSLA"];
    const settled = await Promise.allSettled(
      symbols.map((s) => yahoo.fetchYahooNews(s)),
    );
    const items = settled
      .filter(
        (r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled",
      )
      .flatMap((r) => r.value)
      .filter(
        (item, i, arr) => arr.findIndex((x) => x.title === item.title) === i,
      )
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 25);
    return {
      items,
      filter: { symbol: null, category: cat },
      provider: "yahoo" as const,
      sampleData: false,
    };
  });
}

/**
 * Paper-portfolio value over time vs the S&P 500, reconstructed from the
 * client's simulated transaction log. Reuses the daily-history pipeline
 * that powers hindsight and compare.
 */
export async function getPaperPerformance(
  req: PaperPerformanceRequest,
): Promise<PaperPerformanceResponse> {
  const txns = (req.transactions ?? [])
    .filter(
      (t) =>
        t.symbol &&
        Number.isFinite(t.shares) &&
        Number.isFinite(t.total) &&
        !Number.isNaN(Date.parse(t.at)),
    )
    .slice(0, 200)
    .map((t) => ({ ...t, symbol: normalizeSymbol(t.symbol), atMs: Date.parse(t.at) }))
    .sort((a, b) => a.atMs - b.atMs);
  const initialCash = Number.isFinite(req.initialCash) ? req.initialCash : 100000;
  if (txns.length === 0) throw new UserError("No transactions to chart yet.");

  const firstMs = txns[0].atMs - 2 * DAY_MS;
  const symbols = [...new Set(txns.map((t) => t.symbol))].slice(0, 20);
  const histories = new Map<string, ChartPoint[]>();
  for (const symbol of symbols) {
    histories.set(symbol, await getDailyHistory(symbol, firstMs));
  }
  const spx = await getDailyHistory("^GSPC", firstMs);
  if (spx.length === 0) throw new UserError("Benchmark data unavailable.");

  const closeAt = (points: ChartPoint[], t: number): number | null => {
    let last: number | null = null;
    for (const p of points) {
      if (p.t > t) break;
      last = p.c;
    }
    return last;
  };

  const timeline = spx.filter((p) => p.t >= txns[0].atMs - DAY_MS);
  const portfolio: ValuePoint[] = [];
  for (const day of timeline) {
    let cash = initialCash;
    const shares = new Map<string, number>();
    for (const t of txns) {
      if (t.atMs > day.t) break;
      cash -= t.total;
      shares.set(t.symbol, (shares.get(t.symbol) ?? 0) + t.shares);
    }
    let value = cash;
    let ok = true;
    for (const [symbol, count] of shares) {
      if (Math.abs(count) < 1e-9) continue;
      const close = closeAt(histories.get(symbol) ?? [], day.t);
      if (close == null) {
        ok = false;
        break;
      }
      value += count * close;
    }
    if (ok) portfolio.push({ t: day.t, v: value });
  }
  if (portfolio.length < 2) {
    throw new UserError("Not enough trading days since your first order to chart yet.");
  }

  const benchBase = closeAt(spx, portfolio[0].t) as number;
  const startValue = portfolio[0].v;
  const benchmark: ValuePoint[] = timeline
    .filter((p) => p.t >= portfolio[0].t)
    .map((p) => ({ t: p.t, v: (startValue * p.c) / benchBase }));

  const toSeries = (symbol: string, points: ValuePoint[]): CompareSeries => ({
    symbol,
    points,
    endValue: points[points.length - 1].v,
    returnPercent:
      ((points[points.length - 1].v - points[0].v) / points[0].v) * 100,
  });

  return {
    series: [toSeries("PORTFOLIO", portfolio), toSeries("S&P 500", benchmark)],
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
