# Stock Track

A dark, Apple Stocks-inspired stock tracker with live-feeling delayed quotes, favorite tickers, cards, and expanded broker-style chart views.

## Features

- Full-bleed Three.js market scene behind the interface.
- Set a cash amount and see how many shares it buys per symbol.
- Add custom tickers, search the watchlist, and favorite symbols.
- Open any stock card for a larger stat view with OHLC, quant metrics, candles, line, returns, technicals, risk, and modelled depth.
- Uses browser local storage for watchlist, favorites, cached quotes, and cash amount.

## Data Sources

- Delayed quote and OHLC history: Yahoo Finance public chart endpoint.
- Browser CORS wrapper: `corsproxy.io`, because the upstream chart endpoint blocks direct browser origins.

No API key is required for the default setup. The data adapter is isolated in `src/services/stocks.ts` so a paid or official feed can replace it later.

## Run Locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```
