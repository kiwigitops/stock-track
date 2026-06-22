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

export type ChartMode = "candles" | "line" | "returns" | "technicals" | "risk" | "depth" | "projections";

export type ChartRangeKey = "1m" | "3m" | "6m" | "1y" | "5y";

export type StockTile = StockQuote;

export type MlHorizon = 1 | 5 | 21 | 63 | 126 | 252;

export type MlModelStyle = "balanced" | "momentum" | "meanReversion";

export type MlTrainingWindow = 252 | 504 | 756 | 1260;

export type MlSettings = {
  horizon: MlHorizon;
  includeVolume: boolean;
  modelStyle: MlModelStyle;
  trainingWindow: MlTrainingWindow;
};
