import YahooFinance from "yahoo-finance2";
import type {
  ChartPoint,
  ChartRange,
  IndexQuote,
  NewsItem,
  OptionContract,
  QuoteDetail,
  SearchResult,
  StockSummary,
} from "./types";

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

/**
 * yahoo-finance2 validates Yahoo's responses against a schema and throws
 * when Yahoo adds fields. The raw result is still attached to the error,
 * so recover it instead of failing the request.
 */
function unwrapValidationError<T>(err: unknown): T {
  if (err && typeof err === "object" && "result" in err) {
    return (err as { result: T }).result;
  }
  throw err;
}

// Yahoo's screener rows and quote() share the same shape for the fields we use.
interface YahooQuoteLike {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingPE?: number;
  epsTrailingTwelveMonths?: number;
  averageDailyVolume3Month?: number;
  marketCap?: number;
  currency?: string;
  fullExchangeName?: string;
  marketState?: string;
}

function toSummary(q: YahooQuoteLike): StockSummary {
  return {
    symbol: q.symbol,
    name: q.shortName ?? q.longName ?? q.symbol,
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    volume: q.regularMarketVolume ?? 0,
    marketCap: q.marketCap ?? null,
    currency: q.currency ?? "USD",
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
  };
}

async function screen(scrIds: string, count: number): Promise<StockSummary[]> {
  let result: { quotes?: YahooQuoteLike[] };
  try {
    result = (await yf.screener(
      // Cast: the union type of predefined screener ids lags behind what
      // Yahoo actually serves.
      { scrIds: scrIds as "day_gainers", count },
    )) as { quotes?: YahooQuoteLike[] };
  } catch (err) {
    result = unwrapValidationError(err);
  }
  return (result.quotes ?? [])
    .filter((q) => q.symbol && typeof q.regularMarketPrice === "number")
    .slice(0, count)
    .map(toSummary);
}

export const fetchGainers = (count = 8) => screen("day_gainers", count);
export const fetchLosers = (count = 8) => screen("day_losers", count);
export const fetchActives = (count = 8) => screen("most_actives", count);

interface YahooSummaryDetail {
  summaryDetail?: {
    beta?: number;
    dividendYield?: number;
  };
}

export async function fetchQuote(symbol: string): Promise<QuoteDetail> {
  let q: YahooQuoteLike;
  try {
    q = (await yf.quote(symbol)) as YahooQuoteLike;
  } catch (err) {
    q = unwrapValidationError(err);
  }
  if (!q?.symbol) throw new Error(`No quote for ${symbol}`);

  // Beta and dividend yield live in quoteSummary, not quote(); they're
  // nice-to-haves, so a failure here must not sink the whole quote.
  let beta: number | null = null;
  let dividendYield: number | null = null;
  try {
    let qs: YahooSummaryDetail;
    try {
      qs = (await yf.quoteSummary(symbol, {
        modules: ["summaryDetail"],
      })) as YahooSummaryDetail;
    } catch (err) {
      qs = unwrapValidationError(err);
    }
    beta = qs.summaryDetail?.beta ?? null;
    const dy = qs.summaryDetail?.dividendYield;
    // Yahoo reports a fraction (0.0044 = 0.44%) but has been seen flipping
    // to percent units; normalize to a fraction.
    dividendYield = dy == null ? null : dy > 1 ? dy / 100 : dy;
  } catch {
    // leave nulls
  }

  return {
    ...toSummary(q),
    previousClose: q.regularMarketPreviousClose ?? null,
    open: q.regularMarketOpen ?? null,
    dayHigh: q.regularMarketDayHigh ?? null,
    dayLow: q.regularMarketDayLow ?? null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
    trailingPE: q.trailingPE ?? null,
    eps: q.epsTrailingTwelveMonths ?? null,
    avgVolume: q.averageDailyVolume3Month ?? null,
    beta,
    dividendYield,
    exchange: q.fullExchangeName ?? null,
    marketState: q.marketState ?? null,
    sampleData: false,
  };
}

interface YahooChartResult {
  meta?: { chartPreviousClose?: number };
  quotes?: {
    date: Date;
    close: number | null;
    open?: number | null;
    high?: number | null;
    low?: number | null;
  }[];
}

const RANGE_CONFIG: Record<
  ChartRange,
  { days: number; interval: "5m" | "30m" | "1d" | "1wk" | "1mo" }
> = {
  "1D": { days: 6, interval: "5m" }, // over-fetch, then slice to the last session
  "1W": { days: 8, interval: "30m" },
  "1M": { days: 32, interval: "1d" },
  "1Y": { days: 366, interval: "1d" },
  "5Y": { days: 5 * 366, interval: "1wk" },
  MAX: { days: 40 * 366, interval: "1mo" },
};

export async function fetchChart(
  symbol: string,
  range: ChartRange,
): Promise<{ points: ChartPoint[]; previousClose: number | null }> {
  const { days, interval } = RANGE_CONFIG[range];
  let result: YahooChartResult;
  try {
    result = (await yf.chart(symbol, {
      period1: new Date(Date.now() - days * 24 * 3600 * 1000),
      interval,
    })) as YahooChartResult;
  } catch (err) {
    result = unwrapValidationError(err);
  }

  let points: ChartPoint[] = (result.quotes ?? [])
    .filter((q) => q.close != null)
    .map((q) => ({
      t: new Date(q.date).getTime(),
      c: q.close as number,
      ...(q.open != null && q.high != null && q.low != null
        ? { o: q.open, h: q.high, l: q.low }
        : {}),
    }));

  if (range === "1D" && points.length > 0) {
    // Keep only the most recent trading session. Sessions are ~6.5h and
    // at least ~17h apart, so a 16h window never spans two of them.
    const last = points[points.length - 1].t;
    points = points.filter((p) => p.t >= last - 16 * 3600 * 1000);
  }

  return {
    points,
    previousClose: result.meta?.chartPreviousClose ?? null,
  };
}

