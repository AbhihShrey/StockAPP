/**
 * Strategy-proximity screener runner.
 *
 * Resolves a universe, fetches the data each strategy's dataTier needs (reusing
 * batch quotes + the 15-min OHLCV cache + a worker pool), runs the shared
 * evaluate() from screenerStrategies.js, ranks survivors by readiness, and caches
 * the result. Also exposes evaluateOneSymbol() so the alert engine reuses the exact
 * same logic (screen and alert can never disagree).
 */
import { fetchBatchQuotesBySymbols, fmpGet } from './fmp.js'
import { getDailyOhlcvCached } from './vwapData.js'
import { getWatchlistSymbols } from './watchlistService.js'
import { fetchSp500Symbols } from './sp500Snapshot.js'
import { fetchNextEarnings } from './earningsAlerts.js'
import { pcGet, pcSet } from './persistentCache.js'
import { quoteSnapshotCacheMs } from './marketQuoteCacheMs.js'
import {
  getStrategy,
  resolveParams,
  resolveThreshold,
} from '../lib/screenerStrategies.js'

const CONCURRENCY = 8
const RESULT_CACHE_TTL_MS = quoteSnapshotCacheMs() // ~30s

// Per-tier hard caps on how many symbols we fetch heavier data for.
const UNIVERSE_CAPS = {
  quote: Number(process.env.SCREENER_CAP_QUOTE) || 750,
  ohlcv: Number(process.env.SCREENER_CAP_OHLCV) || 250,
  intraday: Number(process.env.SCREENER_CAP_INTRADAY) || 60,
  options: 60,
}

// Liquidity floor — drop untradeable names so every hit is actionable.
const LIQ_MIN_PRICE = Number(process.env.SCREENER_MIN_PRICE) || 3
const LIQ_MIN_DOLLAR_VOL = Number(process.env.SCREENER_MIN_DOLLAR_VOL) || 5_000_000

// Earnings-landmine flag — flag (never exclude) matched names reporting soon.
const EARNINGS_FLAG_DAYS = Number(process.env.SCREENER_EARNINGS_FLAG_DAYS) || 7
const EARNINGS_ATTACH_DAYS = 21 // attach the date within this window; flag when ≤ EARNINGS_FLAG_DAYS
const EARNINGS_CACHE_TTL_MS = 12 * 60 * 60 * 1000 // earnings dates change slowly

/** Cached next-earnings lookup (persists across restarts). `null` = known "no upcoming earnings". */
async function getNextEarningsCached(symbol) {
  const key = `earnings:${symbol}`
  const cached = pcGet(key)
  if (cached !== undefined) return cached
  const next = await fetchNextEarnings(symbol)
  pcSet(key, next ?? null, EARNINGS_CACHE_TTL_MS)
  return next ?? null
}

