import { FormEvent, useMemo, useState } from "react";
import { Gauge, LoaderCircle, Plus, RefreshCcw, Search, Star } from "lucide-react";
import MarketScene from "./MarketScene";
import { FocusStage } from "./components/FocusStage";
import { PaperTradeDesk } from "./components/PaperTradeDesk";
import { QuoteCard } from "./components/QuoteCard";
import { QuoteModal } from "./components/QuoteModal";
import { usePersistentState } from "./hooks/usePersistentState";
import { useStocks } from "./hooks/useStocks";
import { CASH_KEY, DEFAULT_CASH, FAVORITES_KEY, SYMBOLS_KEY, WATCHLIST } from "./lib/constants";
import { normalizeSymbol } from "./lib/format";
import type { StockQuote } from "./types";

export default function App() {
  const [cash, setCash] = usePersistentState(CASH_KEY, DEFAULT_CASH);
  const [favorites, setFavorites] = usePersistentState<string[]>(FAVORITES_KEY, ["AAPL", "NVDA", "MSFT", "SPY"]);
  const [customSymbols, setCustomSymbols] = usePersistentState<string[]>(SYMBOLS_KEY, []);
  const [query, setQuery] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [selected, setSelected] = useState<StockQuote | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [activeView, setActiveView] = useState<"market" | "paper">("market");

  const symbols = useMemo(() => {
    return Array.from(new Set([...favorites, ...WATCHLIST, ...customSymbols].map(normalizeSymbol).filter(Boolean)));
  }, [customSymbols, favorites]);
  const { error, loading, quotes, refresh, refreshing, stale } = useStocks(symbols);

  const orderedQuotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const favoriteRank = new Map(favorites.map((symbol, index) => [symbol, index]));
    const watchRank = new Map(WATCHLIST.map((symbol, index) => [symbol, index]));

    return [...quotes]
      .sort((left, right) => {
        const leftFavorite = favoriteRank.has(left.symbol);
        const rightFavorite = favoriteRank.has(right.symbol);
        if (leftFavorite !== rightFavorite) return leftFavorite ? -1 : 1;
        if (leftFavorite && rightFavorite) return (favoriteRank.get(left.symbol) ?? 0) - (favoriteRank.get(right.symbol) ?? 0);
        return (watchRank.get(left.symbol) ?? 999) - (watchRank.get(right.symbol) ?? 999);
      })
      .filter((quote) => {
        if (onlyFavorites && !favorites.includes(quote.symbol)) return false;
        if (!needle) return true;
        return quote.symbol.toLowerCase().includes(needle) || quote.name.toLowerCase().includes(needle);
      });
  }, [favorites, onlyFavorites, query, quotes]);

  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);
  const headline = orderedQuotes[0];
  const focusQuotes = orderedQuotes.slice(0, 6);
  const marketPulse = useMemo(() => {
    if (!orderedQuotes.length) return 0.5;
    return orderedQuotes.slice(0, 12).reduce((sum, quote) => sum + Math.abs(quote.changePercent * 100), 0) / Math.min(12, orderedQuotes.length);
  }, [orderedQuotes]);
  const feedClass = stale ? "feed-pill stale" : refreshing ? "feed-pill syncing" : "feed-pill live";
  const feedLabel = stale ? "Cached" : refreshing ? "Syncing" : "Live";

  function toggleFavorite(symbol: string) {
    setFavorites((current) => (current.includes(symbol) ? current.filter((item) => item !== symbol) : [symbol, ...current]));
  }

  function addSymbol(event: FormEvent) {
    event.preventDefault();
    const symbol = normalizeSymbol(newSymbol);
    if (!symbol) return;
    setCustomSymbols((current) => (current.includes(symbol) ? current : [symbol, ...current]));
    setNewSymbol("");
  }

  return (
    <main className="terminal">
      <MarketScene intensity={marketPulse} isReverse={headline ? headline.change < 0 : false} />
      <div className="screen-vignette" />

      <section className="app-frame">
        <header className="hero">
          <nav className="top-nav">
            <div>
              <span className="tiny-label">Market Watch</span>
              <h1>Stock Track</h1>
            </div>
            <div className="feed-controls">
              <div className={feedClass} title={error || "Delayed market feed"}>
                <span />
                <strong>{feedLabel}</strong>
              </div>
              <button className="glass-icon" disabled={refreshing} onClick={refresh} title="Refresh stocks">
                <RefreshCcw className={refreshing ? "spin" : ""} size={18} />
              </button>
            </div>
          </nav>

          <FocusStage cash={cash} headline={headline} onOpen={setSelected} quotes={focusQuotes} />
        </header>

        <div className="app-tabs" aria-label="Workspace views">
          <button className={activeView === "market" ? "active" : ""} onClick={() => setActiveView("market")}>
            Market
          </button>
          <button className={activeView === "paper" ? "active" : ""} onClick={() => setActiveView("paper")}>
            Paper
          </button>
        </div>

        {activeView === "market" ? (
          <section className="quote-controls stock-controls" aria-label="Stock controls">
            <label>
              <span>Cash</span>
              <input
                inputMode="decimal"
                min="0"
                onChange={(event) => setCash(Math.max(0, Number(event.target.value) || 0))}
                type="number"
                value={cash}
              />
            </label>

            <form className="add-symbol" onSubmit={addSymbol}>
              <label>
                <span>Add symbol</span>
                <div>
                  <Plus size={16} />
                  <input
                    autoCapitalize="characters"
                    onChange={(event) => setNewSymbol(event.target.value.toUpperCase())}
                    placeholder="AAPL"
                    value={newSymbol}
                  />
                </div>
              </label>
            </form>

            <label className="search-field">
              <span>Search</span>
              <div>
                <Search size={16} />
                <input onChange={(event) => setQuery(event.target.value)} placeholder="Search symbol" type="search" value={query} />
              </div>
            </label>

            <button className={onlyFavorites ? "pill-button active" : "pill-button"} onClick={() => setOnlyFavorites((value) => !value)}>
              <Star size={16} />
              Favorites
            </button>
          </section>
        ) : null}

        {error ? (
          <section className="market-state" role="alert">
            <Gauge size={22} />
            <strong>{quotes.length ? "Using cached symbols" : "Feed paused"}</strong>
            <span>{error}</span>
          </section>
        ) : null}

        {activeView === "paper" ? (
          <PaperTradeDesk cash={cash} onCashChange={setCash} quotes={quotes} />
        ) : loading && !quotes.length ? (
          <section className="market-state large">
            <LoaderCircle className="spin" size={26} />
            <strong>Opening market</strong>
            <span>Pulling delayed stock quotes</span>
          </section>
        ) : (
          <section className="watch-grid" aria-label="Stock cards">
            {orderedQuotes.map((quote) => (
              <QuoteCard
                cash={cash}
                isFavorite={favoritesSet.has(quote.symbol)}
                key={quote.symbol}
                onFavorite={() => toggleFavorite(quote.symbol)}
                onOpen={() => setSelected(quote)}
                quote={quote}
              />
            ))}
          </section>
        )}

        {!loading && quotes.length > 0 && !orderedQuotes.length ? (
          <section className="market-state">
            <Search size={22} />
            <strong>No symbols found</strong>
            <span>Clear the search or favorites filter.</span>
          </section>
        ) : null}
      </section>

      {selected ? (
        <QuoteModal
          cash={cash}
          isFavorite={favoritesSet.has(selected.symbol)}
          onClose={() => setSelected(null)}
          onFavorite={() => toggleFavorite(selected.symbol)}
          quote={selected}
        />
      ) : null}
    </main>
  );
}
