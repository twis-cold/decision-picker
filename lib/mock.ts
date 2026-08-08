import type {
  ChartPoint,
  ChartRange,
  EarningsItem,
  NewsItem,
  QuoteDetail,
  SearchResult,
  StockSummary,
} from "./types";

/**
 * Deterministic sample data for running the app without network access or
 * API keys (`MOCK_DATA=1`). Prices are a seeded random walk, stable within
 * a day, so refreshes look plausible without real data. Every payload built
 * from here is flagged `sampleData: true` and the UI shows a SAMPLE DATA badge.
 */

const UNIVERSE: { symbol: string; name: string; base: number; cap: number }[] =
  [
    { symbol: "NVDA", name: "NVIDIA Corporation", base: 182, cap: 4.4e12 },
    { symbol: "AAPL", name: "Apple Inc.", base: 214, cap: 3.2e12 },
    { symbol: "MSFT", name: "Microsoft Corporation", base: 512, cap: 3.8e12 },
    { symbol: "TSLA", name: "Tesla, Inc.", base: 308, cap: 9.9e11 },
    { symbol: "AMZN", name: "Amazon.com, Inc.", base: 222, cap: 2.3e12 },
    { symbol: "META", name: "Meta Platforms, Inc.", base: 768, cap: 1.9e12 },
    { symbol: "GOOGL", name: "Alphabet Inc.", base: 196, cap: 2.4e12 },
    { symbol: "AMD", name: "Advanced Micro Devices", base: 172, cap: 2.8e11 },
    { symbol: "PLTR", name: "Palantir Technologies", base: 158, cap: 3.7e11 },
    { symbol: "SMCI", name: "Super Micro Computer", base: 58, cap: 3.4e10 },
    { symbol: "INTC", name: "Intel Corporation", base: 20, cap: 8.7e10 },
    { symbol: "F", name: "Ford Motor Company", base: 11, cap: 4.4e10 },
    { symbol: "SOFI", name: "SoFi Technologies", base: 21, cap: 2.3e10 },
    { symbol: "NIO", name: "NIO Inc.", base: 4.8, cap: 1.0e10 },
    { symbol: "COIN", name: "Coinbase Global", base: 310, cap: 7.9e10 },
    { symbol: "UBER", name: "Uber Technologies", base: 92, cap: 1.9e11 },
    { symbol: "DIS", name: "The Walt Disney Company", base: 119, cap: 2.2e11 },
    { symbol: "BA", name: "The Boeing Company", base: 226, cap: 1.7e11 },
    { symbol: "PFE", name: "Pfizer Inc.", base: 25, cap: 1.4e11 },
    { symbol: "RIVN", name: "Rivian Automotive", base: 13, cap: 1.5e10 },
    { symbol: "LCID", name: "Lucid Group", base: 2.4, cap: 7.3e9 },
    { symbol: "SNAP", name: "Snap Inc.", base: 9, cap: 1.5e10 },
    { symbol: "SHOP", name: "Shopify Inc.", base: 132, cap: 1.7e11 },
    { symbol: "NFLX", name: "Netflix, Inc.", base: 1180, cap: 5.0e11 },
  ];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function rngFor(symbol: string): () => number {
  return mulberry32(hashString(symbol + dayKey()));
}

function mockSummary(u: (typeof UNIVERSE)[number]): StockSummary {
  const rng = rngFor(u.symbol);
  const changePercent = (rng() - 0.48) * 16; // roughly -7.7%..+8.3%
  const price = u.base * (1 + changePercent / 100);
  return {
    symbol: u.symbol,
    name: u.name,
    price: round2(price),
    change: round2(price - u.base),
    changePercent: round2(changePercent),
    volume: Math.floor(rng() * 180e6) + 5e6,
    marketCap: u.cap,
    currency: "USD",
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function universeFor(symbol: string) {
  return (
    UNIVERSE.find((u) => u.symbol === symbol.toUpperCase()) ?? {
      symbol: symbol.toUpperCase(),
      name: `${symbol.toUpperCase()} (Sample Co.)`,
      base: 50 + (hashString(symbol) % 400),
      cap: 5e10,
    }
  );
}

export function mockMovers(): {
  gainers: StockSummary[];
  losers: StockSummary[];
  actives: StockSummary[];
} {
  const all = UNIVERSE.map(mockSummary);
  const gainers = [...all]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 8);
  const losers = [...all]
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 8);
  const actives = [...all].sort((a, b) => b.volume - a.volume).slice(0, 8);
  return { gainers, losers, actives };
}

