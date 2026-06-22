import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeSymbol } from "../lib/format";
import { readSetting, writeSetting } from "../lib/storage";
import { fetchStock } from "../services/stocks";
import type { StockQuote } from "../types";

type CachedQuote = {
  data: StockQuote;
  receivedAt: number;
};

const CACHE_PREFIX = "stocktrack:v2:quote:";
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const STALE_AFTER_MS = 10 * 60 * 1000;

function cacheKey(symbol: string) {
  return `${CACHE_PREFIX}${normalizeSymbol(symbol)}`;
}

function readCachedQuote(symbol: string) {
  return readSetting<CachedQuote | null>(cacheKey(symbol), null);
}

function writeCachedQuote(symbol: string, data: StockQuote) {
  writeSetting<CachedQuote>(cacheKey(symbol), { data, receivedAt: Date.now() });
}

export function useStocks(symbols: string[]) {
  const cleanSymbols = useMemo(() => Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))), [symbols]);
  const [quotes, setQuotes] = useState<StockQuote[]>(() => cleanSymbols.flatMap((symbol) => readCachedQuote(symbol)?.data ?? []));
  const [loading, setLoading] = useState(() => quotes.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const cached = cleanSymbols.flatMap((symbol) => readCachedQuote(symbol)?.data ?? []);
    setQuotes(sortQuotes(cached, cleanSymbols));
    setLoading(cached.length === 0);
  }, [cleanSymbols]);

  useEffect(() => {
    if (!cleanSymbols.length) return;

    const controller = new AbortController();
    const cached = cleanSymbols.flatMap((symbol) => readCachedQuote(symbol)?.data ?? []);

    setLoading(cached.length === 0);
    setRefreshing(cached.length > 0);
    setError("");

    Promise.allSettled(cleanSymbols.map((symbol) => fetchStock(symbol, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;

        const next = results.flatMap((result, index) => {
          const symbol = cleanSymbols[index];
          if (result.status === "fulfilled") {
            writeCachedQuote(symbol, result.value);
            return [result.value];
          }

          return readCachedQuote(symbol)?.data ?? [];
        });
        const failures = results.filter((result) => result.status === "rejected").length;

        setQuotes(sortQuotes(next, cleanSymbols));
        setError(failures ? `${failures} symbol${failures === 1 ? "" : "s"} could not refresh` : "");
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Stock feed unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [cleanSymbols, refreshKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_INTERVAL_MS);

    const handleVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [refresh]);

  const stale = useMemo(() => {
    if (error) return true;
    if (!quotes.length) return false;
    return quotes.some((quote) => {
      const cached = readCachedQuote(quote.symbol);
      return cached ? Date.now() - cached.receivedAt > STALE_AFTER_MS : true;
    });
  }, [error, quotes]);

  return {
    error,
    loading,
    quotes,
    refresh,
    refreshing,
    stale,
  };
}

function sortQuotes(quotes: StockQuote[], order: string[]) {
  const rank = new Map(order.map((symbol, index) => [symbol, index]));
  return [...quotes].sort((left, right) => (rank.get(left.symbol) ?? 999) - (rank.get(right.symbol) ?? 999));
}
