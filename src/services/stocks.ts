import { normalizeSymbol } from "../lib/format";
import type { StockCandle, StockQuote } from "../types";

type YahooChartResponse = {
  chart?: {
    error?: { code?: string; description?: string } | null;
    result?: Array<{
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          open?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
      meta?: {
        chartPreviousClose?: number;
        currency?: string;
        exchangeName?: string;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        fullExchangeName?: string;
        longName?: string;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        regularMarketVolume?: number;
        shortName?: string;
        symbol?: string;
      };
      timestamp?: number[];
    }>;
  };
};

type YahooQuoteBlock = {
  close?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  open?: Array<number | null>;
  volume?: Array<number | null>;
};

const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const CORS_PROXY = "https://corsproxy.io/?";

export async function fetchStock(symbol: string, signal?: AbortSignal, range = "5y"): Promise<StockQuote> {
  const cleanSymbol = normalizeSymbol(symbol);
  if (!cleanSymbol) throw new Error("Symbol is required");

  const target = new URL(`${CHART_URL}/${encodeURIComponent(cleanSymbol)}`);
  target.searchParams.set("range", range);
  target.searchParams.set("interval", "1d");
  target.searchParams.set("includePrePost", "false");
  target.searchParams.set("events", "div,splits");

  const payload = await fetchJson(`${CORS_PROXY}${encodeURIComponent(target.toString())}`, signal);
  const error = payload.chart?.error;
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];

  if (error) throw new Error(error.description ?? error.code ?? "Stock feed unavailable");
  if (!result || !meta || !quote) throw new Error(`${cleanSymbol} returned no chart data`);

  const candles = buildCandles(result.timestamp ?? [], quote);
  const lastCandle = candles[candles.length - 1];
  const previousClose = candles[candles.length - 2]?.close ?? finite(meta.chartPreviousClose) ?? lastCandle?.close ?? 0;
  const price = finite(meta.regularMarketPrice) ?? lastCandle?.close ?? previousClose;
  const change = price - previousClose;
  const changePercent = previousClose ? change / previousClose : 0;

  return {
    candles,
    change,
    changePercent,
    currency: meta.currency ?? "USD",
    dayHigh: finite(meta.regularMarketDayHigh) ?? lastCandle?.high ?? price,
    dayLow: finite(meta.regularMarketDayLow) ?? lastCandle?.low ?? price,
    exchange: meta.exchangeName ?? meta.fullExchangeName ?? "Market",
    fiftyTwoWeekHigh: finite(meta.fiftyTwoWeekHigh) ?? Math.max(...candles.map((candle) => candle.high), price),
    fiftyTwoWeekLow: finite(meta.fiftyTwoWeekLow) ?? Math.min(...candles.map((candle) => candle.low), price),
    name: meta.shortName ?? meta.longName ?? cleanSymbol,
    previousClose,
    price,
    provider: "Yahoo Finance chart",
    symbol: meta.symbol ?? cleanSymbol,
    updatedAt: (meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
    volume: finite(meta.regularMarketVolume) ?? lastCandle?.volume ?? 0,
  };
}

function buildCandles(timestamps: number[], quote: YahooQuoteBlock): StockCandle[] {
  return timestamps
    .map((timestamp, index) => {
      const close = finite(quote.close?.[index]);
      if (close === undefined) return null;

      return {
        close,
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        high: finite(quote.high?.[index]) ?? close,
        low: finite(quote.low?.[index]) ?? close,
        open: finite(quote.open?.[index]) ?? close,
        volume: finite(quote.volume?.[index]) ?? 0,
      };
    })
    .filter((candle): candle is StockCandle => Boolean(candle));
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<YahooChartResponse> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Stock request failed with ${response.status}`);

  const text = await response.text();
  const jsonText = extractJson(text);
  return JSON.parse(jsonText) as YahooChartResponse;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const marker = "Markdown Content:";
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex >= 0) {
    const content = trimmed.slice(markerIndex + marker.length).trim();
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) return content.slice(start, end + 1);
  }

  return trimmed;
}

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
