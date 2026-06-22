# Feature Map

## Market Workspace

- Delayed stock quote cards for the default watchlist and user-added symbols.
- Favorites pin symbols near the front of the market view.
- Search filters symbols by ticker or company name.
- Cash amount is shared by watch cards and paper trading.
- Full-screen Three.js market scene responds to market direction.

## Expanded Stock Modal

- Price, previous close, day high/low, volume, and 52-week range.
- One-year quant metrics: return, annualized volatility, max drawdown, percentile, z-score, and sample count.
- Dataset cards explain quote source, CORS proxy, local calculations, candle source, modelled depth, and local ML.
- Broker chart tabs:
  - Candles
  - Line
  - Returns
  - Technicals
  - Risk
  - Depth
  - ML

## ML Signals

- Configurable horizon: 1D, 1W, 1M, 3M, 6M, or 1Y.
- Configurable training window: 1Y, 2Y, 3Y, or 5Y.
- Configurable model style: balanced, momentum, or mean reversion.
- Optional volume feature toggle.
- Outputs up probability, expected move, confidence, holdout hit rate, regime, and trend.
- Forward forecast cards show expected move and up probability from 1D through 1Y.
- ML tab shows probability history, feature contribution bars, forecast strip, and trend components.
- Hover/focus info markers explain model options and calculations.

## Paper Trading

- Market/Paper workspace tabs at the top level.
- Paper trades are saved locally in IndexedDB.
- Trade ticket records buy/sell, symbol, quantity, price, and optional note.
- Portfolio view recalculates cash, market value, equity, unrealized P/L, realized P/L, and total P/L from saved trades.
- Positions are marked to current delayed quote prices.
- Ledger shows recent paper trades and can be reset locally.

## Data Notes

- Quotes and OHLC history come from Yahoo Finance's public chart endpoint through `corsproxy.io`.
- The app fetches five years of daily candles so longer ML horizons have enough history.
- Visible quant stats remain focused on the latest one-year window.
- The ML panel is exploratory and local. It is not financial advice or a real prediction engine.
