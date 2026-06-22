import { useEffect, useMemo, useState } from "react";
import { BarChart3, Gauge, LineChart, Star, X } from "lucide-react";
import { candleToRatePoints, getStats } from "../lib/analytics";
import { DEFAULT_ML_SETTINGS, ML_SETTINGS_KEY } from "../lib/constants";
import { formatCompact, formatMoney, formatPercent, formatPrice, formatRate, venueName } from "../lib/format";
import { getHorizonLabel, getMlSignals } from "../lib/ml";
import { usePersistentState } from "../hooks/usePersistentState";
import type { ChartMode, ChartRangeKey, MlHorizon, MlModelStyle, MlSettings, MlTrainingWindow, StockQuote } from "../types";
import { InfoTip } from "./InfoTip";
import { BrokerWorkspace } from "./charts/BrokerWorkspace";

type QuoteModalProps = {
  cash: number;
  isFavorite: boolean;
  onClose: () => void;
  onFavorite: () => void;
  quote: StockQuote;
};

const chartModes: ChartMode[] = ["candles", "line", "returns", "technicals", "risk", "depth", "projections"];
const chartRanges: ChartRangeKey[] = ["1m", "3m", "6m", "1y", "5y"];

export function QuoteModal({ cash, isFavorite, onClose, onFavorite, quote }: QuoteModalProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("candles");
  const [chartRange, setChartRange] = useState<ChartRangeKey>("1y");
  const [mlSettings, setMlSettings] = usePersistentState<MlSettings>(ML_SETTINGS_KEY, DEFAULT_ML_SETTINGS);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ratePoints = useMemo(() => candleToRatePoints(quote.candles), [quote.candles]);
  const visibleRatePoints = useMemo(() => ratePoints.slice(-252), [ratePoints]);
  const stats = useMemo(() => getStats(visibleRatePoints, quote.price), [quote.price, visibleRatePoints]);
  const ml = useMemo(() => getMlSignals(quote.candles, mlSettings), [mlSettings, quote.candles]);
  const shares = quote.price ? cash / quote.price : 0;

  function updateMlSettings(next: Partial<MlSettings>) {
    setMlSettings((current) => ({ ...current, ...next }));
  }

  return (
    <div className="modal-layer" onClick={onClose}>
      <section className="quote-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            <span className="tiny-label">{venueName(quote.exchange)}</span>
            <h2>
              {quote.symbol} <span>{quote.name}</span>
            </h2>
          </div>
          <div className="modal-actions">
            <button className="glass-icon" onClick={onFavorite} title={isFavorite ? "Unfavorite" : "Favorite"}>
              <Star size={18} fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <button className="glass-icon" onClick={onClose} title="Close">
              <X size={19} />
            </button>
          </div>
        </header>

        <section className="modal-price">
          <div>
            <span>
              {formatMoney(cash, quote.currency)} allocation buys {formatCompact(shares, shares >= 10 ? 2 : 4)} shares
            </span>
            <strong>{formatPrice(quote.price, quote.currency)}</strong>
          </div>
          <em className={quote.change < 0 ? "down" : "up"}>{formatPercent(quote.changePercent, true)}</em>
        </section>

        <section className="stats-board">
          <ModalStat detail="Latest delayed market price from the chart feed." label="Price" value={formatPrice(quote.price, quote.currency)} />
          <ModalStat detail="Previous regular-session close used for daily change." label="Prev close" value={formatPrice(quote.previousClose, quote.currency)} />
          <ModalStat detail="Highest regular-session price reported today." label="Day high" value={formatPrice(quote.dayHigh, quote.currency)} />
          <ModalStat detail="Lowest regular-session price reported today." label="Day low" value={formatPrice(quote.dayLow, quote.currency)} />
          <ModalStat detail="Reported regular-session trading volume." label="Volume" value={formatCompact(quote.volume, 1)} />
          <ModalStat
            detail="Reported 52-week trading range from the chart metadata."
            label="52W range"
            value={`${formatRate(quote.fiftyTwoWeekLow)} - ${formatRate(quote.fiftyTwoWeekHigh)}`}
          />
        </section>

        <section className="quant-panel" aria-label="Quant metrics">
          <div className="panel-heading">
            <span>Quant metrics</span>
            <InfoTip text="These are browser-side calculations from the loaded daily OHLC series, not investment advice or a paid real-time terminal." />
          </div>
          <div className="quant-grid">
            <ModalStat
              detail="Percent change from the first close in the visible one-year window to the latest close."
              label="1Y return"
              tone={stats.periodReturn >= 0 ? "positive" : "negative"}
              value={formatPercent(stats.periodReturn, true)}
            />
            <ModalStat
              detail="Annualized standard deviation of daily close-to-close returns, using 252 trading days."
              label="Ann. vol"
              value={formatPercent(stats.annualizedVolatility)}
            />
            <ModalStat
              detail="Worst peak-to-trough close decline inside the loaded candle window."
              label="Max DD"
              tone="negative"
              value={formatPercent(stats.maxDrawdown)}
            />
            <ModalStat
              detail="Where the latest close sits versus the loaded close range. 100% means it is at the top of the observed sample."
              label="Percentile"
              value={formatPercent(stats.percentile)}
            />
            <ModalStat
              detail="Distance from the average close, measured in standard deviations of the loaded close series."
              label="Z-score"
              tone={stats.zScore >= 0 ? "positive" : "negative"}
              value={`${formatCompact(stats.zScore, 2)}σ`}
            />
            <ModalStat detail="Number of daily candles loaded for this symbol." label="Samples" value={formatCompact(stats.observations, 0)} />
          </div>
        </section>

        <section className="quant-panel ml-panel" aria-label="Projection signals">
          <div className="panel-heading">
            <span>Projection settings</span>
            <InfoTip text="These projections come from a small local model trained only on this symbol's loaded daily candles. Treat it as an explainable pattern read, not financial advice." />
          </div>
          <div className="ml-settings">
            <label>
              <span>
                Horizon
                <InfoTip text="How far forward each historical setup is judged. 1D means next session; 1Y means roughly 252 trading sessions forward." />
              </span>
              <select value={mlSettings.horizon} onChange={(event) => updateMlSettings({ horizon: Number(event.target.value) as MlHorizon })}>
                <option value={1}>1D</option>
                <option value={5}>1W</option>
                <option value={21}>1M</option>
                <option value={63}>3M</option>
                <option value={126}>6M</option>
                <option value={252}>1Y</option>
              </select>
            </label>
            <label>
              <span>
                Training
                <InfoTip text="How many recent daily candles the model is allowed to learn from. Larger windows are steadier; smaller windows adapt faster." />
              </span>
              <select
                value={mlSettings.trainingWindow}
                onChange={(event) => updateMlSettings({ trainingWindow: Number(event.target.value) as MlTrainingWindow })}
              >
                <option value={252}>1Y</option>
                <option value={504}>2Y</option>
                <option value={756}>3Y</option>
                <option value={1260}>5Y</option>
              </select>
            </label>
            <label>
              <span>
                Bias
                <InfoTip text="Changes how the local model treats signals before training. Balanced is neutral; Momentum leans toward trend-following; Reversion leans toward stretched-price snapback." />
              </span>
              <select value={mlSettings.modelStyle} onChange={(event) => updateMlSettings({ modelStyle: event.target.value as MlModelStyle })}>
                <option value="balanced">Balanced</option>
                <option value="momentum">Momentum</option>
                <option value="meanReversion">Reversion</option>
              </select>
            </label>
            <label className="toggle-row">
              <span>
                Volume
                <InfoTip text="Includes or removes the volume z-score feature. Turn it off when you want price-only pattern analysis." />
              </span>
              <input
                checked={mlSettings.includeVolume}
                onChange={(event) => updateMlSettings({ includeVolume: event.target.checked })}
                type="checkbox"
              />
            </label>
          </div>
          <div className="quant-grid">
            <ModalStat
              detail="Estimated probability that the selected forecast horizon closes higher than the latest close, using the current projection settings."
              label={`${getHorizonLabel(ml.horizon)} up`}
              tone={ml.probabilityUp >= 0.5 ? "positive" : "negative"}
              value={formatPercent(ml.probabilityUp)}
            />
            <ModalStat
              detail="Average forward return from the closest historical setups under the selected projection horizon."
              label="Expected"
              tone={ml.expectedMove >= 0 ? "positive" : "negative"}
              value={formatPercent(ml.expectedMove, true)}
            />
            <ModalStat
              detail="Confidence blends distance from 50% probability with validation hit rate. Higher means the model is less ambivalent, not necessarily correct."
              label="Confidence"
              value={formatPercent(ml.confidence)}
            />
            <ModalStat
              detail="Chronological holdout hit rate from the final quarter of labelled samples."
              label="Holdout hit"
              value={ml.testAccuracy ? formatPercent(ml.testAccuracy) : "n/a"}
            />
            <ModalStat detail="Current projection regime inferred from probability, volatility, and similar-setup expected move." label="Regime" value={ml.regime} />
            <ModalStat detail="Trend score from moving-average stack, 20D/50D momentum, RSI, and drawdown from the trailing one-year high." label="Trend" value={ml.trend.label} />
          </div>
          <div className="forecast-grid" aria-label="Forward forecast curve">
            {ml.forecasts.map((forecast) => (
              <div className={forecast.expectedMove >= 0 ? "forecast-card positive" : "forecast-card negative"} key={forecast.horizon}>
                <span>
                  {getHorizonLabel(forecast.horizon)}
                  <InfoTip text="Each card retrains the same local projection model for this horizon and averages the forward return from the closest historical setups." />
                </span>
                <strong>{formatPercent(forecast.expectedMove, true)}</strong>
                <em>{formatPercent(forecast.probabilityUp)} up</em>
              </div>
            ))}
          </div>
        </section>

        <section className="dataset-board" aria-label="Dataset information">
          <DatasetCard detail="Delayed quote and OHLC metadata from Yahoo Finance's public chart endpoint." label="Quote" value={quote.provider} />
          <DatasetCard detail="The static browser app fetches through a public CORS wrapper because the upstream chart endpoint does not allow direct browser origins." label="Proxy" value="corsproxy.io" />
          <DatasetCard detail="Stats, volatility, drawdown, percentile, z-score, technicals, and risk views are calculated locally from loaded candles." label="Derived" value="Local" />
          <DatasetCard detail="Candles use actual daily OHLC values from the chart feed when available." label="Candles" value="Daily OHLC" />
          <DatasetCard detail="Depth view is a broker-style liquidity model from price, volatility, and momentum. It is not a live order book." label="Depth" value="Modelled" />
          <DatasetCard detail="Projection signals are trained locally from this ticker's loaded candles using logistic classification and similar-pattern averaging." label="Projections" value={ml.status === "ready" ? "Local model" : "Needs data"} />
        </section>

        <section className="deep-chart">
          <div className="chart-title">
            {chartMode === "depth" ? <Gauge size={18} /> : <LineChart size={18} />}
            <div>
              <strong>{getChartModeLabel(chartMode)}</strong>
              <span>{getChartModeDescription(chartMode, quote.symbol, quote.currency)}</span>
            </div>
          </div>
          <div className="chart-tabs" aria-label="Broker chart views">
            {chartModes.map((mode) => (
              <button className={chartMode === mode ? "active" : ""} key={mode} onClick={() => setChartMode(mode)} type="button">
                {getChartModeLabel(mode)}
              </button>
            ))}
          </div>
          <div className="chart-toolbar">
            <span>
              Visible range
              <InfoTip text="This filter changes the visible history in every chart and data view. Projection training still follows the training-window setting above; this controls the chart view." />
            </span>
            <div className="range-tabs" aria-label="Visible chart range">
              {chartRanges.map((range) => (
                <button className={chartRange === range ? "active" : ""} key={range} onClick={() => setChartRange(range)} type="button">
                  {getChartRangeLabel(range)}
                </button>
              ))}
            </div>
          </div>
          {quote.candles.length ? (
            <BrokerWorkspace currentRate={quote.price} mode={chartMode} range={chartRange} candles={quote.candles} mlSettings={mlSettings} />
          ) : (
            <div className="chart-fallback">
              <BarChart3 size={28} />
              <span>No chart data yet</span>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function getChartModeLabel(mode: ChartMode) {
  if (mode === "candles") return "Candles";
  if (mode === "line") return "Line";
  if (mode === "returns") return "Returns";
  if (mode === "technicals") return "Technicals";
  if (mode === "risk") return "Risk";
  if (mode === "depth") return "Depth";
  return "Projections";
}

function getChartModeDescription(mode: ChartMode, symbol: string, currency: string) {
  if (mode === "candles") return `${symbol}/${currency} open, high, low, and close for the selected range.`;
  if (mode === "line") return `${symbol}/${currency} closing price path for the selected range.`;
  if (mode === "returns") return "Daily percentage changes for individual sessions.";
  if (mode === "technicals") return "Price with moving averages plus trend indicators for the selected range.";
  if (mode === "risk") return "Drawdown, volatility, and downside-risk measures from the selected range.";
  if (mode === "depth") return "A modeled broker-style book derived from price, volatility, and momentum.";
  return "Forward projection probabilities, expected moves, drivers, and trend stack.";
}

function getChartRangeLabel(range: ChartRangeKey) {
  if (range === "1m") return "1M";
  if (range === "3m") return "3M";
  if (range === "6m") return "6M";
  if (range === "1y") return "1Y";
  return "5Y";
}

function ModalStat({
  detail,
  label,
  tone = "",
  value,
}: {
  detail: string;
  label: string;
  tone?: "positive" | "negative" | "";
  value: string;
}) {
  return (
    <div className={tone ? `metric-card ${tone}` : "metric-card"}>
      <span>
        {label}
        <InfoTip text={detail} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function DatasetCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div>
      <span>
        {label}
        <InfoTip text={detail} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}
