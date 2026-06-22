import { type PointerEvent, type ReactNode, type TouchEvent, useState } from "react";
import { createPortal } from "react-dom";
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
import { filterByChartRange, getChartRangeLabel } from "../../lib/chartRanges";
import { formatCompact, formatPercent, formatPrice, formatRate } from "../../lib/format";
import { getHorizonLabel, getMlSignals } from "../../lib/ml";
import type { ChartMode, ChartRangeKey, MlSettings, RatePoint, StockCandle } from "../../types";
import { InfoTip } from "../InfoTip";

type ChartTooltipPosition = {
  horizontal: "left" | "right";
  left: number;
  placement: "above" | "below";
  top: number;
};

type LegendItem = {
  label: string;
  tone?: "blue" | "green" | "red" | "yellow";
};

type TooltipLine = {
  label?: string;
  value: string;
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
  mlSettings: MlSettings;
  mode: ChartMode;
  range: ChartRangeKey;
};

export function BrokerWorkspace({ candles, currentRate, mlSettings, mode, range }: BrokerWorkspaceProps) {
  const allPoints = candleToRatePoints(candles);
  const points = filterByChartRange(allPoints, range);
  const visibleCandles = filterByChartRange(candles, range);

  if (mode === "candles") return <CandleChart candles={visibleCandles} range={range} />;
  if (mode === "returns") return <ReturnsView points={points} range={range} />;
  if (mode === "depth") return <DepthView currentRate={currentRate} points={points} range={range} />;
  if (mode === "technicals") return <TechnicalsView points={points} range={range} />;
  if (mode === "risk") return <RiskView points={points} range={range} />;
  if (mode === "projections") return <ProjectionView candles={candles} mlSettings={mlSettings} range={range} />;
  return <BigChart points={points} range={range} />;
}

function BigChart({ points, range: chartRange }: { points: RatePoint[]; range: ChartRangeKey }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipPosition | null>(null);

  if (points.length < 2) return <ChartFallback label="No chart data yet" />;

  const width = 900;
  const height = 310;
  const pad = 22;
  const values = points.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const valueRange = max - min || 1;
  const coordinates = points.map((point, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (point.rate - min) / valueRange) * (height - pad * 2);
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
    <div className="line-view">
      <GraphHeader
        description="Closing price over the selected visible range, with exact date and close available on inspection."
        legend={[{ label: "Close", tone: rising ? "green" : "red" }]}
        title="Price path"
      />
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
        <text className="axis-label" x={pad} y={16}>
          Price
        </text>
        <text className="axis-label" textAnchor="end" x={width - pad} y={height - 8}>
          {getChartRangeLabel(chartRange)}
        </text>
        {activePoint ? (
          <>
            <line className="chart-focus-line" x1={activePoint.x} x2={activePoint.x} y1={pad} y2={height - pad} />
            <circle className="chart-marker" cx={activePoint.x} cy={activePoint.y} r="8" />
          </>
        ) : null}
      </svg>
      {activePoint && tooltip ? (
        <ChartTooltipFrame position={tooltip}>
          <span>{activePoint.date}</span>
          <strong>{formatPrice(activePoint.rate)}</strong>
        </ChartTooltipFrame>
      ) : null}
      <ChartRange end={points[points.length - 1].date} start={points[0].date} summary={`${formatRate(min)} - ${formatRate(max)}`} />
      </div>
    </div>
  );
}

