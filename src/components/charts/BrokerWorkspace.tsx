import { type PointerEvent, type TouchEvent, useState } from "react";
import { BarChart3, Gauge, LineChart } from "lucide-react";
import {
  candleToRatePoints,
  getDrawdownSeries,
  getMacd,
  getReturns,
  getRsi,
  mean,
  movingAverage,
  rollingAverage,
  standardDeviation,
} from "../../lib/analytics";
import { formatCompact, formatPercent, formatPrice, formatRate } from "../../lib/format";
import { getMlSignals } from "../../lib/ml";
import type { ChartMode, RatePoint, StockCandle } from "../../types";

type ChartTooltipPosition = {
  horizontal: "left" | "right";
  left: number;
  placement: "above" | "below";
  top: number;
};

function getTooltipPosition(clientX: number, clientY: number): ChartTooltipPosition {
  const horizontal = clientX > window.innerWidth - 170 ? "left" : "right";
  const placement = clientY < 140 ? "below" : "above";

  return {
    horizontal,
    left: Math.min(Math.max(clientX, 14), window.innerWidth - 14),
    placement,
    top: Math.min(Math.max(clientY, 14), window.innerHeight - 14),
  };
}

function getTooltipClassName(position: ChartTooltipPosition) {
  return ["chart-tooltip", "floating", position.horizontal === "left" ? "left" : "", position.placement === "below" ? "below" : ""]
    .filter(Boolean)
    .join(" ");
}

type BrokerWorkspaceProps = {
  candles: StockCandle[];
  currentRate: number;
  mode: ChartMode;
};

export function BrokerWorkspace({ candles, currentRate, mode }: BrokerWorkspaceProps) {
  const points = candleToRatePoints(candles);

  if (mode === "candles") return <CandleChart candles={candles} />;
  if (mode === "returns") return <ReturnsView points={points} />;
  if (mode === "depth") return <DepthView currentRate={currentRate} points={points} />;
  if (mode === "technicals") return <TechnicalsView points={points} />;
  if (mode === "risk") return <RiskView points={points} />;
  if (mode === "ml") return <MlView candles={candles} />;
  return <BigChart points={points} />;
}

function BigChart({ points }: { points: RatePoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipPosition | null>(null);

  if (points.length < 2) return <ChartFallback label="No chart data yet" />;

  const width = 900;
  const height = 310;
  const pad = 22;
  const values = points.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coordinates = points.map((point, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (point.rate - min) / range) * (height - pad * 2);
    return { ...point, x, y };
  });
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = [
    `M ${coordinates[0].x} ${height - pad}`,
    ...coordinates.map((point) => `L ${point.x} ${point.y}`),
    `L ${coordinates[coordinates.length - 1].x} ${height - pad}`,
    "Z",
  ].join(" ");
  const rising = values[values.length - 1] >= values[0];
  const activePoint = hoveredIndex === null ? null : coordinates[hoveredIndex];

  function selectPoint(clientX: number, clientY: number, bounds: DOMRect) {
    const x = ((clientX - bounds.left) / bounds.width) * width;
    const index = Math.round(((x - pad) / (width - pad * 2)) * (coordinates.length - 1));
    setHoveredIndex(Math.max(0, Math.min(coordinates.length - 1, index)));
    setTooltip(getTooltipPosition(clientX, clientY));
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    selectPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }

  function handleTouch(event: TouchEvent<SVGSVGElement>) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) return;
    selectPoint(touch.clientX, touch.clientY, event.currentTarget.getBoundingClientRect());
  }

  return (
    <div className="interactive-chart">
      <svg
        aria-label="Interactive stock chart"
        className={rising ? "big-chart up" : "big-chart down"}
        onPointerDown={handlePointerMove}
        onPointerLeave={() => {
          setHoveredIndex(null);
          setTooltip(null);
        }}
        onPointerMove={handlePointerMove}
        onTouchMove={handleTouch}
        onTouchStart={handleTouch}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="area" d={area} />
        <polyline points={line} />
        {activePoint ? (
          <>
            <line className="chart-focus-line" x1={activePoint.x} x2={activePoint.x} y1={pad} y2={height - pad} />
            <circle className="chart-marker" cx={activePoint.x} cy={activePoint.y} r="8" />
          </>
        ) : null}
      </svg>
      {activePoint && tooltip ? (
        <div className={getTooltipClassName(tooltip)} style={{ left: tooltip.left, top: tooltip.top }}>
          <span>{activePoint.date}</span>
          <strong>{formatPrice(activePoint.rate)}</strong>
        </div>
      ) : null}
      <ChartRange end={points[points.length - 1].date} max={max} min={min} start={points[0].date} />
    </div>
  );
}

