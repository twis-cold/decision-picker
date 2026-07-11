# 🎯 Smart Decision Picker

A small, fast web app for the decisions you're tired of making: what to cook, which workout to do, where to go on date night. Hit **Decide for me** and get a suggestion — not purely random, but weighted by what you've loved, skipped, and picked recently.

Glassmorphism UI, zero dependencies, zero build step. Everything runs client-side and persists in `localStorage`.

## Run it

Any static file server works (ES modules need `http://`, not `file://`):

```bash
npx serve .            # or
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

**Deploy:** push to any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages. No build step, no config.

## How the smart picking works

All logic is in [`js/engine.js`](js/engine.js) as pure functions (unit-tested, no DOM). Each option's weight is:

```
weight = affinity × recency
affinity = 1.35^loves × 1.05^fines × 0.55^skips   (clamped, ×1.25 if never tried)
recency  = 0.12 / 0.35 / 0.65 / 1.0 depending on how many suggestions ago it last came up
```

- **Loved it** → suggested noticeably more often
- **Fine** → mild positive (it was accepted)
- **Skip** → suggested less, and excluded for the rest of the current round
- **Never suggest again** → weight 0 until un-banned in the Options panel
- Recently suggested options are heavily deprioritized so it doesn't repeat itself
- Brand-new options get a small exploration bonus so they get a fair shot

## Features

- **Custom categories** with emoji icons; bulk-add options (comma/newline separated)
- **Feedback loop** after every suggestion: Loved it / Fine / Skip / Never again
- **History log** per category (or across all), with outcome chips; names are snapshotted so history survives deletes
- **Odds bars** in the Options panel show each option's current relative chance
- **Starter templates** (Dinner Ideas, Workout Type, Date Night, Movie Genre) for instant onboarding
- **Pro tier scaffolding** (demo — no real payments):
  - Free: 3 categories, no export
  - Pro: unlimited categories, JSON export, **🎲 Surprise me** across all categories

## Architecture

```
index.html          markup shell
css/styles.css      design system (glass tokens, animations)
js/engine.js        weighting + weighted pick — pure functions, unit-tested
js/store.js         persistence behind a swappable adapter (localStorage today)
js/entitlements.js  free/pro plan rules in one place
js/app.js           UI: rendering + event delegation
tests/engine.test.mjs
```

Built to grow without rewrites:

- **Accounts/backend later:** `store.js` exposes a `{ read, write, clear }` adapter interface — swap `localStorageAdapter` for an API-backed one and the app code doesn't change.
- **Real payments later:** all gating goes through `entitlements.js` (`getPlan`, `canAddCategory`, `canExport`, `canSurprise`). Wiring up billing just means setting `settings.plan` from a real source instead of the demo unlock button.

## Tests

```bash
node --test tests/
```
