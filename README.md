# Stock Track

A dark, Apple Stocks-inspired stock tracker with live-feeling delayed quotes, favorite tickers, cards, and expanded broker-style chart views.

## Features

- Full-bleed Three.js market scene behind the interface.
- Set a cash amount and see how many shares it buys per symbol.
- Add custom tickers, search the watchlist, and favorite symbols.
- Main-page focus and card sparklines use actual loaded close candles with configurable 1M, 3M, 6M, 1Y, and 5Y ranges.
- Open any stock card for a larger stat view with OHLC, quant metrics, candles, line, returns, technicals, risk, modelled depth, and projections.
- Local projection signals trained in-browser from each ticker's loaded OHLC history: up probability, similar-setup expected move, holdout hit rate, feature drivers, and trend labels.
- Configurable projection settings for forecast horizon, training window, model style, and volume usage.
- Range filters and hover inspection across all expanded chart/data views.
- Forward forecast cards from 1D through 1Y, plus trend labels such as bullish, mixed, and bearish.
- IndexedDB-backed paper trading simulator with trade ticket, local ledger, positions, equity, cash, and P/L.
- About/Privacy area with risk disclosures, local-storage notes, and license information.
- Uses browser local storage for watchlist, favorites, cached quotes, and cash amount.

## Data Sources

- Delayed quote and OHLC history: Yahoo Finance public chart endpoint.
- Browser CORS wrapper: `corsproxy.io`, because the upstream chart endpoint blocks direct browser origins.

No API key is required for the default setup. The data adapter is isolated in `src/services/stocks.ts` so a paid or official feed can replace it later.

## Disclaimers

Stock Track is for exploration, learning, visualization, and paper-trade simulation. It is not a broker, investment adviser,
research provider, or trading system. Nothing in this repository or app is financial, investment, tax, legal, or trading
advice. This is not financial advice.

Use this software and any outputs at your own risk. Quotes may be delayed, incomplete, stale, wrong, or unavailable.
Projection signals are experimental browser-side calculations from historical candles. They are not predictions, guarantees,
or recommendations. You are responsible for your own research, decisions, trades, losses, and use of the app.

Paper trading is simulated locally and never places real orders.

## Privacy

Stock Track has no accounts, authentication, analytics, ads, or project-controlled backend database. Favorites, custom
symbols, cash amount, projection settings, cached quotes, and other preferences are stored in your browser. Paper-trade
entries are stored locally in IndexedDB with a local storage fallback. Clearing browser site data removes local app data.

The default quote adapter requests delayed market data from public endpoints through a public CORS proxy. Those third-party
providers may receive ticker symbols and normal network metadata and may have their own logging, terms, and rate limits.

## License

Stock Track is released under the MIT License. The MIT license text is kept standard and includes the usual as-is,
no-warranty software disclaimer. The finance/projections/privacy language above is product disclosure text, not custom
license terms. See [LICENSE](LICENSE).

## Docs

- [Feature Map](docs/FEATURES.md)
- [App Structure](docs/ARCHITECTURE.md)

## Run Locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```
