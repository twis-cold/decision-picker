# Trending Stocks Dashboard

A minimalist, black-themed stock market dashboard inspired by trading
terminals. Shows today's top gainers, losers, and most active stocks with
live prices, intraday sparklines, and a plain-English **"Why is this
moving"** explanation generated from recent news headlines.

Built with **Next.js 15** (App Router, TypeScript) and custom SVG charts —
no charting library, no UI framework.

## Features

- **Market movers** — top gainers, top losers, and most active by volume,
  auto-refreshing every 60 seconds (30s for Pro), with a brief green/red
  flash when a price ticks
- **Why is this moving** — expandable panel under each card that classifies
  recent headlines (earnings, analyst actions, M&A, regulatory, …) into a
  one-line explanation of the likely catalyst
- **Stock detail pages** — interactive price chart with 1D / 1W / 1M / 1Y
  ranges and crosshair tooltip, key stats, and the related headlines
- **Beginner Mode** — a nav toggle (persisted in localStorage) that adds
  "?" bubbles next to every stat with one-sentence plain-English
  explanations of P/E, market cap, beta, dividend yield, and the rest
- **What Would I Have Made** (`/hindsight`) — pick a ticker, a past date,
  and an amount; see today's value, % return, and a value-over-time chart.
  Results are shareable: permalink + downloadable PNG card
- **Explain the Jump** (`/jump`) — pick a ticker and a past date; see how
  the stock moved that day and why, reconstructed from headlines of the
  time, with an S&P 500 comparison. When no clear cause exists, it says so
  honestly instead of inventing one. Free tier: 3 lookups/day
- **Watchlist** (`/watchlist`, free) — star any stock card or detail page to
  save it; quick-view strip on the homepage; live prices in the same format
  as the dashboard. Stored in localStorage (works signed-out); a TODO in
  `components/AppProviders.tsx` marks the seam for account/DB persistence
  once real auth lands
- **Earnings calendar** (`/earnings`) — who reports this week and next,
  before open or after close, with a "my companies only" watchlist filter.
  Stocks reporting today get a small EARNINGS BMO/AMC badge on their cards
  across the app. Uses Finnhub's `/calendar/earnings` (free tier, same
  `FINNHUB_API_KEY` as news — no extra provider needed)
- **Comparison view** (`/compare`) — $100 into 2–3 tickers on the same
  start date, plotted on one normalized chart (1M/6M/1Y/5Y/custom ranges)
  with a per-ticker return table. Reuses the hindsight history pipeline;
  line colors are a colorblind-checked cyan/amber/violet trio, deliberately
  distinct from the green/red gain/loss coding
- **Market indices strip** — S&P 500, Nasdaq, Dow, FTSE 100, and Nifty 50
  with live value + % change, shown as a compact bar under the nav on
  every page
- **52-week highs & lows** — a dashboard section (alongside gainers/
  losers/actives) surfacing stocks within ~3% of their 52-week high or low
- **Advanced charting** — on stock detail pages: line / candlestick / bar
  chart types, ranges out to 5Y and MAX, and toggleable indicators (SMA,
  EMA, Bollinger Bands overlaid on price; RSI and MACD as sub-panels
  below), all computed client-side from the same price series — no extra
  API calls, off by default so the chart stays clean
- **Financials tab** — quarterly/annual Income Statement, Balance Sheet,
  and Cash Flow, as reported to Finnhub's free tier
- **Options chain** — a minimal near-term calls/puts table (strike,
  last/bid/ask) via Yahoo; reference only, no greeks or IV modeling, and
  nothing here is ever tradable (see Paper Trading below)
- **Analyst ratings** — consensus buy/hold/sell breakdown (Finnhub) and
  average price target (Yahoo) on every stock detail page
- **Paper trading** (`/portfolio`) — a simulated brokerage account funded
  with $100,000 in fake cash. Market, limit, and stop-loss orders (day or
  GTC) from any stock page; holdings, day P&L, unrealized gain/loss, an
  allocation donut chart, full transaction history, and a performance
  chart vs. the S&P 500 (reusing the comparison-view chart). **No real
  money, brokerage, or order routing is ever involved** — labeled
  "PAPER — NOT REAL MONEY" throughout
