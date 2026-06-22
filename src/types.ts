export type RatePoint = {
  date: string;
  rate: number;
};

export type StockCandle = {
  close: number;
  date: string;
  high: number;
  low: number;
  open: number;
  volume: number;
};

export type StockQuote = {
  candles: StockCandle[];
  change: number;
  changePercent: number;
  currency: string;
  dayHigh: number;
  dayLow: number;
  exchange: string;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  name: string;
  previousClose: number;
  price: number;
  provider: string;
  symbol: string;
  updatedAt: number;
  volume: number;
};

export type ChartMode = "candles" | "line" | "returns" | "technicals" | "risk" | "depth" | "ml";

export type StockTile = StockQuote;
