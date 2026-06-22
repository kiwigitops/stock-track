import { useEffect, useMemo, useState } from "react";
import { BarChart3, Gauge, LineChart, Star, X } from "lucide-react";
import { candleToRatePoints, getStats } from "../lib/analytics";
import { formatCompact, formatMoney, formatPercent, formatPrice, formatRate, venueName } from "../lib/format";
import type { ChartMode, StockQuote } from "../types";
import { InfoTip } from "./InfoTip";
import { BrokerWorkspace } from "./charts/BrokerWorkspace";

type QuoteModalProps = {
  cash: number;
  isFavorite: boolean;
  onClose: () => void;
  onFavorite: () => void;
  quote: StockQuote;
};

const chartModes: ChartMode[] = ["candles", "line", "returns", "technicals", "risk", "depth"];

export function QuoteModal({ cash, isFavorite, onClose, onFavorite, quote }: QuoteModalProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("candles");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ratePoints = useMemo(() => candleToRatePoints(quote.candles), [quote.candles]);
  const stats = useMemo(() => getStats(ratePoints, quote.price), [quote.price, ratePoints]);
  const shares = quote.price ? cash / quote.price : 0;

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
              detail="Percent change from the first loaded candle close to the latest loaded close."
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

        <section className="dataset-board" aria-label="Dataset information">
          <DatasetCard detail="Delayed quote and OHLC metadata from Yahoo Finance's public chart endpoint." label="Quote" value={quote.provider} />
          <DatasetCard detail="The static browser app fetches through a public CORS wrapper because the upstream chart endpoint does not allow direct browser origins." label="Proxy" value="corsproxy.io" />
          <DatasetCard detail="Stats, volatility, drawdown, percentile, z-score, technicals, and risk views are calculated locally from loaded candles." label="Derived" value="Local" />
          <DatasetCard detail="Candles use actual daily OHLC values from the chart feed when available." label="Candles" value="Daily OHLC" />
          <DatasetCard detail="Depth view is a broker-style liquidity model from price, volatility, and momentum. It is not a live order book." label="Depth" value="Modelled" />
        </section>

        <section className="deep-chart">
          <div className="chart-title">
            {chartMode === "depth" ? <Gauge size={18} /> : <LineChart size={18} />}
            <div>
              <strong>{chartMode === "depth" ? "Market depth" : "1Y chart"}</strong>
              <span>
                {quote.symbol}/{quote.currency}
              </span>
            </div>
          </div>
          <div className="chart-tabs" aria-label="Broker chart views">
            {chartModes.map((mode) => (
              <button className={chartMode === mode ? "active" : ""} key={mode} onClick={() => setChartMode(mode)} type="button">
                {mode === "candles"
                  ? "Candles"
                  : mode === "line"
                    ? "Line"
                    : mode === "returns"
                      ? "Returns"
                      : mode === "technicals"
                        ? "Technicals"
                        : mode === "risk"
                          ? "Risk"
                          : "Depth"}
              </button>
            ))}
          </div>
          {quote.candles.length ? (
            <BrokerWorkspace currentRate={quote.price} mode={chartMode} candles={quote.candles} />
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
