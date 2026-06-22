import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Briefcase, ChartLine, Plus, ReceiptText, RotateCcw, Trash2, Wallet } from "lucide-react";
import { formatCompact, formatDateTime, formatMoney, formatPercent, formatPrice, normalizeSymbol } from "../lib/format";
import { createPaperTrade, getPaperPortfolio, type PaperPosition, type PaperTradeSide } from "../lib/paperTrading";
import { usePaperTrades } from "../hooks/usePaperTrades";
import type { StockQuote } from "../types";
import { InfoTip } from "./InfoTip";

type PaperTradeDeskProps = {
  cash: number;
  onCashChange: (cash: number) => void;
  onOpenQuote: (quote: StockQuote) => void;
  quotes: StockQuote[];
};

export function PaperTradeDesk({ cash, onCashChange, onOpenQuote, quotes }: PaperTradeDeskProps) {
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
  const selectedQuote = quote ?? quotes[0];
  const selectedSymbol = selectedQuote?.symbol ?? normalizeSymbol(symbol);
  const selectedName = selectedQuote?.name ?? "Saved symbol";
  const selectedPrice = selectedQuote?.price ?? price;
  const selectedMove = selectedQuote?.changePercent ?? 0;
  const orderNotional = quantity * price;
  const orderImpact = side === "buy" ? -orderNotional : orderNotional;
  const currentReturn = getPositionReturn(currentPosition);

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

  function openQuoteForSymbol(targetSymbol = selectedSymbol) {
    const targetQuote = quoteMap.get(normalizeSymbol(targetSymbol));
    if (targetQuote) onOpenQuote(targetQuote);
  }

  return (
    <section className="paper-desk" aria-label="Paper trading simulation">
      <section className="paper-command" aria-label="Paper account command center">
        <div>
          <span className="tiny-label">Paper Simulator</span>
          <h2>Broker Ledger</h2>
        </div>
        <div className="paper-command-stats">
          <span className="paper-chip">
            <Wallet size={15} />
            {formatMoney(portfolio.cash)}
          </span>
          <span className="paper-chip">
            <Briefcase size={15} />
            {portfolio.positions.length} holdings
          </span>
          <span className="paper-chip">
            <ReceiptText size={15} />
            {trades.length} fills
          </span>
        </div>
      </section>

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
        <PaperMetric detail="Cash after simulated buys and sells." label="Buying power" value={formatMoney(portfolio.cash)} />
        <PaperMetric detail="Current marked-to-market value of open paper positions." label="Exposure" value={formatMoney(portfolio.marketValue)} />
        <PaperMetric
          detail="Cash plus open paper position market value."
          label="Equity"
          tone={portfolio.totalPnl >= 0 ? "positive" : "negative"}
          value={formatMoney(portfolio.equity)}
        />
        <PaperMetric
          detail="Open-position P/L marked against the latest delayed quotes."
          label="Unrealized P/L"
          tone={portfolio.unrealizedPnl >= 0 ? "positive" : "negative"}
          value={formatMoney(portfolio.unrealizedPnl)}
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
          <div className="ticket-head">
            <div className="paper-quote-lockup">
              <span>
                Active Symbol
                <InfoTip text="This is the symbol your paper order will use. Changing it also refreshes the working limit price from the delayed quote." />
              </span>
              <strong>{selectedSymbol || "No Symbol"}</strong>
              <em>{selectedName}</em>
            </div>
            <button
              className="open-stock-button"
              disabled={!selectedQuote}
              onClick={() => openQuoteForSymbol()}
              title={selectedQuote ? `Open ${selectedSymbol} stock window` : "No quote available"}
              type="button"
            >
              <ChartLine size={16} />
              Open stock
            </button>
          </div>

          <div className="quote-tape" aria-label="Selected paper symbol quote">
            <div title="Latest delayed quote used to prefill the order price.">
              <span>Last</span>
              <strong>{formatPrice(selectedPrice)}</strong>
            </div>
            <div title="Current delayed session move for the selected symbol.">
              <span>Day</span>
              <strong className={selectedMove >= 0 ? "up" : "down"}>{formatPercent(selectedMove, true)}</strong>
            </div>
            <div title="Current paper shares held for this symbol.">
              <span>Holding</span>
              <strong>{currentPosition ? `${formatCompact(currentPosition.quantity, 4)} sh` : "Flat"}</strong>
            </div>
            <div title="Unrealized paper profit and loss for this symbol.">
              <span>U P/L</span>
              <strong className={(currentPosition?.unrealizedPnl ?? 0) >= 0 ? "up" : "down"}>{formatMoney(currentPosition?.unrealizedPnl ?? 0)}</strong>
            </div>
          </div>

          <label>
            <span>
              Symbol
              <InfoTip text="Choose the quote attached to this simulated fill. The order will be recorded locally under this ticker." />
            </span>
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

          <div className="ticket-grid">
            <label>
              <span>
                Quantity
                <InfoTip text="Share count for the simulated fill. Fractional shares are supported for paper scenarios." />
              </span>
              <input min="0" onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))} step="0.0001" type="number" value={quantity} />
            </label>
            <label>
              <span>
                Price
                <InfoTip text="Working paper price for the simulated fill. It starts from the delayed quote but can be edited to model limit fills." />
              </span>
              <input min="0" onChange={(event) => setPrice(Math.max(0, Number(event.target.value) || 0))} step="0.01" type="number" value={price} />
            </label>
          </div>

          <label>
            <span>
              Note
              <InfoTip text="Optional local thesis text. It stays in this browser with the paper-trade ledger." />
            </span>
            <input onChange={(event) => setNote(event.target.value)} placeholder="optional thesis" value={note} />
          </label>

          <div className="ticket-preview" aria-label="Paper order preview">
            <div>
              <span>
                Notional
                <InfoTip text="Quantity multiplied by the working paper price." />
              </span>
              <strong>{formatMoney(orderNotional)}</strong>
            </div>
            <div>
              <span>
                Cash impact
                <InfoTip text="Estimated cash movement if this paper fill is recorded. Buys reduce cash; sells add cash." />
              </span>
              <strong className={orderImpact >= 0 ? "up" : "down"}>{formatMoney(orderImpact)}</strong>
            </div>
            <div>
              <span>
                Position return
                <InfoTip text="Unrealized return for the currently selected paper holding, based on average cost and latest delayed quote." />
              </span>
              <strong className={currentReturn >= 0 ? "up" : "down"}>{formatPercent(currentReturn, true)}</strong>
            </div>
          </div>

          {error ? <strong className="ticket-error">{error}</strong> : null}
          <button className="trade-submit" type="submit">
            <Plus size={17} />
            Record fill
          </button>
        </form>

        <div className="positions-panel">
          <div className="panel-heading">
            <span>
              Positions
              <InfoTip text="Open paper holdings marked to the latest delayed quote. Each card can open the full stock window." />
            </span>
            <button className="reset-button" disabled={loading || !trades.length} onClick={resetTrades} type="button">
              <Trash2 size={15} />
              Reset
            </button>
          </div>
          {portfolio.positions.length ? (
            <div className="positions-grid">
              {portfolio.positions.map((position) => {
                const positionQuote = quoteMap.get(position.symbol);
                const positionReturn = getPositionReturn(position);

                return (
                  <article className="position-card" key={position.symbol}>
                    <div>
                      <div>
                        <strong>{position.symbol}</strong>
                        <span>{position.quote?.name ?? "Saved symbol"}</span>
                      </div>
                      <button
                        className="position-open-button"
                        disabled={!positionQuote}
                        onClick={() => openQuoteForSymbol(position.symbol)}
                        title={positionQuote ? `Open ${position.symbol} stock window` : "No quote available for this saved symbol"}
                        type="button"
                      >
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                    <em className={position.unrealizedPnl >= 0 ? "up" : "down"}>{formatMoney(position.unrealizedPnl)}</em>
                    <dl>
                      <div title="Open paper share quantity.">
                        <dt>Qty</dt>
                        <dd>{formatCompact(position.quantity, 4)}</dd>
                      </div>
                      <div title="Average paper cost after all local buys and sells.">
                        <dt>Avg</dt>
                        <dd>{formatPrice(position.averageCost)}</dd>
                      </div>
                      <div title="Current delayed mark value for this paper position.">
                        <dt>Value</dt>
                        <dd>{formatMoney(position.marketValue)}</dd>
                      </div>
                      <div title="Unrealized return versus average paper cost.">
                        <dt>Return</dt>
                        <dd className={positionReturn >= 0 ? "up" : "down"}>{formatPercent(positionReturn, true)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
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
          <span>
            Ledger
            <InfoTip text="The ledger is event-sourced: positions, cash, realized P/L, and equity are recalculated from this saved trade list." />
          </span>
          <span className="ledger-count">{trades.length} events</span>
        </div>
        {trades.length ? (
          <div className="ledger-table">
            <div className="ledger-head" aria-hidden="true">
              <span>Time</span>
              <span>Symbol</span>
              <span>Side</span>
              <span>Qty</span>
              <span>Price</span>
              <span>Notional</span>
              <span>Note</span>
            </div>
            {trades.slice(0, 18).map((trade) => {
              const tradeQuote = quoteMap.get(trade.symbol);

              return (
                <div className="ledger-row" key={trade.id}>
                  <span title="Local timestamp for this saved paper fill.">{formatDateTime(trade.timestamp)}</span>
                  <button
                    className="ledger-symbol-button"
                    disabled={!tradeQuote}
                    onClick={() => openQuoteForSymbol(trade.symbol)}
                    title={tradeQuote ? `Open ${trade.symbol} stock window` : "No quote available for this saved symbol"}
                    type="button"
                  >
                    <strong>{trade.symbol}</strong>
                    <ArrowUpRight size={13} />
                  </button>
                  <em className={trade.side === "buy" ? "up" : "down"} title="Saved paper trade side.">
                    {trade.side}
                  </em>
                  <span title="Saved simulated share count.">{formatCompact(trade.quantity, 4)} sh</span>
                  <span title="Saved simulated fill price.">{formatPrice(trade.price)}</span>
                  <span title="Quantity multiplied by saved fill price.">{formatMoney(trade.quantity * trade.price)}</span>
                  <span title={trade.note || "No note saved."}>{trade.note || "—"}</span>
                </div>
              );
            })}
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

function getPositionReturn(position?: PaperPosition) {
  if (!position?.averageCost || !position.quantity) return 0;
  return position.unrealizedPnl / (position.averageCost * position.quantity);
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
