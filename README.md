# Trending Stocks Dashboard

A minimalist, black-themed stock market dashboard inspired by trading
terminals. Shows today's top gainers, losers, and most active stocks with
live prices, intraday sparklines, and a plain-English **"Why is this
moving"** explanation generated from recent news headlines.

Built with **Next.js 15** (App Router, TypeScript) and custom SVG charts —
no charting library, no UI framework.

## Features

- **Market movers** — top gainers, top losers, and most active by volume,
  auto-refreshing every 60 seconds (with a brief green/red flash when a
  price ticks)
- **Why is this moving** — expandable panel under each card that classifies
  recent headlines (earnings, analyst actions, M&A, regulatory, …) into a
  one-line explanation of the likely catalyst
- **Stock detail pages** — interactive price chart with 1D / 1W / 1M / 1Y
  ranges and crosshair tooltip, key stats (market cap, P/E, 52-week
  high/low, volume), and the related headlines
- **Ticker search** with keyboard navigation
- Fully responsive, terminal-style dark UI

## Data sources & tradeoffs

| Source | Used for | Key needed |
|---|---|---|
| Yahoo Finance (unofficial, via [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2)) | Movers screeners, quotes, charts, search, fallback news | No |
| [Finnhub](https://finnhub.io) (optional) | Richer company news for the "why it's moving" panel | Free key |

Why this combination: Yahoo's unofficial API is the only free source with
a **movers screener** (gainers/losers/actives) plus unlimited-ish quotes
and history, so the app works with **zero API keys**. The tradeoff is that
it's unofficial — no SLA, and Yahoo occasionally changes things
(`yahoo-finance2` is actively maintained and tracks those changes).
Finnhub's free tier (60 calls/min) has excellent per-ticker news but no
movers endpoint, so it slots in as the optional news upgrade.
Alpha Vantage was ruled out (25 requests/day free limit can't survive a
60-second refresh), and Twelve Data's free tier (8 requests/min) is too
tight for three screener lists plus sparklines.

All market data is fetched **server-side** through Next.js API routes with
an in-memory TTL cache (movers 55s, quotes 30s, charts 2–10min, news
10min), so the browser never talks to the providers directly, API keys
stay on the server, and polling every 60 seconds stays well inside free
rate limits no matter how many tabs are open.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. That's it — no API key required.

### Optional: better news via Finnhub

1. Create a free account at <https://finnhub.io/register>
2. Copy your API key from the dashboard
3. Create `.env.local` (see `.env.example`):

```bash
FINNHUB_API_KEY=your_key_here
```

Without a key, headlines come from Yahoo Finance; with one, the "why is
this moving" panel uses Finnhub's per-ticker company news (which includes
one-line summaries).

### Sample data mode

To run without any network access (offline dev, demos, CI):

```bash
MOCK_DATA=1 npm run dev
```

The UI shows a **SAMPLE DATA** badge and serves deterministic generated
data so you can see every feature without hitting a real API.

## Deploying

The app is Vercel-ready:

1. Push this repo to GitHub
2. Import it at <https://vercel.com/new>
3. (Optional) add `FINNHUB_API_KEY` under Project → Settings → Environment
   Variables

Note: the cache is in-memory per serverless instance, which is fine for a
personal project — a cold instance just refetches once.

## Project structure

```
app/
  page.tsx               # dashboard (movers)
  stock/[symbol]/        # stock detail page
  api/                   # server-side data proxy (movers, quote, chart,
                         #   spark, news, search)
components/              # Dashboard, StockCard, PriceChart, Sparkline,
                         #   SearchBar, WhyPanel, …
lib/
  yahoo.ts               # Yahoo Finance access (yahoo-finance2)
  finnhub.ts             # Finnhub company news
  explain.ts             # headline classifier → plain-English explanation
  cache.ts               # TTL cache + request dedupe + stale-on-error
  mock.ts                # deterministic sample data (MOCK_DATA=1)
```

## Disclaimer

Quotes may be delayed and the "why is this moving" text is a heuristic
guess from headlines. This is a portfolio project — nothing here is
investment advice.
