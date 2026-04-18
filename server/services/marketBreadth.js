import { getSp500QuoteSnapshot } from './sp500Snapshot.js'

/**
 * % of S&P 500 constituents trading above their 200-day moving average (FMP batch quotes).
 */
const HISTORY_WINDOW_MS = 24 * 60 * 60_000
/** @type {Array<{ t: string, pct: number }>} */
let history = []
const Z_MIN_POINTS = 20

function trimHistory() {
  const cutoff = Date.now() - HISTORY_WINDOW_MS
  history = history.filter((p) => Date.parse(p.t) >= cutoff)
}

function mean(xs) {
  if (!xs.length) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function std(xs) {
  if (xs.length < 3) return null
  const m = mean(xs)
  if (m === null) return null
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

export async function getMarketBreadth() {
  const snap = await getSp500QuoteSnapshot()

  let eligible = 0
  let above = 0
  for (const ticker of snap.symbols) {
    const q = snap.quotes.get(ticker)
    const price = q?.price
    const ma200 = q?.priceAvg200
    if (
      price === null ||
      ma200 === null ||
      !Number.isFinite(price) ||
      !Number.isFinite(ma200) ||
      ma200 <= 0
    ) {
      continue
    }
    eligible += 1
    if (price > ma200) above += 1
  }

  const pctAbove200 =
    eligible > 0 ? Math.round((above / eligible) * 10_000) / 100 : null

  // update 24h history for sparkline + z-score context
  if (pctAbove200 != null && Number.isFinite(pctAbove200)) {
    history.push({ t: snap.asOf, pct: pctAbove200 })
    trimHistory()
  }
  const histPct = history.map((p) => p.pct).filter((x) => Number.isFinite(x))
  const zEligible = histPct.length >= Z_MIN_POINTS
  const mu = zEligible ? mean(histPct) : null
  const sig = zEligible ? std(histPct) : null
  const z =
    pctAbove200 != null && mu != null && sig != null && sig > 1e-9 ? (pctAbove200 - mu) / sig : null

  let zone = 'neutral'
  let zoneLabel = 'Neutral'
  if (pctAbove200 != null) {
    if (pctAbove200 > 70) {
      zone = 'strong'
      zoneLabel = 'Overbought / strong'
    } else if (pctAbove200 < 30) {
      zone = 'weak'
      zoneLabel = 'Oversold'
    } else {
      zoneLabel = 'Neutral'
    }
  }

  return {
    asOf: snap.asOf,
    source: 'fmp',
    pctAbove200dma: pctAbove200,
    above,
    eligible,
    zone,
    zoneLabel,
    zScore24h: z == null ? null : Math.max(-6, Math.min(6, Math.round(z * 100) / 100)),
    history24h: history,
    cached: snap.cached === true,
    refreshIntervalMs: snap.refreshIntervalMs,
  }
}
