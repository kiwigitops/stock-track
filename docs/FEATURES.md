# Feature Map

## Market Workspace

- Delayed stock quote cards for the default watchlist and user-added symbols.
- Favorites pin symbols near the front of the market view.
- Search filters symbols by ticker or company name.
- Cash amount is shared by watch cards and paper trading.
- Full-screen Three.js market scene responds to market direction.
- Top-level tabs switch between Market, Paper, and About.

## Expanded Stock Modal

- Price, previous close, day high/low, volume, and 52-week range.
- One-year quant metrics: return, annualized volatility, max drawdown, percentile, z-score, and sample count.
- Dataset cards explain quote source, CORS proxy, local calculations, candle source, modelled depth, and local projections.
- Broker chart tabs:
  - Candles
  - Line
  - Returns
  - Technicals
  - Risk
  - Depth
  - Projections
- All broker chart/data views share visible-range filters: 1M, 3M, 6M, 1Y, and 5Y.
- Expanded graphs have labels, legends, calculation descriptions, and hover/touch inspection.

## Projection Signals

- Configurable horizon: 1D, 1W, 1M, 3M, 6M, or 1Y.
- Configurable training window: 1Y, 2Y, 3Y, or 5Y.
- Configurable model style: balanced, momentum, or mean reversion.
- Optional volume feature toggle.
- Outputs up probability, expected move, confidence, holdout hit rate, regime, and trend.
- Forward forecast cards show expected move and up probability from 1D through 1Y.
- Projections tab shows probability history, feature contribution bars, forecast strip, trend components, and closest historical setups.
- Hover/focus info markers explain model options, chart calculations, and projection drivers.

## Paper Trading

- Paper trades are saved locally in IndexedDB.
- Trade ticket records buy/sell, symbol, quantity, price, and optional note.
- Portfolio view recalculates cash, market value, equity, unrealized P/L, realized P/L, and total P/L from saved trades.
- Positions are marked to current delayed quote prices.
- Ledger shows recent paper trades and can be reset locally.

## About And Privacy

- About workspace explains that Stock Track is not a broker, adviser, research provider, or trading system.
- Risk disclosures cover delayed quotes, experimental projections, paper-trade simulation, and use-at-your-own-risk operation.
- Privacy notes explain local storage, IndexedDB paper trades, public quote/proxy requests, and absence of accounts or project-controlled backend storage.
- License notes point to the standard MIT License and clarify that product disclosures do not modify the license terms.

## Data Notes

- Quotes and OHLC history come from Yahoo Finance's public chart endpoint through `corsproxy.io`.
- The app fetches five years of daily candles so longer projection horizons have enough history.
- Visible quant stats remain focused on the latest one-year window.
- The projection panel is exploratory and local. It is not financial advice, a recommendation engine, or a real prediction engine.
