import { getSp500QuoteSnapshot } from './sp500Snapshot.js'

const CACHE_TTL_MS = 60_000
let cache = { at: 0, value: null }

function now() { return Date.now() }

/**
 * Heatmap rows for the markets page.
 * Returns liquid stocks with valid prices, sized by abs(changePercent).
 * Limited to keep the treemap readable.
 */
export async function getMarketHeatmap({ limit = 120 } = {}) {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const snap = await getSp500QuoteSnapshot()
  const rows = []
  for (const sym of snap.symbols) {
    const q = snap.quotes.get(sym)
    if (!q) continue
    if (q.changePercent == null || !Number.isFinite(q.changePercent)) continue
    if (q.price == null) continue
    rows.push({
      symbol: sym,
      price: q.price,
      changePercent: q.changePercent,
      volume: q.volume ?? null,
    })
  }

  // Top N by |changePercent| so the user sees the most meaningful movers.
  rows.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
  const limited = rows.slice(0, Math.max(20, Math.min(500, Number(limit) || 120)))

  const value = {
    asOf: snap.asOf,
    source: 'fmp',
    rows: limited,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }
  cache = { at: now(), value }
  return value
}
