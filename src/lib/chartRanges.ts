import type { ChartRangeKey } from "../types";

export const CHART_RANGE_KEYS: ChartRangeKey[] = ["1m", "3m", "6m", "1y", "5y"];

export const CHART_RANGE_LENGTHS: Record<ChartRangeKey, number> = {
  "1m": 21,
  "3m": 63,
  "6m": 126,
  "1y": 252,
  "5y": 1260,
};

export function filterByChartRange<T>(items: T[], range: ChartRangeKey) {
  return items.slice(-CHART_RANGE_LENGTHS[range]);
}

export function getChartRangeLabel(range: ChartRangeKey) {
  if (range === "1m") return "1M";
  if (range === "3m") return "3M";
  if (range === "6m") return "6M";
  if (range === "1y") return "1Y";
  return "5Y";
}