function CandleChart({ candles, range: chartRange }: { candles: StockCandle[]; range: ChartRangeKey }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipPosition | null>(null);

  if (candles.length < 2) return <ChartFallback label="No candle data yet" />;

  const width = 900;
  const height = 310;
  const pad = 24;
  const lows = candles.map((point) => point.low);
  const highs = candles.map((point) => point.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const valueRange = max - min || 1;
  const innerWidth = width - pad * 2;
  const candleGap = innerWidth / candles.length;
  const bodyWidth = Math.max(3, Math.min(8, candleGap * 0.54));
  const coordinates = candles.map((point, index) => {
    const x = pad + candleGap * index + candleGap / 2;
    const y = (value: number) => pad + (1 - (value - min) / valueRange) * (height - pad * 2);
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
    <div className="candle-view">
      <GraphHeader
        description="Daily open, high, low, and close candles. Green means close finished above open; red means it finished below open."
        legend={[
          { label: "Up candle", tone: "green" },
          { label: "Down candle", tone: "red" },
        ]}
        title="Candles"
      />
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
        <text className="axis-label" x={pad} y={16}>
          OHLC
        </text>
        <text className="axis-label" textAnchor="end" x={width - pad} y={height - 8}>
          {getChartRangeLabel(chartRange)}
        </text>
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
        <ChartTooltipFrame className="candle-tip" position={tooltip}>
          <span>{activePoint.date}</span>
          <strong>{formatPrice(activePoint.close)}</strong>
          <em>O {formatRate(activePoint.open)}</em>
          <em>H {formatRate(activePoint.high)}</em>
          <em>L {formatRate(activePoint.low)}</em>
        </ChartTooltipFrame>
      ) : null}
      <ChartRange end={candles[candles.length - 1].date} start={candles[0].date} summary={`${formatRate(min)} - ${formatRate(max)}`} />
      </div>
    </div>
  );
}

function ReturnsView({ points, range }: { points: RatePoint[]; range: ChartRangeKey }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipPosition | null>(null);
  const returns = getReturns(points);
  if (!returns.length) return <ChartFallback label="No return data yet" />;

  const width = 900;
  const height = 250;
  const pad = 22;
  const maxAbs = Math.max(...returns.map((point) => Math.abs(point.returnValue))) || 1;
  const barGap = (width - pad * 2) / returns.length;
  const zeroY = height / 2;
  const bars = returns.map((point, index) => {
    const x = pad + index * barGap;
    const barHeight = Math.max(2, (Math.abs(point.returnValue) / maxAbs) * (height / 2 - pad));
    const y = point.returnValue >= 0 ? zeroY - barHeight : zeroY;
    return {
      ...point,
      barHeight,
      x,
      y,
    };
  });
  const activePoint = hoveredIndex === null ? null : bars[hoveredIndex];

  function selectPoint(clientX: number, clientY: number, bounds: DOMRect) {
    const x = ((clientX - bounds.left) / bounds.width) * width;
    const index = Math.round((x - pad) / barGap);
    setHoveredIndex(Math.max(0, Math.min(bars.length - 1, index)));
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
    <div className="returns-view">
      <GraphHeader
        description="One bar per daily close-to-close return in the selected range."
        legend={[
          { label: "Gain", tone: "green" },
          { label: "Loss", tone: "red" },
        ]}
        title="Daily returns"
      />
      <div className="interactive-chart">
        <svg
          aria-label="Daily return bars"
          className="returns-chart"
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
          <line className="chart-grid zero" x1={pad} x2={width - pad} y1={zeroY} y2={zeroY} />
          <text className="axis-label" x={pad} y={16}>
            Daily %
          </text>
          <text className="axis-label" textAnchor="end" x={width - pad} y={height - 8}>
            {getChartRangeLabel(range)}
          </text>
          {bars.map((point) => (
            <rect
              className={point.returnValue >= 0 ? "return-bar up" : "return-bar down"}
              height={point.barHeight}
              key={point.date}
              rx="2"
              width={Math.max(2, barGap * 0.7)}
              x={point.x}
              y={point.y}
            />
          ))}
          {activePoint ? <line className="chart-focus-line" x1={activePoint.x} x2={activePoint.x} y1={pad} y2={height - pad} /> : null}
        </svg>
        {activePoint && tooltip ? (
          <FloatingChartTooltip
            lines={[{ value: activePoint.date }, { label: "Daily return", value: formatPercent(activePoint.returnValue, true) }]}
            position={tooltip}
            title={activePoint.returnValue >= 0 ? "Gain" : "Loss"}
          />
        ) : null}
        <ChartRange end={returns[returns.length - 1].date} start={returns[0].date} summary={`Max move ${formatPercent(maxAbs, true)}`} />
      </div>
      <div className="broker-panels">
        <BrokerDatum detail="Largest positive daily close-to-close return in the selected range." label="Best day" value={formatPercent(Math.max(...returns.map((point) => point.returnValue)), true)} />
        <BrokerDatum detail="Largest negative daily close-to-close return in the selected range." label="Worst day" value={formatPercent(Math.min(...returns.map((point) => point.returnValue)), true)} />
        <BrokerDatum detail="Average daily close-to-close return in the selected range." label="Mean day" value={formatPercent(mean(returns.map((point) => point.returnValue)), true)} />
      </div>
    </div>
  );
}