function CandleChart({ candles }: { candles: StockCandle[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipPosition | null>(null);

  if (candles.length < 2) return <ChartFallback label="No candle data yet" />;

  const visibleCandles = candles.slice(-120);
  const width = 900;
  const height = 310;
  const pad = 24;
  const lows = visibleCandles.map((point) => point.low);
  const highs = visibleCandles.map((point) => point.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const innerWidth = width - pad * 2;
  const candleGap = innerWidth / visibleCandles.length;
  const bodyWidth = Math.max(3, Math.min(8, candleGap * 0.54));
  const coordinates = visibleCandles.map((point, index) => {
    const x = pad + candleGap * index + candleGap / 2;
    const y = (value: number) => pad + (1 - (value - min) / range) * (height - pad * 2);
    return {
      ...point,
      bodyBottom: y(Math.min(point.open, point.close)),
      bodyTop: y(Math.max(point.open, point.close)),
      closeY: y(point.close),
      highY: y(point.high),
      lowY: y(point.low),
      openY: y(point.open),
      x,
    };
  });
  const activePoint = hoveredIndex === null ? null : coordinates[hoveredIndex];

  function selectPoint(clientX: number, clientY: number, bounds: DOMRect) {
    const x = ((clientX - bounds.left) / bounds.width) * width;
    const index = Math.round((x - pad - candleGap / 2) / candleGap);
    setHoveredIndex(Math.max(0, Math.min(coordinates.length - 1, index)));
    setTooltip(getTooltipPosition(clientX, clientY));
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    selectPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }

  function handleTouch(event: TouchEvent<SVGSVGElement>) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) return;
    selectPoint(touch.clientX, touch.clientY, event.currentTarget.getBoundingClientRect());
  }

  return (
    <div className="interactive-chart candle-shell">
      <svg
        aria-label="Candlestick chart"
        className="candle-chart"
        onPointerDown={handlePointerMove}
        onPointerLeave={() => {
          setHoveredIndex(null);
          setTooltip(null);
        }}
        onPointerMove={handlePointerMove}
        onTouchMove={handleTouch}
        onTouchStart={handleTouch}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line className="chart-grid" x1={pad} x2={width - pad} y1={pad} y2={pad} />
        <line className="chart-grid" x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} />
        <line className="chart-grid" x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} />
        {coordinates.map((point) => {
          const rising = point.close >= point.open;
          const bodyHeight = Math.max(2, point.bodyBottom - point.bodyTop);
          return (
            <g className={rising ? "candle up" : "candle down"} key={point.date}>
              <line x1={point.x} x2={point.x} y1={point.highY} y2={point.lowY} />
              <rect height={bodyHeight} rx="2" width={bodyWidth} x={point.x - bodyWidth / 2} y={point.bodyTop} />
            </g>
          );
        })}
        {activePoint ? (
          <>
            <line className="chart-focus-line" x1={activePoint.x} x2={activePoint.x} y1={pad} y2={height - pad} />
            <circle className="chart-marker" cx={activePoint.x} cy={activePoint.closeY} r="7" />
          </>
        ) : null}
      </svg>
      {activePoint && tooltip ? (
        <div className={`${getTooltipClassName(tooltip)} candle-tip`} style={{ left: tooltip.left, top: tooltip.top }}>
          <span>{activePoint.date}</span>
          <strong>{formatPrice(activePoint.close)}</strong>
          <em>O {formatRate(activePoint.open)}</em>
          <em>H {formatRate(activePoint.high)}</em>
          <em>L {formatRate(activePoint.low)}</em>
        </div>
      ) : null}
      <ChartRange end={visibleCandles[visibleCandles.length - 1].date} max={max} min={min} start={visibleCandles[0].date} />
    </div>
  );
}