- **News feed** (`/news`) — live headlines filterable by category
  (general/M&A/crypto/forex) or ticker, reusing the same news pipeline as
  "why is this moving" and "Explain the Jump"
- **Alerts & notifications** (`/alerts`) — price-above, price-below, and
  unusual-volume alerts per ticker, plus automatic notifications when a
  watchlist stock reports earnings. Delivered as in-app notifications via
  the bell icon in the nav, checked roughly once a minute while the site
  is open
- **Ticker search** with keyboard navigation
- Fully responsive, terminal-style dark UI

## Monetization scaffolding

All of it works out of the box in demo mode and upgrades to the real
service when you add keys:

- **Ad slots** — placeholder components (`components/AdSlot.tsx`) in three
  standard formats: desktop sidebar rail (300×600), horizontal banner, and
  native in-feed. Swap the placeholder markup for AdSense units when you
  have an account (instructions in the component). Never shown to Pro
  users, and never on the hindsight / jump result pages (kept
  screenshot-clean on purpose)
- **Pro tier** (`/pro`, $5/mo) — no ads, unlimited Explain-the-Jump
  lookups, 30s refresh. Payments via **Stripe Checkout** (test mode):
  set `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID`; without them the upgrade
  button applies a clearly-labeled demo upgrade. A webhook handler
  (`/api/stripe/webhook`) verifies signatures and marks where a real
  deployment would persist subscription state
- **Auth** — deliberately simple email sign-in with HMAC-signed cookie
  sessions and **no database** (the UI says so). The login route is the
  single seam to swap for magic links / NextAuth / Clerk in production
- **Newsletter** — signup forms in the footer and after the hindsight /
  jump results, wired for **Buttondown** (`BUTTONDOWN_API_KEY`; demo mode
  without it). The intended content already exists: `GET /api/digest`
  returns a ready-to-send "Top 3 Unusual Moves Today" markdown digest
  built from the same movers + explanation pipeline — point a daily cron
  at it and pipe `text` into Buttondown's send API to automate it

## Data sources & tradeoffs

