# App Structure

## Top-Level Flow

- `src/App.tsx` owns global UI state: cash amount, favorites, custom symbols, market/paper workspace tab, selected stock modal, search, and feed status.
- `src/hooks/useStocks.ts` refreshes delayed quote data, caches quotes in local storage, and keeps the UI usable when refreshes fail.
- `src/services/stocks.ts` is the quote adapter. It converts Yahoo Finance chart responses into `StockQuote` and `StockCandle` objects.
- `src/MarketScene.tsx` owns the Three.js background and stays independent from stock domain logic.

## Modal And Charts

- `src/components/QuoteModal.tsx` presents stock details, one-year quant metrics, configurable ML settings, forward forecasts, dataset explanations, and the broker chart workspace.
- `src/components/charts/BrokerWorkspace.tsx` switches between chart modes and keeps chart rendering isolated from modal layout.
- `src/lib/analytics.ts` contains shared deterministic quant calculations: returns, RSI, MACD, moving averages, drawdowns, statistics, and volatility.

## ML Module

- `src/lib/ml.ts` is the ML seam.
- Its main interface is `getMlSignals(candles, settings)`.
- Callers pass candles and user settings; the module hides feature extraction, horizon labelling, logistic training, validation, similar-setup lookup, trend scoring, and forecast generation.
- `MlSettings` lives in `src/types.ts` and is persisted by `QuoteModal` through `usePersistentState`.
- Model settings:
  - `horizon`: forecast label horizon.
  - `trainingWindow`: recent candles used for training.
  - `modelStyle`: balanced, momentum, or mean reversion.
  - `includeVolume`: toggles the volume z-score feature.

## Paper Trading

- `src/components/PaperTradeDesk.tsx` is the UI for the Paper workspace.
- `src/hooks/usePaperTrades.ts` loads, appends, and clears saved trades.
- `src/lib/paperTrading.ts` is the local paper-trading module:
  - Creates normalized trade events.
  - Persists trade events in IndexedDB with a localStorage fallback.
  - Recalculates positions, cash, equity, realized P/L, unrealized P/L, and total P/L from the saved ledger.

## Persistence

- Local storage is used for preferences, watchlist additions, favorites, cash amount, quote cache, and ML settings.
- IndexedDB is used for paper-trade ledger events.
- No backend server is required.

## Verification

- `pnpm build` runs TypeScript and production build checks.
- Browser QA should cover:
  - Market cards load.
  - Modal opens.
  - All chart tabs render.
  - ML settings update the ML panel/tab.
  - Paper trade ticket records a local trade.
  - No horizontal overflow on desktop or mobile.
