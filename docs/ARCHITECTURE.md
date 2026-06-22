# App Structure

## Top-Level Flow

- `src/App.tsx` owns global UI state: cash amount, favorites, custom symbols, market/paper/about workspace tab, selected stock modal, search, and feed status.
- `src/hooks/useStocks.ts` refreshes delayed quote data, caches quotes in local storage, and keeps the UI usable when refreshes fail.
- `src/services/stocks.ts` is the quote adapter. It converts Yahoo Finance chart responses into `StockQuote` and `StockCandle` objects.
- `src/MarketScene.tsx` owns the Three.js background and stays independent from stock domain logic.
- `src/components/AboutPanel.tsx` owns the in-app privacy, risk, projection, and license disclosures.

## Modal And Charts

- `src/components/QuoteModal.tsx` presents stock details, one-year quant metrics, configurable projection settings, forward forecasts, dataset explanations, chart range controls, and the broker chart workspace.
- `src/components/charts/BrokerWorkspace.tsx` switches between chart modes and keeps chart rendering, legends, range-filtered views, hover inspection, and graph explanations isolated from modal layout.
- `src/lib/analytics.ts` contains shared deterministic quant calculations: returns, RSI, MACD, moving averages, drawdowns, statistics, and volatility.

## Projection Module

- `src/lib/ml.ts` is the internal machine-learning seam behind the Projections UI.
- Its main interface is `getMlSignals(candles, settings)`.
- Callers pass candles and user settings; the module hides feature extraction, horizon labelling, logistic training, validation, similar-setup lookup, trend scoring, and forecast generation.
- `MlSettings` lives in `src/types.ts` and is persisted by `QuoteModal` through `usePersistentState`.
- Model settings:
  - `horizon`: forecast label horizon.
  - `trainingWindow`: recent candles used for training.
  - `modelStyle`: balanced, momentum, or mean reversion.
  - `includeVolume`: toggles the volume z-score feature.

## Paper Trading

- `src/components/PaperTradeDesk.tsx` is the broker-style UI for the Paper workspace.
- `App` passes `onOpenQuote` into `PaperTradeDesk` so the paper order console, positions, and ledger can reuse the existing expanded stock modal instead of owning a separate detail window.
- `src/hooks/usePaperTrades.ts` loads, appends, and clears saved trades.
- `src/lib/paperTrading.ts` is the local paper-trading module:
  - Creates normalized trade events.
  - Persists trade events in IndexedDB with a localStorage fallback.
  - Recalculates positions, cash, equity, realized P/L, unrealized P/L, and total P/L from the saved ledger.

## Persistence

- Local storage is used for preferences, watchlist additions, favorites, cash amount, quote cache, and projection settings.
- IndexedDB is used for paper-trade ledger events.
- No backend server is required.

## License And Disclosures

- `LICENSE` contains the standard MIT License text.
- The app and README keep finance, projection, privacy, and use-at-your-own-risk language as disclosures outside the license text.

## Verification

- `pnpm build` runs TypeScript and production build checks.
- Browser QA should cover:
  - Market cards load.
  - About tab renders privacy, risk, and license content.
  - Modal opens.
  - All chart tabs render.
  - Range filters update every chart/data view.
  - Projection settings update the projection panel/tab.
  - Hover tooltips work on line, candles, returns, technicals, risk, and projection charts.
  - Paper trade ticket records a local trade.
  - Paper workspace stock actions open the expanded stock modal.
  - No horizontal overflow on desktop or mobile.