export function mockQuote(symbol: string): QuoteDetail {
  const u = universeFor(symbol);
  const s = mockSummary(u);
  const rng = rngFor(symbol + ":detail");
  const prevClose = round2(s.price - s.change);
  return {
    ...s,
    previousClose: prevClose,
    open: round2(prevClose * (1 + (rng() - 0.5) * 0.01)),
    dayHigh: round2(Math.max(s.price, prevClose) * (1 + rng() * 0.015)),
    dayLow: round2(Math.min(s.price, prevClose) * (1 - rng() * 0.015)),
    fiftyTwoWeekHigh: round2(u.base * (1.2 + rng() * 0.4)),
    fiftyTwoWeekLow: round2(u.base * (0.5 + rng() * 0.2)),
    trailingPE: round2(8 + rng() * 60),
    avgVolume: Math.floor(rng() * 80e6) + 10e6,
    beta: round2(0.5 + rng() * 1.6),
    dividendYield: rng() < 0.4 ? round2(rng() * 3) / 100 : null,
    exchange: "NasdaqGS (sample)",
    marketState: "REGULAR",
    sampleData: true,
  };
}

const RANGE_STEPS: Record<ChartRange, { points: number; stepMs: number }> = {
  "1D": { points: 78, stepMs: 5 * 60 * 1000 },
  "1W": { points: 65, stepMs: 30 * 60 * 1000 },
  "1M": { points: 22, stepMs: 24 * 3600 * 1000 },
  "1Y": { points: 252, stepMs: 24 * 3600 * 1000 },
};

export function mockChart(
  symbol: string,
  range: ChartRange,
): { points: ChartPoint[]; previousClose: number } {
  const u = universeFor(symbol);
  const s = mockSummary(u);
  const prevClose = round2(s.price - s.change);
  const { points: n, stepMs } = RANGE_STEPS[range];
  const rng = rngFor(symbol + ":" + range);
  const drift = (s.price - prevClose) / n;
  const vol = u.base * (range === "1D" ? 0.003 : 0.012);

  const out: ChartPoint[] = [];
  let value = range === "1D" ? prevClose : u.base * (0.85 + rng() * 0.2);
  const start = Date.now() - n * stepMs;
  for (let i = 0; i < n; i++) {
    value += drift + (rng() - 0.5) * vol;
    out.push({ t: start + i * stepMs, c: round2(value) });
  }
  out[out.length - 1].c = s.price; // land on the "current" price
  return { points: out, previousClose: prevClose };
}

const HEADLINE_TEMPLATES: [string, string][] = [
  [
    "{name} beats Q2 earnings estimates, raises full-year guidance",
    "Revenue came in ahead of consensus as management lifted its outlook for the remainder of the year.",
  ],
  [
    "Analyst upgrades {symbol} to Buy, sets new price target",
    "The upgrade cites improving margins and a stronger demand backdrop heading into next quarter.",
  ],
  [
    "{name} announces expanded partnership with major cloud provider",
    "The multi-year deal broadens distribution and is expected to contribute to revenue growth.",
  ],
  [
    "Sector selloff pressures {symbol} as rates climb",
    "Broader risk-off sentiment weighed on the group, with high-multiple names hit hardest.",
  ],
  [
    "{name} unveils next-generation product lineup",
    "Early reviews highlight performance gains that could support upgrade demand.",
  ],
];

