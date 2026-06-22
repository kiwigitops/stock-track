import { ChevronRight, Star } from "lucide-react";
import { formatCompact, formatMoney, formatPercent, formatPrice, formatShares, venueName } from "../lib/format";
import type { ChartRangeKey, StockQuote } from "../types";
import { MiniSpark } from "./MiniSpark";

type QuoteCardProps = {
  cash: number;
  chartRange: ChartRangeKey;
  isFavorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
  quote: StockQuote;
};

export function QuoteCard({ cash, chartRange, isFavorite, onFavorite, onOpen, quote }: QuoteCardProps) {
  const isDown = quote.change < 0;
  const shares = quote.price ? cash / quote.price : 0;

  return (
    <article className="quote-card">
      <button className="favorite-chip" onClick={onFavorite} title={isFavorite ? "Unfavorite" : "Favorite"}>
        <Star size={15} fill={isFavorite ? "currentColor" : "none"} />
      </button>

      <button className="quote-open" onClick={onOpen} title={`Open ${quote.symbol} expanded chart view`}>
        <span className="card-region">{venueName(quote.exchange)}</span>
        <div className="symbol-line">
          <strong>{quote.symbol}</strong>
          <em className={isDown ? "down" : "up"}>{formatPercent(quote.changePercent, true)}</em>
        </div>
        <span className="currency-name">{quote.name}</span>

        <MiniSpark candles={quote.candles} currency={quote.currency} range={chartRange} symbol={quote.symbol} />

        <div className="card-price">
          <strong>{formatPrice(quote.price, quote.currency)}</strong>
          <span>
            {formatMoney(cash, quote.currency)} buys {formatShares(shares)} · Vol {formatCompact(quote.volume, 1)}
          </span>
        </div>

        <ChevronRight className="chevron" size={17} />
      </button>
    </article>
  );
}
