import { getMarketMovers } from './marketMovers.js'

/**
 * Dashboard: derived from the same cached `getMarketMovers()` snapshot (no second cache layer).
 */
export async function getMarketSummary() {
  const movers = await getMarketMovers()

  const topStocks = movers.mostActive.map((r) => ({
    symbol: r.ticker,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close ?? r.price,
    volume: r.volume,
    change: null,
    changePercent: r.changePercent,
  }))

  const topGainers = movers.gainers.map((r) => ({
    symbol: r.ticker,
    price: r.price,
    change: r.change,
    changePercent: r.changePercent,
    volume: r.volume,
  }))

  const topLosers = movers.losers.map((r) => ({
    symbol: r.ticker,
    price: r.price,
    change: r.change,
    changePercent: r.changePercent,
    volume: r.volume,
  }))

  return {
    asOf: movers.asOf,
    topStocks,
    gainers: topGainers,
    losers: topLosers,
    source: movers.source,
    cached: movers.cached,
    refreshIntervalMs: movers.refreshIntervalMs,
  }
}
