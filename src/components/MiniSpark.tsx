import { type PointerEvent, type TouchEvent, useId, useState } from "react";
import { filterByChartRange, getChartRangeLabel } from "../lib/chartRanges";
import { formatPercent, formatPrice, formatRate } from "../lib/format";
import type { ChartRangeKey, StockCandle } from "../types";

type MiniSparkProps = {
  candles: StockCandle[];
  currency: string;
  range: ChartRangeKey;
  symbol: string;
  variant?: "card" | "focus";
};

type SparkPoint = {
  date: string;
  rate: number;
  x: number;
  y: number;
};

export function MiniSpark({ candles, currency, range, symbol, variant = "card" }: MiniSparkProps) {
  const gradientId = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const visible = filterByChartRange(candles, range).filter((candle) => Number.isFinite(candle.close));

  if (visible.length < 2) {
    return (
      <div className={`spark-shell ${variant}`}>
        <div className="spark-head">
          <span>Close {getChartRangeLabel(range)}</span>
          <strong>Waiting</strong>
        </div>
        <div className="spark-empty">No candle history</div>
      </div>
    );
  }

  const values = visible.map((candle) => candle.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const valueRange = max - min || 1;
  const start = visible[0];
  const end = visible[visible.length - 1];
  const change = start.close ? end.close / start.close - 1 : 0;
  const coordinates: SparkPoint[] = visible.map((candle, index) => ({
    date: candle.date,
    rate: candle.close,
    x: (index / (visible.length - 1)) * 100,
    y: 6 + (1 - (candle.close - min) / valueRange) * 36,
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `M ${coordinates[0].x} 46 ${coordinates.map((point) => `L ${point.x} ${point.y}`).join(" ")} L ${coordinates[coordinates.length - 1].x} 46 Z`;
  const activePoint = hoveredIndex === null ? null : coordinates[hoveredIndex];
  const rangeLabel = getChartRangeLabel(range);
  const tooltipLeft = activePoint ? Math.min(88, Math.max(12, activePoint.x)) : 50;

  function selectPoint(clientX: number, bounds: DOMRect) {
    const x = ((clientX - bounds.left) / bounds.width) * 100;
    const index = Math.round((x / 100) * (coordinates.length - 1));
    setHoveredIndex(Math.max(0, Math.min(coordinates.length - 1, index)));
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    selectPoint(event.clientX, event.currentTarget.getBoundingClientRect());
  }

  function handleTouch(event: TouchEvent<SVGSVGElement>) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) return;
    selectPoint(touch.clientX, event.currentTarget.getBoundingClientRect());
  }

  return (
    <div
      aria-label={`${symbol} actual close chart for ${rangeLabel}: ${formatPrice(start.close, currency)} to ${formatPrice(end.close, currency)}`}
      className={change < 0 ? `spark-shell ${variant} down` : `spark-shell ${variant} up`}
    >
      <div className="spark-head">
        <span>
          <i />
          Actual close · {rangeLabel}
        </span>
        <strong>{formatPercent(change, true)}</strong>
      </div>
      <div className="spark-chart">
        <svg
          aria-label={`${symbol} close-price sparkline`}
          className="spark"
          onPointerDown={handlePointerMove}
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerMove={handlePointerMove}
          onTouchMove={handleTouch}
          onTouchStart={handleTouch}
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 100 48"
        >
          <defs>
            <linearGradient id={`${gradientId}SparkFill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line className="spark-grid" x1="0" x2="100" y1="7" y2="7" />
          <line className="spark-grid" x1="0" x2="100" y1="42" y2="42" />
          <path className="spark-area" d={area} fill={`url(#${gradientId}SparkFill)`} />
          <polyline className="spark-line" pathLength={1} points={line} />
          <text className="spark-axis" x="1" y="6">
            Close
          </text>
          <text className="spark-axis" textAnchor="end" x="99" y="46">
            {rangeLabel}
          </text>
          {activePoint ? (
            <>
              <line className="spark-focus-line" x1={activePoint.x} x2={activePoint.x} y1="6" y2="42" />
              <circle className="spark-marker" cx={activePoint.x} cy={activePoint.y} r="2.4" />
            </>
          ) : null}
        </svg>
        {activePoint ? (
          <div className="spark-tooltip" style={{ left: `${tooltipLeft}%`, top: `${activePoint.y}%` }}>
            <span>{activePoint.date}</span>
            <strong>{formatPrice(activePoint.rate, currency)}</strong>
          </div>
        ) : null}
      </div>
      <div className="spark-foot">
        <span>{start.date}</span>
        <strong>
          {formatRate(min)} - {formatRate(max)}
        </strong>
        <span>{end.date}</span>
      </div>
    </div>
  );
}
