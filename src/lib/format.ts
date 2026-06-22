export function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

export function formatMoney(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      currency,
      maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
      style: "currency",
    }).format(value);
  } catch {
    return `${formatCompact(value)} ${currency}`;
  }
}

export function formatPrice(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      currency,
      maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 4,
      minimumFractionDigits: Math.abs(value) >= 100 ? 2 : 2,
      style: "currency",
    }).format(value);
  } catch {
    return formatCompact(value, 4);
  }
}

export function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 100) return formatCompact(value, 2);
  if (Math.abs(value) >= 1) return formatCompact(value, 4);

  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 5 }).format(value);
}

export function formatCompact(value: number, digits = 2) {
  const minimumFractionDigits = Math.min(digits, Math.abs(value) < 10 && value !== 0 ? 2 : 0);

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits,
    notation: Math.abs(value) >= 1000000 ? "compact" : "standard",
  }).format(value);
}

export function formatShares(value: number) {
  if (!Number.isFinite(value)) return "0 shares";
  return `${formatCompact(value, value >= 10 ? 2 : 4)} shares`;
}

export function formatDateTime(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ? String(value) : "Pending";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatPercent(value: number, showSign = false) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: showSign ? "always" : "auto",
    style: "percent",
  }).format(value);
}

export function venueName(exchange: string) {
  if (!exchange) return "Market";
  if (exchange === "NMS") return "Nasdaq";
  if (exchange === "NYQ") return "NYSE";
  if (exchange === "PCX") return "NYSE Arca";
  return exchange;
}
