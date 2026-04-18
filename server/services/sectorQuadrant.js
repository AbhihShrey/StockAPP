import { macdLast, pctChangeOverLag, rsiWilder, trendFromIndicators } from '../lib/technical.js'
import { fetchHistoricalEodFull } from './fmp.js'

/** SPDR Select Sector ETFs (11) + SPY as benchmark */
export const SECTOR_ETFS = [
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLV', name: 'Health Care' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLY', name: 'Consumer Disc.' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLC', name: 'Communication Serv.' },
]

const BENCHMARK = 'SPY'
const MOMENTUM_LAG_DAYS = 20

/** Default 5 min — full history pulls are heavier than movers; tune with SECTOR_QUADRANT_CACHE_MS. */
const CACHE_TTL_MS = Number(process.env.SECTOR_QUADRANT_CACHE_MS) || 5 * 60_000
let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

/** Align series by calendar date; keep dates present in both SPY and sector. */
function alignSeries(spyRows, sectorRows) {
  const spyByDate = new Map(spyRows.map((r) => [r.date, r.close]))
  const out = []
  for (const s of sectorRows) {
    const sp = spyByDate.get(s.date)
    if (sp != null && sp > 0 && s.close > 0) {
      out.push({ date: s.date, sectorClose: s.close, spyClose: sp })
    }
  }
  return out
}

/**
 * RS-Ratio = sector / SPY; RS-Momentum = % change in RS-Ratio over MOMENTUM_LAG_DAYS.
 * Adds absolute sector % performance (1d / ~1w / ~1mo), RSI(14), MACD, and trend label.
 */
export async function getSectorQuadrant() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const symbols = [BENCHMARK, ...SECTOR_ETFS.map((s) => s.symbol)]
  const seriesBySymbol = {}
  await Promise.all(
    symbols.map(async (sym) => {
      seriesBySymbol[sym] = await fetchHistoricalEodFull(sym)
    }),
  )

  const spyRows = seriesBySymbol[BENCHMARK]
  if (!spyRows?.length) throw new Error('No SPY daily data')

  const points = []

  for (const { symbol, name } of SECTOR_ETFS) {
    const secRows = seriesBySymbol[symbol]
    if (!secRows?.length) continue

    const closes = secRows.map((r) => r.close).filter((c) => c != null && c > 0)
    const change1d = pctChangeOverLag(closes, 1)
    const change5d = pctChangeOverLag(closes, 5)
    const change22d = pctChangeOverLag(closes, 22)

    const aligned = alignSeries(spyRows, secRows)
    if (aligned.length < MOMENTUM_LAG_DAYS + 1) continue

    const rsSeries = aligned.map((r) => ({
      date: r.date,
      rs: r.sectorClose / r.spyClose,
    }))

    const last = rsSeries[rsSeries.length - 1]
    const prev = rsSeries[rsSeries.length - 1 - MOMENTUM_LAG_DAYS]
    if (!last || !prev || prev.rs <= 0) continue

    const rsRatio = last.rs
    const rsMomentum = (last.rs / prev.rs - 1) * 100

    const rsi14 = rsiWilder(closes, 14)
    const macd = macdLast(closes, 12, 26, 9)
    const trend = trendFromIndicators(rsi14, macd)

    points.push({
      symbol,
      name,
      rsRatio,
      rsMomentum,
      change1d,
      change5d,
      change22d,
      rsi14,
      macd: macd ? { line: macd.line, signal: macd.signal, histogram: macd.histogram } : null,
      trend,
    })
  }

  if (points.length === 0) {
    throw new Error('Could not compute sector quadrant (insufficient overlapping history).')
  }

  const ratios = points.map((p) => p.rsRatio).sort((a, b) => a - b)
  const moms = points.map((p) => p.rsMomentum).sort((a, b) => a - b)
  const midR = ratios[Math.floor(ratios.length / 2)]
  const midM = moms[Math.floor(moms.length / 2)]

  for (const p of points) {
    const highR = p.rsRatio >= midR
    const highM = p.rsMomentum >= midM
    if (highR && highM) p.quadrant = 'leading'
    else if (highR && !highM) p.quadrant = 'weakening'
    else if (!highR && !highM) p.quadrant = 'lagging'
    else p.quadrant = 'improving'
  }

  const barChart = points.map((p) => ({
    symbol: p.symbol,
    name: p.name,
    day: p.change1d ?? 0,
    week: p.change5d ?? 0,
    month: p.change22d ?? 0,
  }))

  const value = {
    asOf: new Date().toISOString(),
    benchmark: BENCHMARK,
    momentumLagDays: MOMENTUM_LAG_DAYS,
    medians: { rsRatio: midR, rsMomentum: midM },
    points,
    barChart,
    source: 'fmp',
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }

  cache = { at: now(), value }
  return value
}
