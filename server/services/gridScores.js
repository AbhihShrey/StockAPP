import { fetchBatchQuotesBySymbols } from './fmp.js'

/** Must match `FIB_SCREENER_GRID` order in `client/src/lib/tradingViewSymbol.js`. */
export const FIB_GRID_TICKERS = [
  'AMZN',
  'NVDA',
  'UNH',
  'CSCO',
  'AMAT',
  'PLTR',
  'GOOGL',
  'LRCX',
  'COST',
  'GS',
  'AVGO',
  'C',
  'WMT',
  'WFC',
  'ACN',
]

const CACHE_TTL_MS =
  Number(process.env.MARKET_DATA_CACHE_MS) ||
  Number(process.env.ALPHA_VANTAGE_CACHE_MS) ||
  2 * 60_000

let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

/**
 * Live heuristic scores from change % (and movers cache stamp for `asOf`).
 * Rebalances with market — not static demo values.
 */
export async function getGridScores() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const map = await fetchBatchQuotesBySymbols(FIB_GRID_TICKERS)

  const n = FIB_GRID_TICKERS.length
  const ranked = FIB_GRID_TICKERS.map((ticker) => ({
    ticker,
    changePercent: map.get(ticker)?.changePercent ?? 0,
  })).sort((a, b) => b.changePercent - a.changePercent)

  const scoreByTicker = new Map(
    ranked.map((r, rank) => [
      r.ticker,
      n <= 1 ? 75 : Math.round(100 - (rank / (n - 1)) * 72),
    ]),
  )

  const rows = FIB_GRID_TICKERS.map((ticker) => {
    const q = map.get(ticker)
    return {
      ticker,
      score: scoreByTicker.get(ticker) ?? 50,
      changePercent: q?.changePercent ?? 0,
      price: q?.price ?? null,
    }
  })

  const value = {
    asOf: new Date().toISOString(),
    source: 'fmp',
    rows,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }
  cache = { at: now(), value }
  return value
}