export async function fetchSpark(
  symbol: string,
): Promise<{ points: number[]; previousClose: number | null }> {
  const { points, previousClose } = await fetchChart(symbol, "1D");
  return { points: points.map((p) => p.c), previousClose };
}

/** Daily closes between two dates (for the hindsight calculator / jump lookup). */
export async function fetchDailyHistory(
  symbol: string,
  period1: Date,
  period2?: Date,
): Promise<ChartPoint[]> {
  let result: YahooChartResult;
  try {
    result = (await yf.chart(symbol, {
      period1,
      ...(period2 ? { period2 } : {}),
      interval: "1d",
    })) as YahooChartResult;
  } catch (err) {
    result = unwrapValidationError(err);
  }
  return (result.quotes ?? [])
    .filter((q) => q.close != null)
    .map((q) => ({ t: new Date(q.date).getTime(), c: q.close as number }));
}

interface YahooSearchResult {
  quotes?: {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    typeDisp?: string;
    quoteType?: string;
  }[];
  news?: {
    uuid?: string;
    title?: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: Date | number;
  }[];
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  let result: YahooSearchResult;
  try {
    result = (await yf.search(query, {
      quotesCount: 8,
      newsCount: 0,
    })) as YahooSearchResult;
  } catch (err) {
    result = unwrapValidationError(err);
  }
  return (result.quotes ?? [])
    .filter(
      (q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"),
    )
    .slice(0, 8)
    .map((q) => ({
      symbol: q.symbol as string,
      name: q.shortname ?? q.longname ?? (q.symbol as string),
      exchange: q.exchDisp ?? null,
      type: q.typeDisp ?? null,
    }));
}

export const INDEX_SYMBOLS: { symbol: string; label: string }[] = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^DJI", label: "DOW" },
  { symbol: "^FTSE", label: "FTSE 100" },
  { symbol: "^NSEI", label: "NIFTY 50" },
];

export async function fetchIndices(): Promise<IndexQuote[]> {
  const settled = await Promise.allSettled(
    INDEX_SYMBOLS.map(async ({ symbol, label }) => {
      let q: YahooQuoteLike;
      try {
        q = (await yf.quote(symbol)) as YahooQuoteLike;
      } catch (err) {
        q = unwrapValidationError(err);
      }
      return {
        symbol,
        label,
        value: q.regularMarketPrice ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
      };
    }),
  );
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<IndexQuote> => r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((i) => i.value > 0);
}

interface YahooOptionsResult {
  expirationDates?: Date[];
  options?: {
    expirationDate?: Date;
    calls?: { strike?: number; lastPrice?: number; bid?: number; ask?: number }[];
    puts?: { strike?: number; lastPrice?: number; bid?: number; ask?: number }[];
  }[];
}

/** Near-term options chain (nearest expiration only, strikes around ATM). */
export async function fetchOptions(
  symbol: string,
  spot: number,
): Promise<{ expiration: string | null; calls: OptionContract[]; puts: OptionContract[] }> {
  let result: YahooOptionsResult;
  try {
    result = (await yf.options(symbol, {})) as YahooOptionsResult;
  } catch (err) {
    result = unwrapValidationError(err);
  }
  const chain = result.options?.[0];
  if (!chain) return { expiration: null, calls: [], puts: [] };

  const trim = (
    rows: { strike?: number; lastPrice?: number; bid?: number; ask?: number }[] = [],
  ): OptionContract[] =>
    rows
      .filter((r) => r.strike != null)
      .map((r) => ({
        strike: r.strike as number,
        last: r.lastPrice ?? null,
        bid: r.bid ?? null,
        ask: r.ask ?? null,
      }))
      .sort(
        (a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot),
      )
      .slice(0, 12)
      .sort((a, b) => a.strike - b.strike);

  return {
    expiration: chain.expirationDate
      ? new Date(chain.expirationDate).toISOString().slice(0, 10)
      : null,
    calls: trim(chain.calls),
    puts: trim(chain.puts),
  };
}

interface YahooFinancialData {
  financialData?: {
    targetMeanPrice?: number;
    recommendationKey?: string;
    numberOfAnalystOpinions?: number;
  };
}

/** Average analyst price target + consensus key (free via quoteSummary). */
export async function fetchYahooRatings(
  symbol: string,
): Promise<{ targetMean: number | null; recommendation: string | null }> {
  let qs: YahooFinancialData;
  try {
    qs = (await yf.quoteSummary(symbol, {
      modules: ["financialData"],
    })) as YahooFinancialData;
  } catch (err) {
    qs = unwrapValidationError(err);
  }
  return {
    targetMean: qs.financialData?.targetMeanPrice ?? null,
    recommendation: qs.financialData?.recommendationKey ?? null,
  };
}

export async function fetchYahooNews(symbol: string): Promise<NewsItem[]> {
  let result: YahooSearchResult;
  try {
    result = (await yf.search(symbol, {
      quotesCount: 0,
      newsCount: 8,
    })) as YahooSearchResult;
  } catch (err) {
    result = unwrapValidationError(err);
  }
  return (result.news ?? [])
    .filter((n) => n.title && n.link)
    .map((n, i) => ({
      id: n.uuid ?? `${symbol}-${i}`,
      title: n.title as string,
      summary: null,
      source: n.publisher ?? "Yahoo Finance",
      url: n.link as string,
      publishedAt: new Date(n.providerPublishTime ?? Date.now()).toISOString(),
    }));
}
