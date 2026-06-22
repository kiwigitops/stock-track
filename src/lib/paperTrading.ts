import { normalizeSymbol } from "./format";
import type { StockQuote } from "../types";

export type PaperTradeSide = "buy" | "sell";

export type PaperTrade = {
  id: string;
  note: string;
  price: number;
  quantity: number;
  side: PaperTradeSide;
  symbol: string;
  timestamp: number;
};

export type PaperPosition = {
  averageCost: number;
  marketValue: number;
  quantity: number;
  quote?: StockQuote;
  symbol: string;
  unrealizedPnl: number;
};

export type PaperPortfolio = {
  cash: number;
  equity: number;
  marketValue: number;
  positions: PaperPosition[];
  realizedPnl: number;
  totalPnl: number;
  unrealizedPnl: number;
};

const DB_NAME = "stocktrack-paper";
const DB_VERSION = 1;
const STORE_NAME = "trades";
const FALLBACK_KEY = "stocktrack:paper-trades";

export function createPaperTrade(input: Omit<PaperTrade, "id" | "timestamp">): PaperTrade {
  return {
    ...input,
    id: crypto.randomUUID(),
    note: input.note.trim(),
    price: Math.max(0, input.price),
    quantity: Math.max(0, input.quantity),
    symbol: normalizeSymbol(input.symbol),
    timestamp: Date.now(),
  };
}

export function getPaperPortfolio(trades: PaperTrade[], quotes: StockQuote[], startingCash: number): PaperPortfolio {
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const states = new Map<string, { averageCost: number; quantity: number; realizedPnl: number }>();
  let cash = startingCash;

  [...trades]
    .sort((left, right) => left.timestamp - right.timestamp)
    .forEach((trade) => {
      const state = states.get(trade.symbol) ?? { averageCost: 0, quantity: 0, realizedPnl: 0 };
      const gross = trade.quantity * trade.price;

      if (trade.side === "buy") {
        const nextQuantity = state.quantity + trade.quantity;
        state.averageCost = nextQuantity ? (state.averageCost * state.quantity + gross) / nextQuantity : 0;
        state.quantity = nextQuantity;
        cash -= gross;
      } else {
        const sellQuantity = Math.min(trade.quantity, state.quantity);
        state.realizedPnl += sellQuantity * (trade.price - state.averageCost);
        state.quantity -= sellQuantity;
        if (state.quantity <= 0) state.averageCost = 0;
        cash += sellQuantity * trade.price;
      }

      states.set(trade.symbol, state);
    });

  const positions = Array.from(states.entries())
    .map(([symbol, state]) => {
      const quote = quoteMap.get(symbol);
      const currentPrice = quote?.price ?? state.averageCost;
      const marketValue = state.quantity * currentPrice;

      return {
        averageCost: state.averageCost,
        marketValue,
        quantity: state.quantity,
        quote,
        symbol,
        unrealizedPnl: state.quantity * (currentPrice - state.averageCost),
      };
    })
    .filter((position) => position.quantity > 0.000001);
  const marketValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const realizedPnl = Array.from(states.values()).reduce((sum, state) => sum + state.realizedPnl, 0);
  const unrealizedPnl = positions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const equity = cash + marketValue;

  return {
    cash,
    equity,
    marketValue,
    positions,
    realizedPnl,
    totalPnl: equity - startingCash,
    unrealizedPnl,
  };
}

export async function loadPaperTrades(): Promise<PaperTrade[]> {
  if (!("indexedDB" in window)) return readFallbackTrades();

  try {
    const db = await openDb();
    const trades = await requestToPromise<PaperTrade[]>(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll());
    const fallbackTrades = readFallbackTrades();
    db.close();
    return mergeTrades(trades, fallbackTrades).sort((left, right) => right.timestamp - left.timestamp);
  } catch {
    return readFallbackTrades();
  }
}

export async function savePaperTrade(trade: PaperTrade): Promise<void> {
  if (!("indexedDB" in window)) {
    writeFallbackTrades([trade, ...readFallbackTrades()]);
    return;
  }

  try {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    await requestToPromise(transaction.objectStore(STORE_NAME).put(trade));
    await transactionToPromise(transaction);
    db.close();
  } catch {
    writeFallbackTrades([trade, ...readFallbackTrades()]);
  }
}

function mergeTrades(left: PaperTrade[], right: PaperTrade[]) {
  const trades = new Map<string, PaperTrade>();
  [...left, ...right].forEach((trade) => trades.set(trade.id, trade));
  return Array.from(trades.values());
}

export async function clearPaperTrades(): Promise<void> {
  if ("indexedDB" in window) {
    try {
      const db = await openDb();
      await requestToPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear());
      db.close();
    } catch {
      window.localStorage.removeItem(FALLBACK_KEY);
    }
  }

  window.localStorage.removeItem(FALLBACK_KEY);
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T = unknown>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readFallbackTrades() {
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as PaperTrade[]) : [];
  } catch {
    return [];
  }
}

function writeFallbackTrades(trades: PaperTrade[]) {
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(trades));
  } catch {
    return;
  }
}