function DepthView({ currentRate, points, range }: { currentRate: number; points: RatePoint[]; range: ChartRangeKey }) {
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
      <GraphHeader
        description="A simulated order-book view built from recent volatility and the current price. It is useful for shape and imbalance, not live liquidity."
        legend={[
          { label: "Bid model", tone: "green" },
          { label: "Ask model", tone: "red" },
        ]}
        title={`Modeled depth from ${getChartRangeLabel(range)} history`}
      />
      <div className="depth-book">
        <div className="depth-head">
          <span>Bid model</span>
          <strong>{formatPrice(currentRate)}</strong>
          <span>Ask model</span>
        </div>
        {levels.map((level) => (
          <div
            aria-label={`Modeled bid ${formatRate(level.bid)} size ${formatCompact(level.bidSize, 0)}, modeled ask ${formatRate(level.ask)} size ${formatCompact(level.askSize, 0)}`}
            className="depth-row hover-data-row"
            key={`${level.bid}-${level.ask}`}
            title="Modeled level from current price, selected-range volatility, and a smooth liquidity decay. This is not a live order book."
          >
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
        <BrokerDatum detail="Distance between the nearest modeled bid and ask levels." label="Model spread" value={formatRate(spread)} />
        <BrokerDatum detail="Bid minus ask modeled size divided by total modeled size. Positive means the model leans bid-heavy." label="Book skew" tone={imbalance >= 0 ? "positive" : "negative"} value={formatPercent(imbalance, true)} />
        <BrokerDatum detail={`Daily return volatility calculated from the selected ${getChartRangeLabel(range)} range.`} label="Vol input" value={formatPercent(volatility)} />
      </div>
    </div>
  );
}

function TechnicalsView({ points, range }: { points: RatePoint[]; range: ChartRangeKey }) {
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
      <GraphHeader
        description="Closing price with 20-day and 50-day simple moving averages."
        legend={[
          { label: "Price", tone: "green" },
          { label: "SMA 20", tone: "blue" },
          { label: "SMA 50", tone: "yellow" },
        ]}
        title="Technical overlay"
      />
      <TechnicalOverlay points={points} range={range} />
      <div className="broker-panels technical-grid">
        <BrokerDatum detail="Bullish when price is above SMA 20 and SMA 20 is above SMA 50; bearish when the stack is inverted." label="Trend" tone={trend === "Bullish" ? "positive" : trend === "Bearish" ? "negative" : ""} value={trend} />
        <BrokerDatum detail="Average close over the latest 20 trading sessions in the selected range." label="SMA 20" value={formatPrice(sma20)} />
        <BrokerDatum detail="Average close over the latest 50 trading sessions in the selected range." label="SMA 50" value={formatPrice(sma50)} />
        <BrokerDatum detail="Relative Strength Index over 14 sessions. Above 70 is commonly read as stretched; below 30 as washed out." label="RSI 14" tone={rsi14 >= 70 ? "negative" : rsi14 <= 30 ? "positive" : ""} value={formatCompact(rsi14, 1)} />
        <BrokerDatum detail="MACD histogram: the gap between MACD and its signal line. Positive means momentum is above its signal." label="MACD" tone={macd.histogram >= 0 ? "positive" : "negative"} value={formatCompact(macd.histogram, 5)} />
        <BrokerDatum detail="Latest close versus the 20-day moving average." label="20D mom" tone={momentum20 >= 0 ? "positive" : "negative"} value={formatPercent(momentum20, true)} />
      </div>
    </div>
  );
}

function TechnicalOverlay({ points, range: chartRange }: { points: RatePoint[]; range: ChartRangeKey }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipPosition | null>(null);
  const visible = points;
  const width = 900;
  const height = 270;
  const pad = 24;
  const values = visible.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const valueRange = max - min || 1;
  const sma20 = rollingAverage(values, 20);
  const sma50 = rollingAverage(values, 50);
  const coordinates = visible.map((point, index) => {
    const x = pad + (index / (visible.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (point.rate - min) / valueRange) * (height - pad * 2);
    const yFor = (value: number) => pad + (1 - (value - min) / valueRange) * (height - pad * 2);
    return {
      ...point,
      sma20: sma20[index],
      sma20Y: yFor(sma20[index]),
      sma50: sma50[index],
      sma50Y: yFor(sma50[index]),
      x,
      y,
    };
  });
  const activePoint = hoveredIndex === null ? null : coordinates[hoveredIndex];
  const toPath = (series: number[]) =>
    series
      .map((value, index) => {
        const x = pad + (index / (series.length - 1)) * (width - pad * 2);
        const y = pad + (1 - (value - min) / valueRange) * (height - pad * 2);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  const pricePath = toPath(values);
  const sma20Path = toPath(sma20);
  const sma50Path = toPath(sma50);

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
        aria-label="Technical overlay chart"
        className="technical-chart"
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
        <text className="axis-label" x={pad} y={16}>
          Price + averages
        </text>
        <text className="axis-label" textAnchor="end" x={width - pad} y={height - 8}>
          {getChartRangeLabel(chartRange)}
        </text>
        <path className="technical-line price" d={pricePath} />
        <path className="technical-line sma20" d={sma20Path} />
        <path className="technical-line sma50" d={sma50Path} />
        {activePoint ? (
          <>
            <line className="chart-focus-line" x1={activePoint.x} x2={activePoint.x} y1={pad} y2={height - pad} />
            <circle className="chart-marker tech-price" cx={activePoint.x} cy={activePoint.y} r="6" />
          </>
        ) : null}
      </svg>
      {activePoint && tooltip ? (
        <FloatingChartTooltip
          lines={[
            { value: activePoint.date },
            { label: "Close", value: formatPrice(activePoint.rate) },
            { label: "SMA 20", value: formatPrice(activePoint.sma20) },
            { label: "SMA 50", value: formatPrice(activePoint.sma50) },
          ]}
          position={tooltip}
          title="Technical read"
        />
      ) : null}
      <ChartRange end={visible[visible.length - 1].date} start={visible[0].date} summary={`${formatRate(min)} - ${formatRate(max)}`} />
    </div>
  );
}

function RiskView({ points, range }: { points: RatePoint[]; range: ChartRangeKey }) {
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

  const drawdowns = getDrawdownSeries(values).map((value, index) => ({ date: points[index].date, value }));
  const rollingVol = standardDeviation(returns.slice(-20).map((point) => point.returnValue)) * Math.sqrt(252);
  const dailyMean = mean(returns.map((point) => point.returnValue));
  const dailyVol = standardDeviation(returns.map((point) => point.returnValue));
  const var95 = dailyMean - 1.65 * dailyVol;
  const upsideDays = returns.filter((point) => point.returnValue >= 0).length / returns.length;
  const rewardRisk = dailyVol ? (dailyMean / dailyVol) * Math.sqrt(252) : 0;

  return (
    <div className="risk-view">
      <GraphHeader
        description="Drawdown shows how far price has fallen from the previous high inside the selected range."
        legend={[{ label: "Drawdown", tone: "red" }]}
        title="Risk and drawdown"
      />
      <DrawdownChart points={drawdowns} range={range} />
      <div className="broker-panels technical-grid">
        <BrokerDatum detail="Annualized volatility from the latest 20 daily returns in the selected range." label="20D vol" value={formatPercent(rollingVol)} />
        <BrokerDatum detail="Simple 95% one-day value-at-risk estimate: mean daily return minus 1.65 standard deviations." label="Daily VaR 95" tone="negative" value={formatPercent(var95, true)} />
        <BrokerDatum detail="Share of daily returns in the selected range that closed flat or positive." label="Upside days" value={formatPercent(upsideDays)} />
        <BrokerDatum detail="Annualized mean daily return divided by daily volatility. Positive values imply more reward per unit of volatility." label="Reward/risk" tone={rewardRisk >= 0 ? "positive" : "negative"} value={formatCompact(rewardRisk, 2)} />
        <BrokerDatum detail="Lowest close in the selected range." label="Worst close" value={formatPrice(Math.min(...values))} />
        <BrokerDatum detail="Highest close in the selected range." label="Best close" value={formatPrice(Math.max(...values))} />
      </div>
    </div>
  );
}

function ProjectionView({ candles, mlSettings, range }: { candles: StockCandle[]; mlSettings: MlSettings; range: ChartRangeKey }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipPosition | null>(null);
  const ml = getMlSignals(candles, mlSettings);
  const history = ml.probabilityHistory;
  const visibleHistory = filterByChartRange(history, range);

  if (ml.status === "limited" || visibleHistory.length < 2) {
    return (
      <div className="chart-fallback">
        <Gauge size={28} />
        <span>More candles are needed for projections</span>
      </div>
    );
  }

  const width = 900;
  const height = 260;
  const pad = 24;
  const coordinates = visibleHistory.map((point, index) => {
    const x = pad + (index / (visibleHistory.length - 1)) * (width - pad * 2);
    const y = pad + (1 - point.probabilityUp) * (height - pad * 2);
    return {
      ...point,
      x,
      y,
    };
  });
  const activePoint = hoveredIndex === null ? null : coordinates[hoveredIndex];
  const line = coordinates
    .map((point, index) => {
      const { x, y } = point;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const area = `${line} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`;
  const maxContribution = Math.max(...ml.features.map((feature) => Math.abs(feature.contribution)), 0.001);

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
    <div className="projection-view">
      <GraphHeader
        description={`Probability history for the selected ${getHorizonLabel(ml.horizon)} horizon. The chart is filtered by visible range; the model still trains from the selected training window.`}
        legend={[
          { label: "Up probability", tone: "blue" },
          { label: "50% neutral line", tone: "yellow" },
        ]}
        title="Projection probability"
      />
      <div className="interactive-chart">
        <svg
          aria-label="Projection probability chart"
          className="projection-chart"
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
            <linearGradient id="projectionFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#64d2ff" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#64d2ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line className="chart-grid" x1={pad} x2={width - pad} y1={pad} y2={pad} />
          <line className="chart-grid zero" x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} />
          <line className="chart-grid" x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} />
          <text className="axis-label" x={pad} y={16}>
            Up probability
          </text>
          <text className="axis-label" textAnchor="end" x={width - pad} y={height - 8}>
          {getChartRangeLabel(range)}
          </text>
          <path className="projection-area" d={area} />
          <path className="projection-line" d={line} />
          {activePoint ? (
            <>
              <line className="chart-focus-line" x1={activePoint.x} x2={activePoint.x} y1={pad} y2={height - pad} />
              <circle className="chart-marker projection-marker" cx={activePoint.x} cy={activePoint.y} r="7" />
            </>
          ) : null}
        </svg>
        {activePoint && tooltip ? (
          <FloatingChartTooltip
            lines={[
              { value: activePoint.date },
              { label: "Up probability", value: formatPercent(activePoint.probabilityUp) },
              { label: "Realized forward move", value: formatPercent(activePoint.nextReturn, true) },
            ]}
            position={tooltip}
            title={`${getHorizonLabel(ml.horizon)} projection`}
          />
        ) : null}
        <ChartRange
          end={visibleHistory[visibleHistory.length - 1].date}
          start={visibleHistory[0].date}
          summary={`${formatPercent(Math.min(...visibleHistory.map((point) => point.probabilityUp)))} - ${formatPercent(Math.max(...visibleHistory.map((point) => point.probabilityUp)))}`}
        />
      </div>
      <div className="broker-panels technical-grid">
        <BrokerDatum
          detail="Probability that the selected horizon closes above the latest close, from the local logistic classifier."
          label={`${getHorizonLabel(ml.horizon)} up`}
          tone={ml.probabilityUp >= 0.5 ? "positive" : "negative"}
          value={formatPercent(ml.probabilityUp)}
        />
        <BrokerDatum
          detail="Average forward return from the nearest historical setups under the current model settings."
          label="Expected"
          tone={ml.expectedMove >= 0 ? "positive" : "negative"}
          value={formatPercent(ml.expectedMove, true)}
        />
        <BrokerDatum detail="Blend of non-neutral probability and holdout hit rate." label="Confidence" value={formatPercent(ml.confidence)} />
        <BrokerDatum detail="Chronological validation accuracy on the final quarter of samples." label="Holdout hit" value={formatPercent(ml.testAccuracy)} />
        <BrokerDatum detail="Label from trend stack, momentum, RSI, and drawdown." label="Trend" value={ml.trend.label} />
        <BrokerDatum detail="Volatility and probability regime for the selected horizon." label="Regime" value={ml.regime} />
      </div>
      <div className="forecast-strip" aria-label="Projection forward horizons">
        {ml.forecasts.map((forecast) => (
          <div className={forecast.expectedMove >= 0 ? "forecast-card positive" : "forecast-card negative"} key={forecast.horizon}>
            <span>
              {getHorizonLabel(forecast.horizon)}
              <InfoTip text={`Retrains this symbol's local projection model for ${getHorizonLabel(forecast.horizon)} and averages nearby historical setups. Sample size: ${forecast.sampleSize}.`} />
            </span>
            <strong>{formatPercent(forecast.expectedMove, true)}</strong>
            <em>{formatPercent(forecast.probabilityUp)} up</em>
          </div>
        ))}
      </div>
      <div className="feature-stack" aria-label="Projection feature contributions">
        {ml.features.slice(0, 6).map((feature) => (
          <div className={feature.direction === "bullish" ? "feature-row positive" : "feature-row negative"} key={feature.label}>
            <span>
              {feature.label}
              <InfoTip text={`${feature.detail} Contribution shows this feature's current push after model weighting and scaling.`} />
            </span>
            <div>
              <em style={{ width: `${(Math.abs(feature.contribution) / maxContribution) * 100}%` }} />
            </div>
            <strong>{formatCompact(feature.contribution, 3)}</strong>
          </div>
        ))}
      </div>
      <div className="trend-stack" aria-label="Trend components">
        {ml.trend.components.map((component) => (
          <div className={component.score >= 0 ? "trend-row positive" : "trend-row negative"} key={component.label}>
            <span>
              {component.label}
              <InfoTip text={getTrendComponentDetail(component.label)} />
            </span>
            <strong>{component.value}</strong>
            <em>{formatCompact(component.score, 2)}</em>
          </div>
        ))}
      </div>
      <div className="setup-stack" aria-label="Closest historical setups">
        <div className="setup-head">
          <strong>Closest historical setups</strong>
          <InfoTip text="These are the historical feature snapshots nearest to today's setup. Their forward returns are averaged into the expected-move estimate." />
        </div>
        {ml.similarSetups.slice(0, 5).map((setup) => (
          <div className="setup-row hover-data-row" key={setup.date}>
            <span>{setup.date}</span>
            <strong className={setup.nextReturn >= 0 ? "positive-text" : "negative-text"}>{formatPercent(setup.nextReturn, true)}</strong>
            <em>distance {formatCompact(setup.distance, 2)}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function DrawdownChart({ points, range: chartRange }: { points: Array<{ date: string; value: number }>; range: ChartRangeKey }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipPosition | null>(null);
  const width = 900;
  const height = 250;
  const pad = 22;
  const values = points.map((point) => point.value);
  const min = Math.min(...values, 0);
  const valueRange = Math.abs(min) || 1;
  const coordinates = points.map((point, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = pad + (Math.abs(point.value) / valueRange) * (height - pad * 2);
    return {
      ...point,
      x,
      y,
    };
  });
  const activePoint = hoveredIndex === null ? null : coordinates[hoveredIndex];
  const path = coordinates
    .map((point, index) => {
      const { x, y } = point;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const area = `${path} L ${width - pad} ${pad} L ${pad} ${pad} Z`;

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
        aria-label="Drawdown chart"
        className="drawdown-chart"
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
        <line className="chart-grid zero" x1={pad} x2={width - pad} y1={pad} y2={pad} />
        <text className="axis-label" x={pad} y={16}>
          Drawdown
        </text>
        <text className="axis-label" textAnchor="end" x={width - pad} y={height - 8}>
          {getChartRangeLabel(chartRange)}
        </text>
        <path className="drawdown-area" d={area} />
        <path className="drawdown-line" d={path} />
        {activePoint ? (
          <>
            <line className="chart-focus-line" x1={activePoint.x} x2={activePoint.x} y1={pad} y2={height - pad} />
            <circle className="chart-marker risk-marker" cx={activePoint.x} cy={activePoint.y} r="7" />
          </>
        ) : null}
      </svg>
      {activePoint && tooltip ? (
        <FloatingChartTooltip
          lines={[{ value: activePoint.date }, { label: "From prior high", value: formatPercent(activePoint.value, true) }]}
          position={tooltip}
          title="Drawdown"
        />
      ) : null}
      <ChartRange end={points[points.length - 1].date} start={points[0].date} summary={`Worst ${formatPercent(min, true)}`} />
    </div>
  );
}

function GraphHeader({ description, legend = [], title }: { description: string; legend?: LegendItem[]; title: string }) {
  return (
    <div className="graph-header">
      <div className="graph-title">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <InfoTip text={description} />
      {legend.length ? (
        <div className="graph-legend" aria-label={`${title} legend`}>
          {legend.map((item) => (
            <span className={item.tone ? `legend-item ${item.tone}` : "legend-item"} key={item.label}>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FloatingChartTooltip({ lines, position, title }: { lines: TooltipLine[]; position: ChartTooltipPosition; title: string }) {
  return (
    <ChartTooltipFrame position={position}>
      <span>{title}</span>
      {lines.map((line) => (
        <span className={line.label ? "tooltip-line" : ""} key={`${line.label ?? "line"}-${line.value}`}>
          {line.label ? <em>{line.label}</em> : null}
          <strong>{line.value}</strong>
        </span>
      ))}
    </ChartTooltipFrame>
  );
}

function ChartTooltipFrame({ children, className = "", position }: { children: ReactNode; className?: string; position: ChartTooltipPosition }) {
  return createPortal(
    <div className={`${getTooltipClassName(position)} ${className}`.trim()} style={{ left: position.left, top: position.top }}>
      {children}
    </div>,
    document.body,
  );
}

function getTrendComponentDetail(label: string) {
  if (label === "Stack") return "Checks whether the latest close, SMA 20, SMA 50, and SMA 200 are aligned upward, downward, or mixed.";
  if (label === "20D trend") return "Latest close compared with the 20-day moving average, scaled into a -1 to +1 trend score.";
  if (label === "50D trend") return "Latest close compared with the 50-day moving average, scaled into a -1 to +1 trend score.";
  if (label === "RSI") return "Fourteen-session Relative Strength Index converted into a centered score. Higher means stronger recent buying pressure.";
  if (label === "Drawdown") return "Current price versus the trailing one-year high. Smaller drawdowns score better.";
  return "One piece of the trend score used to label the projection as bullish, mixed, or bearish.";
}

function ChartRange({ end, start, summary }: { end: string; start: string; summary: string }) {
  return (
    <div className="chart-range">
      <span>{start}</span>
      <strong>{summary}</strong>
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

function BrokerDatum({
  detail,
  label,
  tone = "",
  value,
}: {
  detail?: string;
  label: string;
  tone?: "positive" | "negative" | "";
  value: string;
}) {
  return (
    <div className={tone ? `broker-datum ${tone}` : "broker-datum"}>
      <span>
        {label}
        {detail ? <InfoTip text={detail} /> : null}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
