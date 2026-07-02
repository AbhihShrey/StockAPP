/**
 * Daily VWAP from OHLCV: cumulative Σ(typical × volume) / Σ(volume) over the requested window.
 * FMP’s intraday `technical_indicator/.../vwap` is session/intraday-specific; for dashboard and
 * backtest alignment we compute from stable EOD history (same cadence as vectorbt Yahoo daily bars).
 */
import { fetchHistoricalEodFullOhlcv } from './fmp.js'

const CACHE_TTL_MS = Number(process.env.VWAP_CACHE_MS) || 15 * 60_000

/** @type {Map<string, { at: number, rows: Array<{ date: string, open: number, high: number, low: number, close: number, volume: number }> }>} */
const cacheBySymbol = new Map()

function now() {
  return Date.now()
}

/**
 * @param {Array<{ date: string, high: number, low: number, close: number, volume?: number }>} rows ascending date
 */
export function computeCumulativeVwapSeries(rows) {
  let cumPv = 0
  let cumV = 0
  const out = []
  for (const r of rows) {
    const tp = (Number(r.high) + Number(r.low) + Number(r.close)) / 3
    let vol = Number(r.volume)
    if (!Number.isFinite(vol) || vol < 0) vol = 0
    if (vol === 0) vol = 1
    cumPv += tp * vol
    cumV += vol
    const vwap = cumV > 0 ? cumPv / cumV : tp
    out.push({
      date: r.date,
      close: Number(r.close),
      vwap,
    })
  }
  return out
}

/**
 * Rolling VWAP over a trailing window of `window` bars, aligned to `rows`
 * (ascending date). Unlike the cumulative variant this does not grow without
 * bound — it reflects the "recent" volume-weighted fair value that swing
 * traders watch. Entries before a full window are `null`.
 * @param {Array<{ date: string, high: number, low: number, close: number, volume?: number }>} rows
 * @param {number} window
 * @returns {Array<{ date: string, close: number, vwap: number|null }>}
 */
export function computeRollingVwapSeries(rows, window = 20) {
  const n = rows.length
  const out = new Array(n)
  let cumPv = 0
  let cumV = 0
  const pv = new Array(n)
  const vv = new Array(n)
  for (let i = 0; i < n; i++) {
    const r = rows[i]
    const tp = (Number(r.high) + Number(r.low) + Number(r.close)) / 3
    let vol = Number(r.volume)
    if (!Number.isFinite(vol) || vol < 0) vol = 0
    if (vol === 0) vol = 1
    pv[i] = tp * vol
    vv[i] = vol
    cumPv += pv[i]
    cumV += vv[i]
    if (i >= window) {
      cumPv -= pv[i - window]
      cumV -= vv[i - window]
    }
    const ready = i >= window - 1
    out[i] = {
      date: r.date,
      close: Number(r.close),
      vwap: ready && cumV > 0 ? cumPv / cumV : null,
    }
  }
  return out
}

/**
 * Cached ascending daily OHLCV per symbol (15-min TTL, shared with the VWAP chart).
 * Central getter so many-symbol scans don't each re-fetch full history.
 * @returns {Promise<Array<{ date: string, open: number, high: number, low: number, close: number, volume: number }>>}
 */
export async function getDailyOhlcvCached(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym) return []
  const cached = cacheBySymbol.get(sym)
  if (cached && now() - cached.at < CACHE_TTL_MS) return cached.rows
  const rows = await fetchHistoricalEodFullOhlcv(sym)
  cacheBySymbol.set(sym, { at: now(), rows })
  return rows
}

function sliceByDateRange(rows, start, end) {
  let s = rows
  if (start && String(start).trim()) {
    const a = String(start).slice(0, 10)
    s = s.filter((r) => r.date >= a)
  }
  if (end && String(end).trim()) {
    const b = String(end).slice(0, 10)
    s = s.filter((r) => r.date <= b)
  }
  return s
}

/**
 * Cached full OHLCV per symbol; slice + VWAP computed per request (window-anchored cumulative).
 */
export async function getVwapChartData(symbol, start, end) {
  const sym = String(symbol ?? '')
    .trim()
    .toUpperCase()
  if (!sym) {
    const err = new Error('symbol is required')
    err.code = 'BAD_REQUEST'
    throw err
  }

  const cached = cacheBySymbol.get(sym)
  const stale = !cached || now() - cached.at >= CACHE_TTL_MS

  let rows = stale ? null : cached.rows
  if (!rows) {
    rows = await fetchHistoricalEodFullOhlcv(sym)
    cacheBySymbol.set(sym, { at: now(), rows })
  }

  const sliced = sliceByDateRange(rows, start, end)
  if (sliced.length === 0) {
    const err = new Error(`No OHLCV rows for ${sym} in range`)
    err.code = 'FMP_HTTP'
    throw err
  }

  const series = computeCumulativeVwapSeries(sliced)
  const first = sliced[0]?.date
  const last = sliced[sliced.length - 1]?.date

  return {
    symbol: sym,
    start: first,
    end: last,
    series,
    source: 'computed',
    cached: !stale,
    refreshIntervalMs: CACHE_TTL_MS,
    methodology:
      'Daily cumulative VWAP: typical price (H+L+C)/3 weighted by volume, reset at the start of the selected date range.',
  }
}