function ReturnsView({ points }: { points: RatePoint[] }) {
  const returns = getReturns(points).slice(-120);
  if (!returns.length) return <ChartFallback label="No return data yet" />;

  const width = 900;
  const height = 250;
  const pad = 22;
  const maxAbs = Math.max(...returns.map((point) => Math.abs(point.returnValue))) || 1;
  const barGap = (width - pad * 2) / returns.length;
  const zeroY = height / 2;

  return (
    <div className="returns-view">
      <svg aria-label="Daily return bars" className="returns-chart" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        <line className="chart-grid zero" x1={pad} x2={width - pad} y1={zeroY} y2={zeroY} />
        {returns.map((point, index) => {
          const x = pad + index * barGap;
          const barHeight = Math.max(2, (Math.abs(point.returnValue) / maxAbs) * (height / 2 - pad));
          const y = point.returnValue >= 0 ? zeroY - barHeight : zeroY;
          return (
            <rect
              className={point.returnValue >= 0 ? "return-bar up" : "return-bar down"}
              height={barHeight}
              key={point.date}
              rx="2"
              width={Math.max(2, barGap * 0.7)}
              x={x}
              y={y}
            />
          );
        })}
      </svg>
      <div className="broker-panels">
        <BrokerDatum label="Best day" value={formatPercent(Math.max(...returns.map((point) => point.returnValue)), true)} />
        <BrokerDatum label="Worst day" value={formatPercent(Math.min(...returns.map((point) => point.returnValue)), true)} />
        <BrokerDatum label="Mean day" value={formatPercent(mean(returns.map((point) => point.returnValue)), true)} />
      </div>
    </div>
  );
}