function daysUntilIso(fromIso, toIso) {
  const a = new Date(`${fromIso}T00:00:00Z`)
  const b = new Date(`${toIso}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** effective tier: vwap_proximity becomes intraday-tier when the intraday flag is on */
function effectiveTier(strategy, intraday) {
  if (intraday && strategy.supportsIntraday) return 'intraday'
  return strategy.dataTier
}

// ── universe resolution ────────────────────────────────────────────────────────

const VALID_UNIVERSES = ['watchlist', 'sp500', 'custom']

async function resolveUniverse({ universe, userId, symbols }) {
  if (universe === 'custom' || (Array.isArray(symbols) && symbols.length > 0 && !universe)) {
    return [...new Set(
      (symbols ?? []).map((s) => String(s ?? '').trim().toUpperCase()).filter(Boolean),
    )]
  }
  if (universe === 'watchlist') {
    if (!userId) return []
    return [...new Set(getWatchlistSymbols(userId).map((r) => String(r.symbol).toUpperCase()))]
  }
  if (universe === 'sp500') {
    return await fetchSp500Symbols()
  }
  return []
}

function universeCacheKey(universe, userId) {
  return universe === 'watchlist' ? `watchlist:${userId}` : universe === 'custom' ? 'custom' : universe
}

// ── data fetch helpers ─────────────────────────────────────────────────────────

async function mapWithConcurrency(items, fn, concurrency = CONCURRENCY) {
  const out = new Map()
  let idx = 0
  async function worker() {
    for (;;) {
      const i = idx++
      if (i >= items.length) return
      const key = items[i]
      try {
        const v = await fn(key)
        if (v != null) out.set(key, v)
      } catch {
        // per-symbol failure — skip
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return out
}

function todayEtPrefix() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

/** Ascending today-only 5-minute session bars for a symbol. */
async function fetchTodaySession5m(symbol) {
  const sym = String(symbol).toUpperCase()
  const raw = await fmpGet('/historical-chart/5min', { symbol: sym })
  const today = todayEtPrefix()
  return (Array.isArray(raw) ? raw : [])
    .filter((b) => String(b.date ?? '').startsWith(today))
    .map((b) => ({
      date: b.date,
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume) || 0,
    }))
    .reverse() // FMP returns newest-first → ascending
}

/** Rank symbols by dollar volume (price × volume) so capped scans keep the most tradeable names. */
function rankByLiquidity(symbols, quoteMap) {
  return symbols
    .map((s) => {
      const q = quoteMap.get(s)
      const dv = q ? (Number(q.price) || 0) * (Number(q.volume) || 0) : 0
      return { s, dv }
    })
    .sort((a, b) => b.dv - a.dv)
    .map((x) => x.s)
}

// ── main run ────────────────────────────────────────────────────────────────

const resultCache = new Map() // key -> { at, value }

/**
 * @param {object} req
 * @param {string} req.strategyId
 * @param {'watchlist'|'sp500'|'custom'} req.universe
 * @param {number} [req.userId]
 * @param {string[]} [req.symbols]  when universe === 'custom'
 * @param {object} [req.params]
 * @param {number} [req.threshold]  raw threshold value (clamped per strategy)
 * @param {boolean} [req.intraday]
 */
export async function runStrategyScreener(req) {
  const strategy = getStrategy(req.strategyId)
  if (!strategy) {
    const err = new Error(`Unknown strategy: ${req.strategyId}`)
    err.code = 'BAD_REQUEST'
    throw err
  }
  if (strategy.disabled) {
    const err = new Error(`Strategy "${strategy.label}" is not available yet.`)
    err.code = 'BAD_REQUEST'
    throw err
  }
  const universe = VALID_UNIVERSES.includes(req.universe) ? req.universe : 'sp500'
  const params = resolveParams(strategy, req.params ?? {})
  const thresholdValue = resolveThreshold(strategy, req.threshold)
  const intraday = Boolean(req.intraday) && Boolean(strategy.supportsIntraday)
  const tier = effectiveTier(strategy, intraday)

  const liquidityFilter = req.liquidityFilter !== false // default on
  const minPrice = Number.isFinite(Number(req.minPrice)) ? Number(req.minPrice) : LIQ_MIN_PRICE
  const minDollarVol = Number.isFinite(Number(req.minDollarVol)) ? Number(req.minDollarVol) : LIQ_MIN_DOLLAR_VOL

  const cacheKey = [
    strategy.id,
    universeCacheKey(universe, req.userId),
    JSON.stringify(params),
    thresholdValue,
    intraday ? 1 : 0,
    liquidityFilter ? `liq:${minPrice}:${minDollarVol}` : 'liq:off',
  ].join('|')

  const cached = resultCache.get(cacheKey)
  if (cached && Date.now() - cached.at < RESULT_CACHE_TTL_MS) {
    return { ...cached.value, cached: true }
  }

  const universeSymbols = await resolveUniverse({ universe, userId: req.userId, symbols: req.symbols })
  const universeSize = universeSymbols.length
  if (universeSize === 0) {
    return {
      strategyId: strategy.id, universe, params, threshold: thresholdValue, intraday,
      results: [], universeSize: 0, scanned: 0, matched: 0, nearButStalled: 0, skipped: 0,
      illiquidFiltered: 0, truncated: false, cap: UNIVERSE_CAPS[tier] ?? 0,
      asOf: new Date().toISOString(), cached: false,
    }
  }

  const quoteMap = await fetchBatchQuotesBySymbols(universeSymbols)

  // Only work symbols that have a live price.
  let workable = universeSymbols.filter((s) => quoteMap.get(s)?.price != null)

  // Liquidity floor — drop penny / thinly-traded names so every hit is tradeable.
  let illiquidFiltered = 0
  if (liquidityFilter) {
    const before = workable.length
    workable = workable.filter((s) => {
      const q = quoteMap.get(s)
      const price = Number(q.price) || 0
      const dollarVol = price * (Number(q.avgVolume) || Number(q.volume) || 0)
      return price >= minPrice && dollarVol >= minDollarVol
    })
    illiquidFiltered = before - workable.length
  }

  if (tier !== 'quote') workable = rankByLiquidity(workable, quoteMap)

  const cap = UNIVERSE_CAPS[tier] ?? UNIVERSE_CAPS.ohlcv
  const truncated = workable.length > cap
  const capped = workable.slice(0, cap)

  // Fetch heavier per-symbol data for the tier.
  let ohlcvMap = new Map()
  let intradayMap = new Map()
  if (tier === 'ohlcv') {
    ohlcvMap = await mapWithConcurrency(capped, (s) => getDailyOhlcvCached(s))
  } else if (tier === 'intraday') {
    intradayMap = await mapWithConcurrency(capped, (s) => fetchTodaySession5m(s))
  }

  let evaluated = 0
  let stalled = 0
  const results = []
  for (const sym of capped) {
    const quote = quoteMap.get(sym)
    if (!quote || quote.price == null) continue
    const ctx = {
      symbol: sym,
      quote,
      dailyOhlcv: ohlcvMap.get(sym) ?? null,
      intraday5m: intradayMap.get(sym) ?? null,
      params,
      thresholdValue,
    }
    let r = null
    try {
      r = strategy.evaluate(ctx)
    } catch {
      r = null
    }
    evaluated++
    if (r?.matches) results.push(r)
    else if (r?.nearButStalled) stalled++
  }

  results.sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))

  // Earnings-landmine flag — enrich the (small) matched set with the next earnings date.
  // Flag names reporting soon so the user knows a setup could gap overnight; never remove them.
  if (results.length > 0) {
    const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
    const earningsMap = await mapWithConcurrency(results.map((r) => r.symbol), (s) => getNextEarningsCached(s))
    for (const r of results) {
      const e = earningsMap.get(r.symbol)
      if (e?.date) {
        const d = daysUntilIso(todayEt, e.date)
        if (d >= 0 && d <= EARNINGS_ATTACH_DAYS) {
          r.earningsDate = e.date
          r.earningsInDays = d
          r.earningsSession = e.session ?? null
          r.earningsFlag = d <= EARNINGS_FLAG_DAYS
        }
      }
    }
  }

  const value = {
    strategyId: strategy.id,
    strategyLabel: strategy.label,
    universe,
    params,
    threshold: thresholdValue,
    thresholdUnit: strategy.threshold?.unit ?? '%',
    intraday,
    results,
    universeSize,
    scanned: capped.length,
    matched: results.length,
    nearButStalled: stalled,
    skipped: capped.length - evaluated,
    illiquidFiltered,
    truncated,
    cap,
    asOf: new Date().toISOString(),
    cached: false,
  }
  resultCache.set(cacheKey, { at: Date.now(), value })
  return value
}

/**
 * Evaluate a single symbol for a strategy — used by the alert engine so alerts
 * and the screener share identical logic. Returns the evaluate() result (or null).
 */
export async function evaluateOneSymbol(strategyId, symbol, { params = {}, threshold, intraday = false } = {}) {
  const strategy = getStrategy(strategyId)
  if (!strategy || strategy.disabled) return null
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym) return null

  const resolvedParams = resolveParams(strategy, params)
  const thresholdValue = resolveThreshold(strategy, threshold)
  const useIntraday = Boolean(intraday) && Boolean(strategy.supportsIntraday)
  const tier = effectiveTier(strategy, useIntraday)

  const quoteMap = await fetchBatchQuotesBySymbols([sym])
  const quote = quoteMap.get(sym)
  if (!quote || quote.price == null) return null

  let dailyOhlcv = null
  let intraday5m = null
  if (tier === 'ohlcv') {
    try { dailyOhlcv = await getDailyOhlcvCached(sym) } catch { dailyOhlcv = null }
  } else if (tier === 'intraday') {
    try { intraday5m = await fetchTodaySession5m(sym) } catch { intraday5m = null }
  }

  try {
    return strategy.evaluate({ symbol: sym, quote, dailyOhlcv, intraday5m, params: resolvedParams, thresholdValue })
  } catch {
    return null
  }
}