export function mockNews(symbol: string): NewsItem[] {
  const u = universeFor(symbol);
  const rng = rngFor(symbol + ":news");
  const start = Math.floor(rng() * HEADLINE_TEMPLATES.length);
  return Array.from({ length: 4 }, (_, i) => {
    const [title, summary] =
      HEADLINE_TEMPLATES[(start + i) % HEADLINE_TEMPLATES.length];
    return {
      id: `${symbol}-sample-${i}`,
      title: title.replaceAll("{name}", u.name).replaceAll("{symbol}", u.symbol),
      summary,
      source: "Sample Wire",
      url: "https://example.com/sample-news",
      publishedAt: new Date(
        Date.now() - (i + 1) * (2 + rng() * 6) * 3600 * 1000,
      ).toISOString(),
    };
  });
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Deterministic daily-close history: a smooth pseudo-random function of the
 * absolute day index (layered sines seeded per symbol), so any two requests
 * for overlapping date ranges agree with each other. Weekends are skipped.
 */
export function mockDailyHistory(
  symbol: string,
  fromMs: number,
  toMs: number = Date.now(),
): ChartPoint[] {
  const u = universeFor(symbol);
  const seed = hashString(u.symbol + ":hist");
  const s1 = (seed % 1000) / 159;
  const s2 = (seed % 3331) / 530;
  const s3 = (seed % 7907) / 1258;

  const out: ChartPoint[] = [];
  for (let t = fromMs; t <= toMs; t += DAY_MS) {
    const day = new Date(t).getUTCDay();
    if (day === 0 || day === 6) continue; // weekend
    const d = Math.floor(t / DAY_MS);
    const f =
      0.5 +
      0.25 * Math.sin(d / 23 + s1) +
      0.15 * Math.sin(d / 7 + s2) +
      0.1 * Math.sin(d / 3.1 + s3);
    out.push({
      t: Date.UTC(
        new Date(t).getUTCFullYear(),
        new Date(t).getUTCMonth(),
        new Date(t).getUTCDate(),
        14,
        30,
      ),
      c: round2(u.base * (0.55 + 0.45 * f)),
    });
  }
  return out;
}

/**
 * Headlines "from around" a past date — seeded by symbol+date, and only
 * ~60% of the time, so the honest "no news found" path gets exercised too.
 */
export function mockJumpNews(symbol: string, dateStr: string): NewsItem[] {
  const u = universeFor(symbol);
  const rng = mulberry32(hashString(symbol + ":" + dateStr));
  if (rng() > 0.6) return [];
  const start = Math.floor(rng() * HEADLINE_TEMPLATES.length);
  const base = new Date(dateStr + "T13:00:00Z").getTime();
  return Array.from({ length: 2 + Math.floor(rng() * 2) }, (_, i) => {
    const [title, summary] =
      HEADLINE_TEMPLATES[(start + i) % HEADLINE_TEMPLATES.length];
    return {
      id: `${symbol}-${dateStr}-sample-${i}`,
      title: title.replaceAll("{name}", u.name).replaceAll("{symbol}", u.symbol),
      summary,
      source: "Sample Wire",
      url: "https://example.com/sample-news",
      publishedAt: new Date(base - i * 9 * 3600 * 1000).toISOString(),
    };
  });
}

/**
 * Deterministic earnings calendar. Each universe ticker gets one canonical
 * report slot on a weekday within the current two-week stretch — seeded by
 * the week, NOT the query window — so "today" queries and full-window
 * queries always agree with each other.
 */
export function mockEarnings(from: string, to: string): EarningsItem[] {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  const now = new Date();
  // Monday of the current UTC week anchors the schedule.
  const monday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
  );

  const out: EarningsItem[] = [];
  for (const u of UNIVERSE) {
    const rng = mulberry32(hashString(u.symbol + ":earn:" + monday));
    if (rng() > 0.6) continue; // not everyone reports this fortnight
    const weekdayIndex = Math.floor(rng() * 10); // Mon–Fri, this week + next
    const t =
      monday + (weekdayIndex + Math.floor(weekdayIndex / 5) * 2) * DAY_MS;
    if (t < fromMs || t > toMs) continue;
    out.push({
      symbol: u.symbol,
      date: new Date(t).toISOString().slice(0, 10),
      hour: rng() < 0.5 ? "bmo" : "amc",
      epsEstimate: round2(rng() * 4 + 0.1),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function mockSearch(query: string): SearchResult[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  return UNIVERSE.filter(
    (u) =>
      u.symbol.startsWith(q) || u.name.toUpperCase().includes(q),
  )
    .slice(0, 8)
    .map((u) => ({
      symbol: u.symbol,
      name: u.name,
      exchange: "SAMPLE",
      type: "Equity",
    }));
}