function DepthView({ currentRate, points }: { currentRate: number; points: RatePoint[] }) {
  const returns = getReturns(points);
  const volatility = standardDeviation(returns.map((point) => point.returnValue));
  const step = Math.max(currentRate * 0.0008, currentRate * volatility * 0.22);
  const levels = Array.from({ length: 8 }, (_, index) => {
    const weight = 1 - index / 10;
    const bidSize = Math.max(4, (weight + Math.sin(index * 0.9) * 0.08) * 100);
    const askSize = Math.max(4, (weight + Math.cos(index * 0.7) * 0.08) * 100);
    return {
      ask: currentRate + step * (index + 1),
      askSize,
      bid: currentRate - step * (index + 1),
      bidSize,
    };
  });
  const maxSize = Math.max(...levels.flatMap((level) => [level.bidSize, level.askSize]));
  const bidTotal = levels.reduce((sum, level) => sum + level.bidSize, 0);
  const askTotal = levels.reduce((sum, level) => sum + level.askSize, 0);
  const spread = step * 2;
  const imbalance = (bidTotal - askTotal) / (bidTotal + askTotal || 1);

  return (
    <div className="depth-view">
      <div className="depth-book">
        <div className="depth-head">
          <span>Bid model</span>
          <strong>{formatPrice(currentRate)}</strong>
          <span>Ask model</span>
        </div>
        {levels.map((level) => (
          <div className="depth-row" key={`${level.bid}-${level.ask}`}>
            <div>
              <span style={{ width: `${(level.bidSize / maxSize) * 100}%` }} />
              <strong>{formatRate(level.bid)}</strong>
            </div>
            <em>{formatCompact(level.bidSize, 0)}</em>
            <em>{formatCompact(level.askSize, 0)}</em>
            <div>
              <span style={{ width: `${(level.askSize / maxSize) * 100}%` }} />
              <strong>{formatRate(level.ask)}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="broker-panels">
        <BrokerDatum label="Model spread" value={formatRate(spread)} />
        <BrokerDatum label="Book skew" tone={imbalance >= 0 ? "positive" : "negative"} value={formatPercent(imbalance, true)} />
        <BrokerDatum label="Vol input" value={formatPercent(volatility)} />
      </div>
    </div>
  );
}

function TechnicalsView({ points }: { points: RatePoint[] }) {
  if (points.length < 30) {
    return (
      <div className="chart-fallback">
        <LineChart size={28} />
        <span>More history is needed for technicals</span>
      </div>
    );
  }

  const values = points.map((point) => point.rate);
  const current = values[values.length - 1];
  const sma20 = movingAverage(values, 20);
  const sma50 = movingAverage(values, 50);
  const rsi14 = getRsi(values, 14);
  const macd = getMacd(values);
  const momentum20 = sma20 ? current / sma20 - 1 : 0;
  const trend = current >= sma20 && sma20 >= sma50 ? "Bullish" : current <= sma20 && sma20 <= sma50 ? "Bearish" : "Mixed";

  return (
    <div className="technicals-view">
      <TechnicalOverlay points={points} />
      <div className="broker-panels technical-grid">
        <BrokerDatum label="Trend" tone={trend === "Bullish" ? "positive" : trend === "Bearish" ? "negative" : ""} value={trend} />
        <BrokerDatum label="SMA 20" value={formatPrice(sma20)} />
        <BrokerDatum label="SMA 50" value={formatPrice(sma50)} />
        <BrokerDatum label="RSI 14" tone={rsi14 >= 70 ? "negative" : rsi14 <= 30 ? "positive" : ""} value={formatCompact(rsi14, 1)} />
        <BrokerDatum label="MACD" tone={macd.histogram >= 0 ? "positive" : "negative"} value={formatCompact(macd.histogram, 5)} />
        <BrokerDatum label="20D mom" tone={momentum20 >= 0 ? "positive" : "negative"} value={formatPercent(momentum20, true)} />
      </div>
    </div>
  );
}

function TechnicalOverlay({ points }: { points: RatePoint[] }) {
  const visible = points.slice(-120);
  const width = 900;
  const height = 270;
  const pad = 24;
  const values = visible.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const toPath = (series: number[]) =>
    series
      .map((value, index) => {
        const x = pad + (index / (series.length - 1)) * (width - pad * 2);
        const y = pad + (1 - (value - min) / range) * (height - pad * 2);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  const pricePath = toPath(values);
  const sma20Path = toPath(rollingAverage(visible.map((point) => point.rate), 20));
  const sma50Path = toPath(rollingAverage(visible.map((point) => point.rate), 50));

  return (
    <svg aria-label="Technical overlay chart" className="technical-chart" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
      <line className="chart-grid" x1={pad} x2={width - pad} y1={pad} y2={pad} />
      <line className="chart-grid" x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} />
      <line className="chart-grid" x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} />
      <path className="technical-line price" d={pricePath} />
      <path className="technical-line sma20" d={sma20Path} />
      <path className="technical-line sma50" d={sma50Path} />
    </svg>
  );
}

function RiskView({ points }: { points: RatePoint[] }) {
  const returns = getReturns(points);
  const values = points.map((point) => point.rate);

  if (returns.length < 5) {
    return (
      <div className="chart-fallback">
        <Gauge size={28} />
        <span>More history is needed for risk views</span>
      </div>
    );
  }

  const drawdowns = getDrawdownSeries(values).slice(-160);
  const rollingVol = standardDeviation(returns.slice(-20).map((point) => point.returnValue)) * Math.sqrt(252);
  const dailyMean = mean(returns.map((point) => point.returnValue));
  const dailyVol = standardDeviation(returns.map((point) => point.returnValue));
  const var95 = dailyMean - 1.65 * dailyVol;
  const upsideDays = returns.filter((point) => point.returnValue >= 0).length / returns.length;
  const rewardRisk = dailyVol ? (dailyMean / dailyVol) * Math.sqrt(252) : 0;

  return (
    <div className="risk-view">
      <DrawdownChart points={drawdowns} />
      <div className="broker-panels technical-grid">
        <BrokerDatum label="20D vol" value={formatPercent(rollingVol)} />
        <BrokerDatum label="Daily VaR 95" tone="negative" value={formatPercent(var95, true)} />
        <BrokerDatum label="Upside days" value={formatPercent(upsideDays)} />
        <BrokerDatum label="Reward/risk" tone={rewardRisk >= 0 ? "positive" : "negative"} value={formatCompact(rewardRisk, 2)} />
        <BrokerDatum label="Worst close" value={formatPrice(Math.min(...values))} />
        <BrokerDatum label="Best close" value={formatPrice(Math.max(...values))} />
      </div>
    </div>
  );
}

function MlView({ candles }: { candles: StockCandle[] }) {
  const ml = getMlSignals(candles);
  const history = ml.probabilityHistory;

  if (ml.status === "limited" || history.length < 2) {
    return (
      <div className="chart-fallback">
        <Gauge size={28} />
        <span>More candles are needed for ML signals</span>
      </div>
    );
  }

  const width = 900;
  const height = 260;
  const pad = 24;
  const line = history
    .map((point, index) => {
      const x = pad + (index / (history.length - 1)) * (width - pad * 2);
      const y = pad + (1 - point.probabilityUp) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const area = `${line} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;
  const maxContribution = Math.max(...ml.features.map((feature) => Math.abs(feature.contribution)), 0.001);

  return (
    <div className="ml-view">
      <svg aria-label="ML probability chart" className="ml-chart" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="mlFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#64d2ff" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#64d2ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line className="chart-grid" x1={pad} x2={width - pad} y1={pad} y2={pad} />
        <line className="chart-grid zero" x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} />
        <line className="chart-grid" x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} />
        <path className="ml-area" d={area} />
        <path className="ml-line" d={line} />
      </svg>
      <div className="broker-panels technical-grid">
        <BrokerDatum label="Up prob" tone={ml.probabilityUp >= 0.5 ? "positive" : "negative"} value={formatPercent(ml.probabilityUp)} />
        <BrokerDatum label="Expected" tone={ml.expectedMove >= 0 ? "positive" : "negative"} value={formatPercent(ml.expectedMove, true)} />
        <BrokerDatum label="Confidence" value={formatPercent(ml.confidence)} />
        <BrokerDatum label="Holdout hit" value={formatPercent(ml.testAccuracy)} />
        <BrokerDatum label="Samples" value={formatCompact(ml.sampleSize, 0)} />
        <BrokerDatum label="Regime" value={ml.regime} />
      </div>
      <div className="feature-stack" aria-label="ML feature contributions">
        {ml.features.slice(0, 6).map((feature) => (
          <div className={feature.direction === "bullish" ? "feature-row positive" : "feature-row negative"} key={feature.label}>
            <span>{feature.label}</span>
            <div>
              <em style={{ width: `${(Math.abs(feature.contribution) / maxContribution) * 100}%` }} />
            </div>
            <strong>{formatCompact(feature.contribution, 3)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DrawdownChart({ points }: { points: number[] }) {
  const width = 900;
  const height = 250;
  const pad = 22;
  const min = Math.min(...points, 0);
  const range = Math.abs(min) || 1;
  const path = points
    .map((value, index) => {
      const x = pad + (index / (points.length - 1)) * (width - pad * 2);
      const y = pad + (Math.abs(value) / range) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const area = `${path} L ${width - pad} ${pad} L ${pad} ${pad} Z`;

  return (
    <svg aria-label="Drawdown chart" className="drawdown-chart" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
      <line className="chart-grid zero" x1={pad} x2={width - pad} y1={pad} y2={pad} />
      <path className="drawdown-area" d={area} />
      <path className="drawdown-line" d={path} />
    </svg>
  );
}

function ChartRange({ end, max, min, start }: { end: string; max: number; min: number; start: string }) {
  return (
    <div className="chart-range">
      <span>{start}</span>
      <strong>
        {formatRate(min)} - {formatRate(max)}
      </strong>
      <span>{end}</span>
    </div>
  );
}

function ChartFallback({ label }: { label: string }) {
  return (
    <div className="chart-fallback">
      <BarChart3 size={28} />
      <span>{label}</span>
    </div>
  );
}

function BrokerDatum({ label, tone = "", value }: { label: string; tone?: "positive" | "negative" | ""; value: string }) {
  return (
    <div className={tone ? `broker-datum ${tone}` : "broker-datum"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
