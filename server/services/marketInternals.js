import { getSp500QuoteSnapshot } from './sp500Snapshot.js'

const AD_HISTORY_MS = 24 * 60 * 60_000
/** @type {Array<{ t: string, net: number, advancers: number, decliners: number }>} */
let advanceDeclineHistory = []

function trimAdHistory() {
  const cutoff = Date.now() - AD_HISTORY_MS
  advanceDeclineHistory = advanceDeclineHistory.filter((p) => Date.parse(p.t) >= cutoff)
}

/**
 * Lightweight market internals:
 * - % above 50- and 200-day SMA (batch quotes)
 * - S&P participation: advancers / decliners
 * - 52w high / low touches (session high/low vs trailing 52w range)
 * - simple momentum highs/lows proxy (large 1d movers)
 */
export async function getMarketInternals() {
  const snap = await getSp500QuoteSnapshot()

  let eligible50 = 0
  let above50 = 0
  let eligible200 = 0
  let above200 = 0
  let highs = 0
  let lows = 0
  let advancers = 0
  let decliners = 0
  let highs52 = 0
  let lows52 = 0
  let eligible52 = 0

  for (const ticker of snap.symbols) {
    const q = snap.quotes.get(ticker)
    const price = q?.price
    const ma50 = q?.priceAvg50
    const ma200 = q?.priceAvg200

    if (price != null && ma50 != null && Number.isFinite(price) && Number.isFinite(ma50) && ma50 > 0) {
      eligible50 += 1
      if (price > ma50) above50 += 1
    }

    if (price != null && ma200 != null && Number.isFinite(price) && Number.isFinite(ma200) && ma200 > 0) {
      eligible200 += 1
      if (price > ma200) above200 += 1
    }

    const chg = q?.changePercent
    if (chg != null && Number.isFinite(chg)) {
      if (chg > 0) advancers += 1
      else if (chg < 0) decliners += 1
    }

    if (chg != null && Number.isFinite(chg)) {
      if (chg >= 5) highs += 1
      if (chg <= -5) lows += 1
    }

    const yHi = q?.yearHigh
    const yLo = q?.yearLow
    const dHi = q?.dayHigh
    const dLo = q?.dayLow
    if (
      yHi != null &&
      yLo != null &&
      Number.isFinite(yHi) &&
      Number.isFinite(yLo) &&
      yHi > 0 &&
      yLo > 0
    ) {
      eligible52 += 1
      if (dHi != null && Number.isFinite(dHi) && dHi >= yHi * 0.998) highs52 += 1
      if (dLo != null && Number.isFinite(dLo) && dLo <= yLo * 1.002) lows52 += 1
    }
  }

  const pctAbove50 =
    eligible50 > 0 ? Math.round((above50 / eligible50) * 10_000) / 100 : null
  const pctAbove200 =
    eligible200 > 0 ? Math.round((above200 / eligible200) * 10_000) / 100 : null

  const netAd = advancers - decliners
  advanceDeclineHistory.push({
    t: snap.asOf,
    net: netAd,
    advancers,
    decliners,
  })
  trimAdHistory()

  return {
    asOf: snap.asOf,
    source: 'fmp',
    pctAbove50sma: pctAbove50,
    pctAbove200sma: pctAbove200,
    above50,
    eligible50,
    above200,
    eligible200,
    advancers,
    decliners,
    advanceDeclineNet: netAd,
    advanceDeclineHistory24h: advanceDeclineHistory,
    highs52w: highs52,
    lows52w: lows52,
    eligible52w: eligible52,
    highsProxy: highs,
    lowsProxy: lows,
    cached: snap.cached === true,
    refreshIntervalMs: snap.refreshIntervalMs,
  }
}
