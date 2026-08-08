export interface StockSummary {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  currency: string;
}

export interface MoversResponse {
  gainers: StockSummary[];
  losers: StockSummary[];
  actives: StockSummary[];
  asOf: string;
  sampleData: boolean;
}

export interface SparkResponse {
  symbol: string;
  points: number[];
  previousClose: number | null;
  sampleData: boolean;
}

export type ChartRange = "1D" | "1W" | "1M" | "1Y";

export interface ChartPoint {
  t: number; // unix ms
  c: number; // close price
}

export interface ChartResponse {
  symbol: string;
  range: ChartRange;
  points: ChartPoint[];
  previousClose: number | null;
  sampleData: boolean;
}

export interface QuoteDetail extends StockSummary {
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  trailingPE: number | null;
  avgVolume: number | null;
  beta: number | null;
  dividendYield: number | null; // fraction, e.g. 0.0044 = 0.44%
  exchange: string | null;
  marketState: string | null;
  sampleData: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  url: string;
  publishedAt: string; // ISO
}

export interface Explanation {
  text: string;
  category: string;
}

export interface NewsResponse {
  symbol: string;
  items: NewsItem[];
  explanation: Explanation;
  provider: "finnhub" | "yahoo" | "sample";
  sampleData: boolean;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  sampleData: boolean;
}

export interface ValuePoint {
  t: number; // unix ms
  v: number; // dollar value (or price)
}

export interface HindsightResponse {
  symbol: string;
  name: string | null;
  requestedDate: string; // YYYY-MM-DD as entered
  startDate: string; // ISO of the actual first trading day used
  startPrice: number;
  shares: number;
  amountInvested: number;
  valueNow: number;
  endDate: string; // ISO
  gain: number;
  returnPercent: number;
  series: ValuePoint[];
  sampleData: boolean;
}

export interface JumpResponse {
  symbol: string;
  requestedDate: string; // YYYY-MM-DD as entered
  date: string; // ISO of the actual trading day analyzed
  dateShifted: boolean;
  close: number;
  previousClose: number;
  change: number;
  changePercent: number;
  marketChangePercent: number | null; // S&P 500 that same day
  explanation: Explanation;
  items: NewsItem[];
  provider: "finnhub" | "yahoo" | "sample" | "none";
  series: ChartPoint[]; // daily context around the date
  highlightT: number; // timestamp of the analyzed day within series
  remaining: number | null; // free lookups left today; null = unlimited
  sampleData: boolean;
}

export interface SessionInfo {
  email: string | null;
  pro: boolean;
}

export interface DigestItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  explanation: string;
}

export interface DigestResponse {
  date: string;
  subject: string;
  items: DigestItem[];
  text: string; // ready-to-send markdown body
  sampleData: boolean;
}
