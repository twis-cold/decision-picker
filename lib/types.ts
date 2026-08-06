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
