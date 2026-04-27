import { fmpGet } from './fmp.js'

/**
 * Fundamentals — fans out to several FMP endpoints in parallel and returns a
 * single normalized payload for the Charts page sidebar.
 *
 *   /profile                 → company description, sector, industry, current price
 *   /key-metrics-ttm         → EV multiples, ROE/ROA, FCF (firm-level)
 *   /ratios-ttm              → P/E, P/S, P/B, margins, debt/equity, current ratio
 *   /income-statement-ttm    → revenue, net income (TTM aggregated)
 *   /financial-growth        → revenue growth YoY (latest annual)
 *   /ratings-snapshot        → FMP letter grade + 1–5 score
 *   /analyst-estimates       → next-FY EPS estimate (used to derive forward P/E)
 *
 * Each source is fetched with `safe()` so a single failure doesn't kill the
 * whole response — the panel renders whatever loaded.
 */

const TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map()

function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(String(value).replace(/[%,$\s]/g, '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function firstRow(data) {
  if (Array.isArray(data)) return data[0] ?? null
  if (data && typeof data === 'object') return data
  return null
}

async function safe(promise) {
  try {
    return await promise
  } catch {
    return null
  }
}

function normalizeProfile(raw) {
  if (!raw) return null
  return {
    name: raw.companyName ?? raw.name ?? null,
    description: raw.description ?? null,
    sector: raw.sector ?? null,
    industry: raw.industry ?? null,
    ceo: raw.ceo ?? null,
    website: raw.website ?? null,
    employees: toNumber(raw.fullTimeEmployees),
    country: raw.country ?? null,
    image: raw.image ?? null,
    marketCap: toNumber(raw.marketCap ?? raw.mktCap),
    price: toNumber(raw.price),
  }
}

/**
 * Pick the next future estimate row to compute forward P/E.
 * `/analyst-estimates` returns multiple rows (one per future fiscal year).
 */
function pickNextEstimate(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const today = new Date().toISOString().slice(0, 10)
  const future = rows
    .filter((r) => r && typeof r.date === 'string' && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  return future[0] ?? null
}

export async function getFundamentals(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym) {
    const err = new Error('Missing symbol')
    err.code = 'BAD_REQUEST'
    throw err
  }

  const entry = cache.get(sym)
  if (entry && Date.now() - entry.at < TTL_MS) {
    return { ...entry.value, cached: true, asOf: new Date(entry.at).toISOString() }
  }

  const [
    profileRes,
    keyMetricsRes,
    ratiosRes,
    incomeRes,
    growthRes,
    ratingsRes,
    estimatesRes,
  ] = await Promise.all([
    safe(fmpGet('/profile', { symbol: sym })),
    safe(fmpGet('/key-metrics-ttm', { symbol: sym })),
    safe(fmpGet('/ratios-ttm', { symbol: sym })),
    safe(fmpGet('/income-statement-ttm', { symbol: sym })),
    safe(fmpGet('/financial-growth', { symbol: sym, limit: 1, period: 'annual' })),
    safe(fmpGet('/ratings-snapshot', { symbol: sym })),
    safe(fmpGet('/analyst-estimates', { symbol: sym, period: 'annual' })),
  ])

  const profileRow = firstRow(profileRes)
  const km = firstRow(keyMetricsRes) ?? {}
  const ratios = firstRow(ratiosRes) ?? {}
  const income = firstRow(incomeRes) ?? {}
  const growth = firstRow(growthRes) ?? {}
  const ratingRow = firstRow(ratingsRes)
  const nextEstimate = pickNextEstimate(Array.isArray(estimatesRes) ? estimatesRes : [])

  const profile = normalizeProfile(profileRow)

  // Forward P/E — derive from current price ÷ next-fiscal-year EPS average.
  const currentPrice = toNumber(profileRow?.price)
  const fwdEps = toNumber(nextEstimate?.epsAvg)
  const forwardPe =
    currentPrice != null && fwdEps != null && fwdEps > 0
      ? currentPrice / fwdEps
      : null

  const metrics = {
    // Valuation
    peRatio: toNumber(ratios.priceToEarningsRatioTTM ?? ratios.peRatioTTM),
    forwardPe,
    evToEbitda: toNumber(km.evToEBITDATTM ?? km.enterpriseValueOverEBITDATTM),
    evToRevenue: toNumber(km.evToSalesTTM ?? km.enterpriseValueOverRevenueTTM),
    priceToSales: toNumber(ratios.priceToSalesRatioTTM),
    priceToBook: toNumber(ratios.priceToBookRatioTTM),
    // Financials TTM
    revenue: toNumber(income.revenue),
    netIncome: toNumber(income.netIncome ?? income.bottomLineNetIncome),
    grossMargin: toNumber(ratios.grossProfitMarginTTM),
    netMargin: toNumber(ratios.netProfitMarginTTM ?? ratios.bottomLineProfitMarginTTM),
    operatingMargin: toNumber(ratios.operatingProfitMarginTTM),
    revenueGrowth: toNumber(growth.revenueGrowth),
    // Quality
    debtToEquity: toNumber(ratios.debtToEquityRatioTTM ?? km.debtToEquityTTM),
    currentRatio: toNumber(ratios.currentRatioTTM ?? km.currentRatioTTM),
    roe: toNumber(km.returnOnEquityTTM ?? ratios.returnOnEquityTTM),
    roa: toNumber(km.returnOnAssetsTTM ?? ratios.returnOnAssetsTTM),
    freeCashFlow: toNumber(km.freeCashFlowToFirmTTM ?? km.freeCashFlowToEquityTTM),
  }

  const rating = ratingRow
    ? {
        letter: ratingRow.rating ?? null,
        score: toNumber(ratingRow.overallScore ?? ratingRow.ratingScore),
        recommendation: ratingRow.ratingRecommendation ?? null,
      }
    : null

  const allEmpty =
    !profile &&
    Object.values(metrics).every((v) => v == null) &&
    !rating
  if (allEmpty) {
    const err = new Error(`No fundamentals data for ${sym}`)
    err.code = 'FMP_HTTP'
    throw err
  }

  const value = {
    ok: true,
    symbol: sym,
    profile,
    metrics,
    rating,
    cached: false,
    asOf: new Date().toISOString(),
  }
  cache.set(sym, { at: Date.now(), value })
  return value
}
