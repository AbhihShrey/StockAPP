import { fetchBatchQuotesBySymbols, fetchHistoricalEodLight } from './fmp.js'
import { SECTOR_ETFS } from './sectorQuadrant.js'

const CACHE_TTL_MS =
  Number(process.env.MARKET_DATA_CACHE_MS) ||
  Number(process.env.ALPHA_VANTAGE_CACHE_MS) ||
  2 * 60_000

let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(
    String(value)
      .replace(/[%,$\s]/g, '')
      .replace(/,/g, '')
      .trim(),
  )
  return Number.isFinite(n) ? n : null
}

function fiveTradingDayReturn(lightRows) {
  if (!Array.isArray(lightRows) || lightRows.length < 6) return null
  const latest = toNumber(lightRows[0]?.price)
  const prior = toNumber(lightRows[5]?.price)
  if (latest === null || prior === null || prior === 0) return null
  return ((latest / prior - 1) * 100)
}

/**
 * 1d vs 5d blend → min–max normalized strength 0–100 across the 11 SPDRs.
 */
export async function getDashboardSectors() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const symbols = SECTOR_ETFS.map((s) => s.symbol)
  const [quoteMap, ...lightSeries] = await Promise.all([
    fetchBatchQuotesBySymbols(symbols),
    ...symbols.map((sym) => fetchHistoricalEodLight(sym)),
  ])

  const rawRows = SECTOR_ETFS.map((meta, i) => {
    const q = quoteMap.get(meta.symbol)
    const d1 = q?.changePercent
    const d5 = fiveTradingDayReturn(lightSeries[i])
    const dailyAvg5 = d5 === null ? null : d5 / 5
    const excess = d1 === null || dailyAvg5 === null ? null : d1 - dailyAvg5
    let blend = null
    if (d1 !== null && excess !== null) blend = 0.58 * d1 + 0.42 * excess
    else if (d1 !== null) blend = d1
    return {
      symbol: meta.symbol,
      name: meta.name,
      changePercent1d: d1,
      changePercent5d: d5,
      strengthRaw: blend,
    }
  })

  const raws = rawRows
    .map((r) => r.strengthRaw)
    .filter((x) => x !== null && Number.isFinite(x))
  const minR = raws.length ? Math.min(...raws) : 0
  const maxR = raws.length ? Math.max(...raws) : 0
  const span = maxR - minR

  const rows = rawRows.map((r) => {
    let strengthScore = null
    if (r.strengthRaw !== null && Number.isFinite(r.strengthRaw)) {
      if (span <= 1e-9) strengthScore = 50
      else strengthScore = Math.round(((r.strengthRaw - minR) / span) * 1000) / 10
    }
    return {
      symbol: r.symbol,
      name: r.name,
      changePercent1d: r.changePercent1d,
      changePercent5d: r.changePercent5d,
      strengthScore,
    }
  })

  rows.sort((a, b) => {
    const sa = a.strengthScore
    const sb = b.strengthScore
    if (sa == null && sb == null) return a.symbol.localeCompare(b.symbol)
    if (sa == null) return 1
    if (sb == null) return -1
    if (sb !== sa) return sb - sa
    return a.symbol.localeCompare(b.symbol)
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
