import {
  fetchBatchQuotesBySymbols,
  fetchBiggestGainers,
  fetchBiggestLosers,
  fetchMostActives,
  normalizeFmpMoverRow,
} from './fmp.js'

/** Default 2 min — premium tier allows frequent refresh; override with MARKET_DATA_CACHE_MS. */
const CACHE_TTL_MS =
  Number(process.env.MARKET_DATA_CACHE_MS) ||
  Number(process.env.ALPHA_VANTAGE_CACHE_MS) ||
  2 * 60_000

let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

function take20(rows) {
  return rows.slice(0, 20).map(normalizeFmpMoverRow).filter((r) => r.ticker)
}

function enrichWithQuotes(rows, quoteMap) {
  return rows.map((r) => {
    const q = quoteMap.get(r.ticker)
    return {
      ...r,
      volume: q?.volume != null && q.volume > 0 ? q.volume : r.volume,
      price: r.price ?? q?.price ?? null,
      change: r.change ?? q?.change ?? null,
      changePercent: r.changePercent ?? q?.changePercent ?? null,
    }
  })
}

/**
 * Top 20 gainers, losers, most active — FMP movers + batch quote for volume.
 */
export async function getMarketMovers() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const [gainersRaw, losersRaw, activesRaw] = await Promise.all([
    fetchBiggestGainers(),
    fetchBiggestLosers(),
    fetchMostActives(),
  ])

  let gainers = take20(Array.isArray(gainersRaw) ? gainersRaw : [])
  let losers = take20(Array.isArray(losersRaw) ? losersRaw : [])
  let mostActiveBase = take20(Array.isArray(activesRaw) ? activesRaw : [])

  const tickers = [
    ...new Set([...gainers, ...losers, ...mostActiveBase].map((r) => r.ticker).filter(Boolean)),
  ]
  const quoteMap = await fetchBatchQuotesBySymbols(tickers)
  gainers = enrichWithQuotes(gainers, quoteMap)
  losers = enrichWithQuotes(losers, quoteMap)
  mostActiveBase = enrichWithQuotes(mostActiveBase, quoteMap)

  const mostActive = mostActiveBase.map((r) => ({
    ticker: r.ticker,
    price: r.price,
    changePercent: r.changePercent,
    volume: r.volume,
    open: null,
    high: null,
    low: null,
    close: r.price,
  }))

  const value = {
    asOf: new Date().toISOString(),
    source: 'fmp',
    gainers,
    losers,
    mostActive,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }

  cache = { at: now(), value }
  return value
}
