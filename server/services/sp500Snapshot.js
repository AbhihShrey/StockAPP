import { fetchBatchQuotesBySymbols, fmpGet } from './fmp.js'

const CACHE_TTL_MS =
  Number(process.env.MARKET_DATA_CACHE_MS) ||
  Number(process.env.ALPHA_VANTAGE_CACHE_MS) ||
  2 * 60_000

let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

/**
 * @returns {Promise<string[]>}
 */
export async function fetchSp500Symbols() {
  const data = await fmpGet('/sp500-constituent')
  const arr = Array.isArray(data) ? data : []
  const symbols = arr
    .map((row) => String(row?.symbol ?? '')
      .trim()
      .toUpperCase())
    .filter(Boolean)
  return [...new Set(symbols)]
}

/**
 * Cached S&P 500 batch quotes (price, change %, 200-DMA, volume).
 * @returns {Promise<{ asOf: string, symbols: string[], quotes: Map<string, { volume: number|null, avgVolume: number|null, price: number|null, open: number|null, dayHigh: number|null, dayLow: number|null, previousClose: number|null, changePercent: number|null, change: number|null, priceAvg50: number|null, priceAvg200: number|null, yearHigh: number|null, yearLow: number|null }> }>}
 */
export async function getSp500QuoteSnapshot() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) {
    return { ...cache.value, cached: true }
  }

  const symbols = await fetchSp500Symbols()
  const quotes = await fetchBatchQuotesBySymbols(symbols)

  const value = {
    asOf: new Date().toISOString(),
    symbols,
    quotes,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }
  cache = { at: now(), value }
  return value
}
