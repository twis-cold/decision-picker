import { cached } from "./cache";
import { explainMove } from "./explain";
import { fetchFinnhubNews, finnhubEnabled } from "./finnhub";
import {
  mockChart,
  mockMovers,
  mockNews,
  mockQuote,
  mockSearch,
} from "./mock";
import type {
  ChartRange,
  ChartResponse,
  MoversResponse,
  NewsResponse,
  QuoteDetail,
  SearchResponse,
  SparkResponse,
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
};

const useMock = () => process.env.MOCK_DATA === "1";

const SYMBOL_RE = /^[A-Z0-9.^=-]{1,12}$/;

export function normalizeSymbol(raw: string): string {
  const symbol = decodeURIComponent(raw).trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) throw new Error(`Invalid symbol: ${raw}`);
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
