import { fmpGet } from './fmp.js'

/**
 * Analyst ratings — pulled from FMP stable's grade/target endpoints.
 *
 *   /grades-consensus         → current bucket counts (strongBuy/buy/hold/sell/strongSell) + label
 *   /price-target-consensus   → targetHigh, targetLow, targetConsensus (avg), targetMedian
 *   /price-target-news        → recent analyst price-target announcements (firm, target, when posted)
 *
 * The older `/analyst-recommendations` and `/analyst-price-target` endpoints
 * now return empty arrays on FMP stable — these have replaced them.
 */

const CACHE_TTL_MS = 60 * 60 * 1000
const BATCH_CONCURRENCY = 8

const cache = new Map()

function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(String(value).replace(/[%,$\s]/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function toInt(value) {
  const n = toNumber(value)
  return n === null ? null : Math.trunc(n)
}

function firstRow(arr) {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null
}

/**
 * Build consensus from a `/grades-consensus` row:
 *   { strongBuy, buy, hold, sell, strongSell, consensus }
 */
function deriveConsensusFromGrades(row) {
  if (!row) return null
  const sb = toInt(row.strongBuy) ?? 0
  const b = toInt(row.buy) ?? 0
  const h = toInt(row.hold) ?? 0
  const s = toInt(row.sell) ?? 0
  const ss = toInt(row.strongSell) ?? 0
  const total = sb + b + h + s + ss
  if (total === 0) return null

  // Weighted score: SB=+2, B=+1, H=0, S=-1, SS=-2  → avg in [-2, 2]
  const score = (sb * 2 + b * 1 + h * 0 + s * -1 + ss * -2) / total

  let label = 'Hold'
  let code = 'H'
  if (score >= 1.5) { label = 'Strong Buy'; code = 'SB' }
  else if (score >= 0.5) { label = 'Buy'; code = 'B' }
  else if (score > -0.5) { label = 'Hold'; code = 'H' }
  else if (score > -1.5) { label = 'Sell'; code = 'S' }
  else { label = 'Strong Sell'; code = 'SS' }

  // Prefer the FMP-supplied label when present and well-formed, otherwise fall back.
  const fmpLabel = typeof row.consensus === 'string' ? row.consensus.trim() : ''
  if (fmpLabel) {
    const m = fmpLabel.toLowerCase()
    if (m === 'strong buy') return { label: 'Strong Buy', code: 'SB', score, total, buckets: { strongBuy: sb, buy: b, hold: h, sell: s, strongSell: ss } }
    if (m === 'buy')        return { label: 'Buy',        code: 'B',  score, total, buckets: { strongBuy: sb, buy: b, hold: h, sell: s, strongSell: ss } }
    if (m === 'hold')       return { label: 'Hold',       code: 'H',  score, total, buckets: { strongBuy: sb, buy: b, hold: h, sell: s, strongSell: ss } }
    if (m === 'sell')       return { label: 'Sell',       code: 'S',  score, total, buckets: { strongBuy: sb, buy: b, hold: h, sell: s, strongSell: ss } }
    if (m === 'strong sell')return { label: 'Strong Sell',code: 'SS', score, total, buckets: { strongBuy: sb, buy: b, hold: h, sell: s, strongSell: ss } }
  }

  return { label, code, score, total, buckets: { strongBuy: sb, buy: b, hold: h, sell: s, strongSell: ss } }
}

function normalizeTargetConsensus(row) {
  if (!row) return { avgTarget: null, highTarget: null, lowTarget: null, medianTarget: null }
  return {
    avgTarget: toNumber(row.targetConsensus ?? row.priceTargetConsensus),
    highTarget: toNumber(row.targetHigh ?? row.priceTargetHigh),
    lowTarget: toNumber(row.targetLow ?? row.priceTargetLow),
    medianTarget: toNumber(row.targetMedian ?? row.priceTargetMedian),
  }
}

function normalizePriceTargetNews(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((r) => ({
      date: r.publishedDate ?? r.date ?? null,
      firm: r.analystCompany ?? r.firm ?? r.newsPublisher ?? null,
      analyst: r.analystName ?? null,
      priceTarget: toNumber(r.priceTarget ?? r.adjPriceTarget),
      priceWhenPosted: toNumber(r.priceWhenPosted),
      newsURL: r.newsURL ?? null,
    }))
    .filter((r) => r.priceTarget !== null)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .slice(0, 5)
}

async function fetchRatingFromFmp(symbol) {
  const sym = String(symbol).trim().toUpperCase()
  const [gradesRes, targetRes, newsRes] = await Promise.allSettled([
    fmpGet('/grades-consensus', { symbol: sym }),
    fmpGet('/price-target-consensus', { symbol: sym }),
    fmpGet('/price-target-news', { symbol: sym, limit: 25 }),
  ])

  const gradesRow = gradesRes.status === 'fulfilled' ? firstRow(gradesRes.value) : null
  const targetRow = targetRes.status === 'fulfilled' ? firstRow(targetRes.value) : null
  const newsArr = newsRes.status === 'fulfilled' && Array.isArray(newsRes.value) ? newsRes.value : []

  const consensus = deriveConsensusFromGrades(gradesRow)
  const targets = normalizeTargetConsensus(targetRow)
  const recentChanges = normalizePriceTargetNews(newsArr)

  // Analyst count: prefer total grade buckets; fall back to recent-news count.
  const analystCount = consensus?.total ?? recentChanges.length

  if (!consensus && targets.avgTarget == null && recentChanges.length === 0) {
    return null
  }

  return {
    symbol: sym,
    consensus,
    analystCount,
    avgTarget: targets.avgTarget,
    highTarget: targets.highTarget,
    lowTarget: targets.lowTarget,
    medianTarget: targets.medianTarget,
    recentChanges,
    fetchedAt: Date.now(),
  }
}

function getCached(symbol) {
  const entry = cache.get(symbol)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(symbol)
    return null
  }
  return entry.value
}

function setCached(symbol, value) {
  cache.set(symbol, { at: Date.now(), value })
}

export async function getAnalystRating(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym) return null
  const cached = getCached(sym)
  if (cached !== null) return cached
  const value = await fetchRatingFromFmp(sym)
  setCached(sym, value)
  return value
}

export async function getAnalystRatingsBatch(symbols) {
  const unique = [
    ...new Set(
      (Array.isArray(symbols) ? symbols : [])
        .map((s) => String(s ?? '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ]
  if (unique.length === 0) return {}

  const out = {}
  const pending = []
  for (const sym of unique) {
    const cached = getCached(sym)
    if (cached !== null) {
      out[sym] = cached
    } else if (cache.has(sym)) {
      // explicit null cached from prior fetch (no data for symbol)
      out[sym] = null
    } else {
      pending.push(sym)
    }
  }

  if (pending.length === 0) return out

  let idx = 0
  async function worker() {
    for (;;) {
      const i = idx++
      if (i >= pending.length) return
      const sym = pending[i]
      try {
        const value = await fetchRatingFromFmp(sym)
        setCached(sym, value)
        out[sym] = value
      } catch {
        // soft-fail — cache null briefly via setCached so we don't hammer
        setCached(sym, null)
        out[sym] = null
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, pending.length) }, () => worker()),
  )
  return out
}
