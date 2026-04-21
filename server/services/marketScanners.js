import {
  fetchBatchQuotesBySymbols,
  fetchBiggestGainers,
  fetchBiggestLosers,
  fetchMostActives,
  fetchHistoricalEodLight,
  fmpGet,
  normalizeFmpMoverRow,
} from './fmp.js'
import { quoteSnapshotCacheMs } from './marketQuoteCacheMs.js'

const CACHE_TTL_MS = quoteSnapshotCacheMs()

let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

function toNum(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

function take(rows, n) {
  return rows.slice(0, n).map(normalizeFmpMoverRow).filter((r) => r.ticker)
}

async function avgVolumeFromRecentEod(symbol) {
  try {
    const rows = await fetchHistoricalEodLight(symbol)
    const arr = Array.isArray(rows) ? rows : []
    const vols = arr
      .slice(0, 30)
      .map((r) => toNum(r.volume ?? r.vol))
      .filter((v) => v != null && v > 0)
    if (vols.length < 5) return null
    const sum = vols.reduce((a, b) => a + b, 0)
    const avg = sum / vols.length
    return Number.isFinite(avg) && avg > 0 ? avg : null
  } catch {
    return null
  }
}

/**
 * Session VWAP from 5m bars (today's session); return % distance last price vs VWAP.
 */
async function sessionVwapDeviationPct(symbol) {
  const sym = String(symbol ?? '')
    .trim()
    .toUpperCase()
  if (!sym) return null
  let rows
  try {
    rows = await fmpGet('/historical-chart/5min', { symbol: sym })
  } catch {
    return null
  }
  const raw = Array.isArray(rows) ? rows : []
  if (raw.length < 5) return null
  const arr = [...raw].reverse()
  let cumPv = 0
  let cumV = 0
  for (const r of arr) {
    const h = toNum(r.high ?? r.max)
    const l = toNum(r.low ?? r.min)
    const c = toNum(r.close)
    const v = toNum(r.volume) ?? 0
    const tp =
      h != null && l != null && c != null ? (h + l + c) / 3 : c != null ? c : null
    if (tp == null) continue
    const vol = v > 0 ? v : 1
    cumPv += tp * vol
    cumV += vol
  }
  if (cumV <= 0) return null
  const vwap = cumPv / cumV
  const last = toNum(arr[arr.length - 1]?.close)
  if (last == null || vwap <= 0) return null
  return ((last - vwap) / vwap) * 100
}

/**
 * Top lists: unusual volume vs 30d avg, opening gaps, distance from intraday VWAP.
 */
export async function getMarketScanners() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const [gainersRaw, losersRaw, activesRaw] = await Promise.all([
    fetchBiggestGainers(),
    fetchBiggestLosers(),
    fetchMostActives(),
  ])

  const gainers = take(Array.isArray(gainersRaw) ? gainersRaw : [], 25)
  const losers = take(Array.isArray(losersRaw) ? losersRaw : [], 25)
  const actives = take(Array.isArray(activesRaw) ? activesRaw : [], 30)

  const tickers = [...new Set([...gainers, ...losers, ...actives].map((r) => r.ticker).filter(Boolean))]
  const quoteMap = await fetchBatchQuotesBySymbols(tickers)

  // Some FMP feeds omit `avgVolume` in `/batch-quote`; backfill with recent EOD bars (premium supports this).
  const missingAvg = tickers.filter((t) => quoteMap.get(t)?.avgVolume == null).slice(0, 18)
  const avgBackfills = new Map()
  if (missingAvg.length) {
    const concurrency = 6
    let idx = 0
    async function worker() {
      for (;;) {
        const i = idx++
        if (i >= missingAvg.length) return
        const sym = missingAvg[i]
        const avg = await avgVolumeFromRecentEod(sym)
        if (avg != null) avgBackfills.set(sym, Math.trunc(avg))
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, missingAvg.length) }, () => worker()))
  }

  const enriched = tickers.map((t) => {
    const q = quoteMap.get(t)
    const price = q?.price
    const open = q?.open
    const prev = q?.previousClose
    const vol = q?.volume
    const avgV = q?.avgVolume ?? avgBackfills.get(t) ?? null
    let gapPct = null
    if (open != null && prev != null && Number.isFinite(open) && Number.isFinite(prev) && prev > 0) {
      gapPct = ((open - prev) / prev) * 100
    }
    let volRatio = null
    if (vol != null && avgV != null && Number.isFinite(vol) && Number.isFinite(avgV) && avgV > 0) {
      volRatio = vol / avgV
    }
    return {
      ticker: t,
      price,
      changePercent: q?.changePercent ?? null,
      volume: vol,
      avgVolume: avgV,
      volumeRatio: volRatio,
      gapPercent: gapPct,
    }
  })

  const byVolRatio = [...enriched]
    .filter((r) => r.volumeRatio != null && Number.isFinite(r.volumeRatio))
    .sort((a, b) => (b.volumeRatio ?? 0) - (a.volumeRatio ?? 0))
  const rocketsStrict = byVolRatio.filter((r) => (r.volumeRatio ?? 0) >= 5).slice(0, 5)
  const volumeRockets =
    rocketsStrict.length >= 3
      ? rocketsStrict.map((r) => ({ ...r, meetsThreshold: true }))
      : byVolRatio.slice(0, 5).map((r) => ({ ...r, meetsThreshold: (r.volumeRatio ?? 0) >= 5 }))

  const gapUp = [...enriched]
    .filter((r) => r.gapPercent != null && r.gapPercent > 0.75)
    .sort((a, b) => (b.gapPercent ?? 0) - (a.gapPercent ?? 0))
    .slice(0, 5)

  const gapDown = [...enriched]
    .filter((r) => r.gapPercent != null && r.gapPercent < -0.75)
    .sort((a, b) => (a.gapPercent ?? 0) - (b.gapPercent ?? 0))
    .slice(0, 5)

  /** VWAP stretch: sample liquid names from most-actives list order */
  const vwapCandidates = actives.map((r) => r.ticker).filter(Boolean).slice(0, 6)
  const vwapRows = await Promise.all(
    vwapCandidates.map(async (ticker) => {
      const pct = await sessionVwapDeviationPct(ticker)
      return { ticker, vwapDeviationPct: pct }
    }),
  )
  const vwapDeviations = vwapRows
    .filter((r) => r.vwapDeviationPct != null && Number.isFinite(r.vwapDeviationPct))
    .sort((a, b) => Math.abs(b.vwapDeviationPct) - Math.abs(a.vwapDeviationPct))
    .slice(0, 5)

  const liquidityLeaders = [...enriched]
    .filter((r) => r.volume != null && r.volume > 0)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 10)
    .map((r) => ({
      ticker: r.ticker,
      price: r.price,
      changePercent: r.changePercent,
      volume: r.volume,
    }))

  const value = {
    asOf: new Date().toISOString(),
    source: 'fmp',
    volumeRockets,
    gapUp,
    gapDown,
    vwapDeviations,
    liquidityLeaders,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }
  cache = { at: now(), value }
  return value
}