| Source | Used for | Key needed |
|---|---|---|
| Yahoo Finance (unofficial, via [`yahoo-finance2`](https://github.com/gadicc/yahoo-finance2)) | Movers screeners, quotes, charts (incl. OHLC + 5Y/MAX), history (also feeds hindsight/compare/paper performance), search, fallback news, indices, options chain, average analyst price target | No |
| [Finnhub](https://finnhub.io) (optional) | Company news, historical headlines for "Explain the Jump", earnings calendar, financial statements as reported, analyst recommendation trends, general news feed | Free key |

### Where the free tiers fall short

Flagging this explicitly, as it determines what would need a paid API
upgrade later:

- **Financial statements** (Finnhub `/stock/financials-reported`, free
  tier): only a handful of recent periods are returned, and line-item
  labels are each company's own as-filed wording rather than a normalized
  schema — fine for a quick look, not for cross-company comparison at
  scale. A paid plan or a provider like Alpha Vantage's fundamentals
  endpoints would give deeper, normalized history.
- **Earnings call transcripts**: not available on Finnhub's free tier at
  all. Skipped rather than faked — see the `TODO` in
  `components/Financials.tsx`.
- **Options data**: sourced from Yahoo's unofficial chain endpoint, which
  only reliably returns the *nearest* expiration and no greeks/IV. Treated
  purely as a reference table.
- **Economic calendar** (Fed decisions, CPI, jobs reports, …): Finnhub
  gates `/calendar/economic` behind a paid plan, and Yahoo has no public
  equivalent. Rather than show fabricated events, the Earnings Calendar
  page says so explicitly — see the `TODO` in
  `components/EarningsCalendar.tsx`. A dedicated provider (e.g. Trading
  Economics, FMP's paid tier) would be needed to add this for real.
- **Real push notifications**: alerts are in-app only (bell icon +
  `/alerts` inbox), checked while a tab is open. True push notifications
  need a service worker + subscription store, noted as a `TODO` in
  `components/PaperProvider.tsx` rather than half-built.

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
10min, history 10min), so the browser never talks to the providers
directly, API keys stay on the server, and polling stays well inside free
rate limits no matter how many tabs are open.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. That's it — no API key required.

### Environment variables

All optional — see `.env.example` for full notes. Create `.env.local`:

| Variable | Enables | Without it |
|---|---|---|
| `FINNHUB_API_KEY` | Richer news, historical headlines for jump lookups, earnings calendar, financial statements, analyst recommendation counts, categorized news feed ([free key](https://finnhub.io/register)) | Yahoo news fallback; jump lookups >1wk old show "no headline archive"; earnings/financials pages explain they need the key; ratings fall back to Yahoo's price target only |
| `AUTH_SECRET` | Proper cookie signing (`openssl rand -hex 32`) | Insecure dev default |
| `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` | Real Stripe Checkout (test mode fine) | Demo upgrade button |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Webhook returns 501 |
| `BUTTONDOWN_API_KEY` | Real newsletter signups | Demo signup (logged only) |
| `MOCK_DATA=1` | Deterministic sample data, no network (badged in the UI) | Live data |

### Setting up Stripe (test mode)

1. Create a [Stripe account](https://dashboard.stripe.com/register), stay
   in **test mode**
2. Products → Add product → recurring $5/month → copy the price id
   (`price_…`) into `STRIPE_PRICE_ID`
3. Developers → API keys → copy the secret key (`sk_test_…`) into
   `STRIPE_SECRET_KEY`
4. Optional: Developers → Webhooks → add endpoint
   `https://your-domain/api/stripe/webhook`, copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`
5. Test card: `4242 4242 4242 4242`, any future expiry/CVC

**Production caveat (by design):** this project has no database, so Pro
status lives in the signed session cookie set after checkout verification.
Renewal failures and cancellations therefore can't downgrade anyone
automatically — for a real launch, persist `email → subscription status`
in the webhook handler (the TODOs mark the exact spots) and check that
instead of the cookie.

## Deploying

Vercel-ready: import the repo at <https://vercel.com/new>, add whichever
env vars you use, deploy. The in-memory cache is per serverless instance,
which is fine for a personal project.

## Project structure

```
app/
  page.tsx               # dashboard (movers + 52w highs/lows)
  stock/[symbol]/        # stock detail: chart, financials, options tabs
  watchlist/  earnings/  news/  compare/   # free feature pages
  hindsight/  jump/                        # viral/shareable lookups
  portfolio/  alerts/                      # paper trading + notifications
  pro/  account/         # pricing + sign-in
  api/                   # server-side data proxy + auth, stripe,
                         #   newsletter, digest, paper-performance endpoints
components/              # Dashboard, StockCard, PriceChart (chart types +
                         #   indicators), MultiLineChart, OrderPanel,
                         #   PortfolioView, AllocationDonut, NewsFeed,
                         #   Ratings, Financials, OptionsChain, AlertForm,
                         #   NotificationsBell, AdSlot, GlossaryTip, …
lib/
  yahoo.ts               # Yahoo Finance access (yahoo-finance2)
  finnhub.ts             # Finnhub news, earnings, financials, ratings
  indicators.ts           # SMA/EMA/RSI/MACD/Bollinger math (client-side)
  paper.ts                # paper-trading engine: orders, fills, alerts
  explain.ts             # headline classifier → plain-English explanation
  glossary.ts            # Beginner Mode definitions
  auth.ts                # signed-cookie sessions + jump quota
  cache.ts               # TTL cache + request dedupe + stale-on-error
  mock.ts                # deterministic sample data (MOCK_DATA=1)
```

## Disclaimer

Quotes may be delayed and the "why is this moving" text is a heuristic
guess from headlines. **Not financial advice** — this is a portfolio
project for education and entertainment.

**All trading on this site is simulated.** The Portfolio, order form, and
alerts pages use fake starting cash against the site's own (delayed)
quotes — there is no real brokerage integration, no real order execution,
and no real money at any point. This is stated on every relevant page and
in the footer; it is not a real trading platform and never places a real
order anywhere.
