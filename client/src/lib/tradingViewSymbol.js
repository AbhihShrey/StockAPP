/** Map common tickers to exchanges for TradingView `EXCHANGE:SYMBOL` format. */
const EXCHANGE_BY_TICKER = {
  SPY: 'AMEX',
  VOO: 'AMEX',
  IWM: 'AMEX',
  DIA: 'AMEX',
  GLD: 'AMEX',
  SLV: 'AMEX',
  USO: 'AMEX',
  TLT: 'NASDAQ',
  HYG: 'AMEX',
  LQD: 'AMEX',
  JPM: 'NYSE',
  BAC: 'NYSE',
  XOM: 'NYSE',
  JNJ: 'NYSE',
  UNH: 'NYSE',
  V: 'NYSE',
  MA: 'NYSE',
  WMT: 'NYSE',
  PG: 'NYSE',
  HD: 'NYSE',
  DIS: 'NYSE',
  KO: 'NYSE',
  PFE: 'NYSE',
  'BRK.B': 'NYSE',
  BRK_B: 'NYSE',
  CSCO: 'NASDAQ',
  AMAT: 'NASDAQ',
  PLTR: 'NASDAQ',
  LRCX: 'NASDAQ',
  COST: 'NASDAQ',
  GS: 'NYSE',
  AVGO: 'NASDAQ',
  C: 'NYSE',
  WFC: 'NYSE',
  ACN: 'NYSE',
  AMZN: 'NASDAQ',
  NVDA: 'NASDAQ',
  GOOGL: 'NASDAQ',
}

/**
 * @param {string} raw - e.g. "AAPL", "brk.b", "NASDAQ:AMD"
 * @returns {string} e.g. "NASDAQ:AAPL"
 */
export function toTradingViewSymbol(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  if (!s) return 'NASDAQ:AAPL'
  if (s.includes(':')) return s
  const base = s.replace(/\./g, '_')
  const exchange = EXCHANGE_BY_TICKER[s] ?? EXCHANGE_BY_TICKER[base] ?? 'NASDAQ'
  const symbolPart = s.replace(/_/g, '.')
  return `${exchange}:${symbolPart}`
}

/** MAG7 + liquid mega-cap tech / names often shown together */
export const MAG7_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA']

/** Broad market & popular names for the overview grid */
export const OVERVIEW_TICKERS = ['SPY', 'QQQ', 'AMD', 'JPM', 'AVGO', 'COST', 'NFLX', 'COIN']

/**
 * Default Fib-screener-style grid tickers (layout reference).
 * Scores come from `GET /api/grid-scores` (relative to peers from live quotes).
 */
export const FIB_SCREENER_GRID = [
  { ticker: 'AMZN' },
  { ticker: 'NVDA' },
  { ticker: 'UNH' },
  { ticker: 'CSCO' },
  { ticker: 'AMAT' },
  { ticker: 'PLTR' },
  { ticker: 'GOOGL' },
  { ticker: 'LRCX' },
  { ticker: 'COST' },
  { ticker: 'GS' },
  { ticker: 'AVGO' },
  { ticker: 'C' },
  { ticker: 'WMT' },
  { ticker: 'WFC' },
  { ticker: 'ACN' },
]
