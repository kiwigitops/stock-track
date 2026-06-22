import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { formatCompact, formatDateTime, formatMoney, formatPercent, formatPrice, normalizeSymbol } from "../lib/format";
import { createPaperTrade, getPaperPortfolio, type PaperTradeSide } from "../lib/paperTrading";
import { usePaperTrades } from "../hooks/usePaperTrades";
import type { StockQuote } from "../types";
import { InfoTip } from "./InfoTip";

type PaperTradeDeskProps = {
  cash: number;
  onCashChange: (cash: number) => void;
  quotes: StockQuote[];
};

export function PaperTradeDesk({ cash, onCashChange, quotes }: PaperTradeDeskProps) {
  const { addTrade, loading, resetTrades, trades } = usePaperTrades();
  const [symbol, setSymbol] = useState(() => quotes[0]?.symbol ?? "AAPL");
  const [side, setSide] = useState<PaperTradeSide>("buy");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(() => quotes[0]?.price ?? 0);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const quoteMap = useMemo(() => new Map(quotes.map((quote) => [quote.symbol, quote])), [quotes]);
  const quote = quoteMap.get(symbol);
  const portfolio = useMemo(() => getPaperPortfolio(trades, quotes, cash), [cash, quotes, trades]);
  const currentPosition = portfolio.positions.find((position) => position.symbol === symbol);

  useEffect(() => {
    if (quote) setPrice(roundMoney(quote.price));
  }, [quote]);

  useEffect(() => {
    if (!symbol && quotes[0]) setSymbol(quotes[0].symbol);
  }, [quotes, symbol]);

  async function submitTrade(event: FormEvent) {
    event.preventDefault();
    const cleanSymbol = normalizeSymbol(symbol);
    const cleanQuantity = Math.max(0, quantity);
    const cleanPrice = Math.max(0, price);

    if (!cleanSymbol || !cleanQuantity || !cleanPrice) {
      setError("Enter a symbol, quantity, and price.");
      return;
    }

    if (side === "sell" && cleanQuantity > (currentPosition?.quantity ?? 0)) {
      setError("Sell size is larger than the current paper position.");
      return;
    }

    await addTrade(
      createPaperTrade({
        note,
        price: cleanPrice,
        quantity: cleanQuantity,
        side,
        symbol: cleanSymbol,
      }),
    );
    setError("");
    setNote("");
  }

  return (
    <section className="paper-desk" aria-label="Paper trading simulation">
      <div className="paper-summary">
        <PaperMetric
          detail="Starting paper capital. It shares the app's cash amount so the watch cards and simulator use the same baseline."
          label="Starting cash"
          value={
            <input
              inputMode="decimal"
              min="0"
              onChange={(event) => onCashChange(Math.max(0, Number(event.target.value) || 0))}
              type="number"
              value={cash}
            />
          }
        />
        <PaperMetric detail="Cash after simulated buys and sells." label="Cash left" value={formatMoney(portfolio.cash)} />
        <PaperMetric detail="Current marked-to-market value of open paper positions." label="Market value" value={formatMoney(portfolio.marketValue)} />
        <PaperMetric
          detail="Cash plus open paper position market value."
          label="Equity"
          tone={portfolio.totalPnl >= 0 ? "positive" : "negative"}
          value={formatMoney(portfolio.equity)}
        />
        <PaperMetric
          detail="Equity minus starting cash, including realized and unrealized paper P/L."
          label="Total P/L"
          tone={portfolio.totalPnl >= 0 ? "positive" : "negative"}
          value={formatMoney(portfolio.totalPnl)}
        />
      </div>

      <div className="paper-layout">
        <form className="paper-ticket" onSubmit={submitTrade}>
          <div className="panel-heading">
            <span>Trade ticket</span>
            <InfoTip text="Paper trades are saved locally in IndexedDB. They do not place real orders and never leave your browser." />
          </div>
          <label>
            <span>Symbol</span>
            <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
              {quotes.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} - {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="side-switch" aria-label="Trade side">
            <button className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")} type="button">
              Buy
            </button>
            <button className={side === "sell" ? "active" : ""} onClick={() => setSide("sell")} type="button">
              Sell
            </button>
          </div>
          <label>
            <span>Quantity</span>
            <input min="0" onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))} step="0.0001" type="number" value={quantity} />
          </label>
          <label>
            <span>Price</span>
            <input min="0" onChange={(event) => setPrice(Math.max(0, Number(event.target.value) || 0))} step="0.01" type="number" value={price} />
          </label>
          <label>
            <span>Note</span>
            <input onChange={(event) => setNote(event.target.value)} placeholder="optional thesis" value={note} />
          </label>
          {error ? <strong className="ticket-error">{error}</strong> : null}
          <button className="trade-submit" type="submit">
            <Plus size={17} />
            Record paper trade
          </button>
        </form>

        <div className="positions-panel">
          <div className="panel-heading">
            <span>Positions</span>
            <button className="reset-button" disabled={loading || !trades.length} onClick={resetTrades} type="button">
              <Trash2 size={15} />
              Reset
            </button>
          </div>
          {portfolio.positions.length ? (
            <div className="positions-grid">
              {portfolio.positions.map((position) => (
                <article className="position-card" key={position.symbol}>
                  <div>
                    <strong>{position.symbol}</strong>
                    <span>{position.quote?.name ?? "Saved symbol"}</span>
                  </div>
                  <em className={position.unrealizedPnl >= 0 ? "up" : "down"}>{formatMoney(position.unrealizedPnl)}</em>
                  <dl>
                    <div>
                      <dt>Qty</dt>
                      <dd>{formatCompact(position.quantity, 4)}</dd>
                    </div>
                    <div>
                      <dt>Avg</dt>
                      <dd>{formatPrice(position.averageCost)}</dd>
                    </div>
                    <div>
                      <dt>Value</dt>
                      <dd>{formatMoney(position.marketValue)}</dd>
                    </div>
                    <div>
                      <dt>Return</dt>
                      <dd>{formatPercent(position.averageCost ? position.unrealizedPnl / (position.averageCost * position.quantity) : 0, true)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="paper-empty">
              <RotateCcw size={22} />
              <strong>No paper positions</strong>
              <span>Record a buy trade to start a local simulation.</span>
            </div>
          )}
        </div>
      </div>

      <section className="trade-ledger">
        <div className="panel-heading">
          <span>Ledger</span>
          <InfoTip text="The ledger is event-sourced: positions, cash, realized P/L, and equity are recalculated from this saved trade list." />
        </div>
        {trades.length ? (
          <div className="ledger-table">
            {trades.slice(0, 18).map((trade) => (
              <div className="ledger-row" key={trade.id}>
                <span>{formatDateTime(trade.timestamp)}</span>
                <strong>{trade.symbol}</strong>
                <em className={trade.side === "buy" ? "up" : "down"}>{trade.side}</em>
                <span>{formatCompact(trade.quantity, 4)} sh</span>
                <span>{formatPrice(trade.price)}</span>
                <span>{trade.note || "—"}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="paper-empty compact">
            <span>No saved trades yet.</span>
          </div>
        )}
      </section>
    </section>
  );
}

function PaperMetric({
  detail,
  label,
  tone = "",
  value,
}: {
  detail: string;
  label: string;
  tone?: "positive" | "negative" | "";
  value: ReactNode;
}) {
  return (
    <div className={tone ? `paper-metric ${tone}` : "paper-metric"}>
      <span>
        {label}
        <InfoTip text={detail} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
