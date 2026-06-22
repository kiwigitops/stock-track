import { LoaderCircle } from "lucide-react";
import { formatDateTime, formatMoney, formatPercent, formatPrice, formatShares, venueName } from "../lib/format";
import type { ChartRangeKey, StockQuote } from "../types";
import { MiniSpark } from "./MiniSpark";

type FocusStageProps = {
  cash: number;
  chartRange: ChartRangeKey;
  headline?: StockQuote;
  onOpen: (quote: StockQuote) => void;
  quotes: StockQuote[];
};

export function FocusStage({ cash, chartRange, headline, onOpen, quotes }: FocusStageProps) {
  if (!headline) {
    return (
      <section className="focus-stage">
        <div className="focus-panel empty">
          <LoaderCircle className="spin" size={22} />
          <strong>Opening market</strong>
        </div>
      </section>
    );
  }

  const shares = headline.price ? cash / headline.price : 0;

  return (
    <section className="focus-stage" aria-label="Focused stock market">
      <button aria-label={`Open ${headline.symbol} expanded chart view`} className="focus-panel" onClick={() => onOpen(headline)}>
        <div className="focus-kicker">
          <span>{venueName(headline.exchange)}</span>
          <em className={headline.change < 0 ? "down" : "up"}>{formatPercent(headline.changePercent, true)}</em>
        </div>
        <strong className="focus-symbol">{headline.symbol}</strong>
        <span className="focus-name">{headline.name}</span>
        <MiniSpark candles={headline.candles} currency={headline.currency} range={chartRange} symbol={headline.symbol} variant="focus" />
        <div className="focus-bottom">
          <div>
            <span>{formatMoney(cash, headline.currency)} allocation</span>
            <strong>{formatShares(shares)}</strong>
          </div>
          <div>
            <span>Last price</span>
            <strong>{formatPrice(headline.price, headline.currency)}</strong>
          </div>
        </div>
      </button>

      <aside className="focus-rail" aria-label="Top watchlist">
        <div className="rail-head">
          <span>Watchlist</span>
          <strong>{formatDateTime(headline.updatedAt)}</strong>
        </div>
        {quotes.map((quote) => (
          <button aria-label={`Open ${quote.symbol} expanded chart view`} key={quote.symbol} onClick={() => onOpen(quote)}>
            <div>
              <strong>{quote.symbol}</strong>
              <span>{quote.name}</span>
            </div>
            <div>
              <strong>{formatPrice(quote.price, quote.currency)}</strong>
              <em className={quote.change < 0 ? "down" : "up"}>{formatPercent(quote.changePercent, true)}</em>
            </div>
          </button>
        ))}
      </aside>
    </section>
  );
}
