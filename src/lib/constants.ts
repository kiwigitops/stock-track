export const DEFAULT_CASH = 1000;
export const DEFAULT_CURRENCY = "USD";

export const WATCHLIST = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "AVGO",
  "JPM",
  "V",
  "WMT",
  "MA",
  "UNH",
  "XOM",
  "COST",
  "NFLX",
  "AMD",
  "CRM",
  "BAC",
  "KO",
  "DIS",
  "PLTR",
  "SPY",
  "QQQ",
];

export const CASH_KEY = "stocktrack:cash";
export const FAVORITES_KEY = "stocktrack:favorites";
export const SYMBOLS_KEY = "stocktrack:symbols";
export const ML_SETTINGS_KEY = "stocktrack:ml-settings";

export const DEFAULT_ML_SETTINGS = {
  horizon: 21,
  includeVolume: true,
  modelStyle: "balanced",
  trainingWindow: 756,
} as const;
