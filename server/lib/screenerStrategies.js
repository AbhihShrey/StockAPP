/**
 * Shared strategy registry for the strategy-proximity screener (and its alerts).
 *
 * Each strategy is declared once here so the on-demand screener, the alert engine,
 * and (later) the backtester all agree on what "approaching a target" means.
 *
 * Every strategy enforces TWO gates — an investor doesn't care that a stock is *near*
 * a level, only that it's near AND moving into it:
 *   1. Proximity  — price is within the threshold band and on the approach side (not crossed).
 *   2. Momentum   — the distance to the level is *shrinking* (converging). Flat / diverging = dropped.
 * Survivors get a Readiness score (0–100) blending closeness, convergence speed, and volume
 * confirmation, plus an ETA (bars-to-level). Results are ranked by readiness.
 *
 * evaluate(ctx) is PURE — it never fetches data. The runner (strategyScreener.js) fetches the
 * right data for the strategy's dataTier and passes it in, so evaluate() stays unit-testable.
 *
 * ctx = {
 *   symbol, quote, dailyOhlcv?, intraday5m?, params, thresholdValue,
 * }
 *   quote      : { price, open, previousClose, changePercent, volume, avgVolume,
 *                  priceAvg50, priceAvg200, yearHigh, yearLow, dayHigh, dayLow }
 *   dailyOhlcv : ascending [{ date, open, high, low, close, volume }] (ohlcv-tier)
 *   intraday5m : ascending session [{ date, high, low, close, volume }] (intraday-tier)
 */
import {
  rsiWilder,
  macdLast,
  smaSeries,
  stddevSeries,
  atr14,
  convergenceVelocity,
  trendFromIndicators,
} from './technical.js'
import { computeRollingVwapSeries, computeCumulativeVwapSeries } from '../services/vwapData.js'

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null)

/**
 * Volume-confirmation + trend confirmations for the readiness blend and UI badges.
 */
function confirmationsFor(quote, closes) {
  const vol = num(quote?.volume)
  const avg = num(quote?.avgVolume)
  const aboveAvgVolume = vol != null && avg != null && avg > 0 ? vol >= avg : false
  let trend = null
  if (closes && closes.length > 40) {
    trend = trendFromIndicators(rsiWilder(closes, 14), macdLast(closes))
  }
  return { aboveAvgVolume, trend, volumeMult: vol != null && avg ? Math.round((vol / avg) * 100) / 100 : null }
}

// Readiness weights (proximity / momentum / volume). Defaults 0.5 / 0.4 / 0.1; override via env
// (READINESS_WEIGHT_*), normalized to sum to 1. Resolved lazily so a .env loaded after import is
// still picked up, and memoized so it's read once per process.
let _weights = null
function readinessWeights() {
  if (_weights) return _weights
  const read = (v, d) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : d
  }
  let wP = read(process.env.READINESS_WEIGHT_PROXIMITY, 0.5)
  let wM = read(process.env.READINESS_WEIGHT_MOMENTUM, 0.4)
  let wC = read(process.env.READINESS_WEIGHT_VOLUME, 0.1)
  const sum = wP + wM + wC
  _weights = sum > 0 ? { wP: wP / sum, wM: wM / sum, wC: wC / sum } : { wP: 0.5, wM: 0.4, wC: 0.1 }
  return _weights
}

function readinessScore({ distancePct, thresholdValue, etaBars, quote, targetBars = 5 }) {
  const p = clamp01(1 - distancePct / thresholdValue) // 1 at the level, 0 at the band edge
  const m = etaBars != null && etaBars >= 0 ? clamp01(targetBars / (targetBars + etaBars)) : 0
  let c = 0
  const vol = num(quote?.volume)
  const avg = num(quote?.avgVolume)
  if (vol != null && avg && avg > 0) c = clamp01(vol / avg - 1) // >avg volume contributes up to 1
  const { wP, wM, wC } = readinessWeights()
  return Math.round(100 * (wP * p + wM * m + wC * c))
}

/**
 * Finalize a price-to-level strategy: apply proximity + momentum gates and build the result.
 * `velocity` is the convergence velocity in %/bar (positive = converging). `distancePct` is
 * the current absolute distance to the level in %. `signed` is (price-level)/level*100.
 */
function finishProximity({
  symbol, price, level, levelLabel, signed, thresholdValue, velocity,
  side, atrVal, quote, closes, directionOverride, targetBars,
}) {
  const distancePct = Math.abs(signed)
  const direction = directionOverride ?? (signed >= 0 ? 'from_above' : 'from_below')

  // Approach-side gate: exclude names that have already crossed through the level.
  if (side === 'below' && signed > 0) return null
  if (side === 'above' && signed < 0) return null

  // Proximity gate.
  if (distancePct > thresholdValue) return { symbol, matches: false, nearButStalled: false }

  // Momentum gate (required): must be converging toward the level.
  if (velocity == null || velocity <= 0) {
    return { symbol, matches: false, nearButStalled: true, distancePct, direction }
  }

  const etaBars = velocity > 0 ? distancePct / velocity : null
  const readiness = readinessScore({ distancePct, thresholdValue, etaBars, quote, targetBars })
  const distanceAtr = atrVal && atrVal > 0 ? Math.round(((price - level) / atrVal) * 100) / 100 : null

  return {
    symbol,
    matches: true,
    nearButStalled: false,
    price,
    levelValue: Math.round(level * 10000) / 10000,
    levelLabel,
    distancePct: Math.round(distancePct * 10000) / 10000,
    distanceAtr,
    direction,
    velocity: Math.round(velocity * 10000) / 10000,
    etaBars: etaBars != null ? Math.round(etaBars * 10) / 10 : null,
    readiness,
    confirmations: confirmationsFor(quote, closes),
  }
}

/** Quote-only momentum: today's move toward the level (rising toward a level above, etc.). */
function quoteVelocityToward(quote, signed) {
  const price = num(quote?.price)
  const ref = num(quote?.open) ?? num(quote?.previousClose)
  if (price == null || ref == null || ref === 0) return null
  const movePct = ((price - ref) / ref) * 100 // today's move, %
  // signed < 0 → price below level → need it rising (movePct > 0) to converge; and vice-versa.
  return signed < 0 ? movePct : -movePct
}

/** Distance-%-to-static-level series from a close series (for multi-bar momentum). */
function distSeriesToLevel(closes, level, bars) {
  const n = closes.length
  const out = []
  for (let i = Math.max(0, n - bars - 1); i < n; i++) {
    out.push((Math.abs(closes[i] - level) / level) * 100)
  }
  return out
}

// ── Strategy registry ─────────────────────────────────────────────────────────

/** @type {Record<string, any>} */
export const STRATEGY_REGISTRY = {
  // ── VWAP proximity (ohlcv, intraday opt-in) ────────────────────────────────
  vwap_proximity: {
    id: 'vwap_proximity',
    label: 'Approaching VWAP',
    description:
      'Price is closing in on its volume-weighted average price (rolling daily VWAP, or intraday session VWAP) and converging toward it — a classic mean-reversion / support-resistance test.',
    dataTier: 'ohlcv',
    supportsIntraday: true,
    threshold: { label: 'Distance to VWAP', unit: '%', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    params: [
      { key: 'rollWindow', label: 'VWAP window (days)', type: 'int', min: 5, max: 100, step: 1, default: 20 },
      { key: 'velocityBars', label: 'Momentum lookback (bars)', type: 'int', min: 1, max: 10, step: 1, default: 3 },
    ],
    evaluate(ctx) {
      const { quote, params, thresholdValue } = ctx
      const price = num(quote?.price)
      if (price == null) return null
      const k = Math.max(1, Math.floor(params.velocityBars ?? 3))

      // Intraday session VWAP when requested and bars are available.
      if (ctx.intraday5m && ctx.intraday5m.length >= k + 2) {
        const series = computeCumulativeVwapSeries(ctx.intraday5m) // [{date, close, vwap}]
        const level = series[series.length - 1]?.vwap
        if (!Number.isFinite(level) || level === 0) return null
        const distSeries = series.slice(-(k + 1)).map((r) => (Math.abs(r.close - r.vwap) / r.vwap) * 100)
        const velocity = convergenceVelocity(distSeries, k)
        const signed = ((price - level) / level) * 100
        return finishProximity({
          symbol: ctx.symbol, price, level, levelLabel: 'Session VWAP', signed,
          thresholdValue, velocity, side: 'either', atrVal: null, quote, closes: null, targetBars: 6,
        })
      }

      // Daily rolling VWAP.
      const rows = ctx.dailyOhlcv
      if (!rows || rows.length < (params.rollWindow ?? 20) + k) return null
      const win = Math.max(2, Math.floor(params.rollWindow ?? 20))
      const series = computeRollingVwapSeries(rows, win) // [{date, close, vwap|null}]
      const last = series[series.length - 1]
      const level = last?.vwap
      if (!Number.isFinite(level) || level === 0) return null
      const tail = series.slice(-(k + 1))
      if (tail.some((r) => r.vwap == null)) return null
      const distSeries = tail.map((r) => (Math.abs(r.close - r.vwap) / r.vwap) * 100)
      const velocity = convergenceVelocity(distSeries, k)
      const signed = ((price - level) / level) * 100
      return finishProximity({
        symbol: ctx.symbol, price, level, levelLabel: `${win}d VWAP`, signed,
        thresholdValue, velocity, side: 'either', atrVal: atr14(rows), quote,
        closes: rows.map((r) => r.close),
      })
    },
  },

  // ── Moving-average crossover imminence (ohlcv) ─────────────────────────────
  ma_cross_approach: {
    id: 'ma_cross_approach',
    label: 'MA crossover imminent',
    description:
      'The fast SMA is converging toward the slow SMA (e.g. 5-day nearing 20-day) — the gap is narrowing and has not crossed yet, flagging an imminent golden/death cross.',
    dataTier: 'ohlcv',
    threshold: { label: 'Gap between MAs', unit: '%', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    params: [
      { key: 'fastWindow', label: 'Fast MA', type: 'int', min: 2, max: 100, step: 1, default: 5 },
      { key: 'slowWindow', label: 'Slow MA', type: 'int', min: 3, max: 250, step: 1, default: 20 },
    ],
    evaluate(ctx) {
      const { quote, params, thresholdValue } = ctx
      const price = num(quote?.price)
      const rows = ctx.dailyOhlcv
      const fastW = Math.max(2, Math.floor(params.fastWindow ?? 5))
      const slowW = Math.max(fastW + 1, Math.floor(params.slowWindow ?? 20))
      if (price == null || !rows || rows.length < slowW + 2) return null

      const closes = rows.map((r) => r.close)
      const fast = smaSeries(closes, fastW)
      const slow = smaSeries(closes, slowW)
      const i = closes.length - 1
      if (fast[i] == null || slow[i] == null || fast[i - 1] == null || slow[i - 1] == null) return null

      const gapNow = fast[i] - slow[i]
      const gapPrev = fast[i - 1] - slow[i - 1]
      // Already crossed (sign flipped) — no longer "approaching".
      if (Math.sign(gapNow) !== Math.sign(gapPrev) || gapNow === 0) return null

      const level = slow[i]
      const distancePct = (Math.abs(gapNow) / price) * 100
      const direction = gapNow < 0 ? 'golden_cross_imminent' : 'death_cross_imminent'

      if (distancePct > thresholdValue) return { symbol: ctx.symbol, matches: false, nearButStalled: false }

      const narrowing = Math.abs(gapNow) < Math.abs(gapPrev)
      if (!narrowing) {
        return { symbol: ctx.symbol, matches: false, nearButStalled: true, distancePct, direction }
      }
      const velocity = ((Math.abs(gapPrev) - Math.abs(gapNow)) / price) * 100 // %/bar
      const etaBars = velocity > 0 ? distancePct / velocity : null
      const atrVal = atr14(rows)
      return {
        symbol: ctx.symbol,
        matches: true,
        nearButStalled: false,
        price,
        levelValue: Math.round(level * 10000) / 10000,
        levelLabel: `${fastW}/${slowW} SMA cross`,
        distancePct: Math.round(distancePct * 10000) / 10000,
        distanceAtr: atrVal && atrVal > 0 ? Math.round(((price - level) / atrVal) * 100) / 100 : null,
        direction,
        velocity: Math.round(velocity * 10000) / 10000,
        etaBars: etaBars != null ? Math.round(etaBars * 10) / 10 : null,
        readiness: readinessScore({ distancePct, thresholdValue, etaBars, quote }),
        confirmations: confirmationsFor(quote, closes),
      }
    },
  },

  // ── RSI approaching an extreme (ohlcv) ─────────────────────────────────────
  rsi_extreme_approach: {
    id: 'rsi_extreme_approach',
    label: 'RSI nearing overbought/oversold',
    description:
      'RSI(14) is approaching 70 (overbought) or 30 (oversold) and still moving toward it — a momentum-exhaustion or reversal setup.',
    dataTier: 'ohlcv',
    threshold: { label: 'RSI points to extreme', unit: 'pts', min: 1, max: 15, step: 1, default: 5 },
    params: [
      { key: 'velocityBars', label: 'Momentum lookback (bars)', type: 'int', min: 1, max: 10, step: 1, default: 3 },
      { key: 'overbought', label: 'Overbought level', type: 'int', min: 60, max: 90, step: 1, default: 70 },
      { key: 'oversold', label: 'Oversold level', type: 'int', min: 10, max: 40, step: 1, default: 30 },
    ],
    evaluate(ctx) {
      const { quote, params, thresholdValue } = ctx
      const price = num(quote?.price)
      const rows = ctx.dailyOhlcv
      const k = Math.max(1, Math.floor(params.velocityBars ?? 3))
      const ob = params.overbought ?? 70
      const os = params.oversold ?? 30
      if (price == null || !rows || rows.length < 14 + k + 2) return null
      const closes = rows.map((r) => r.close)

      // Short tail of RSI values for momentum.
      const rsiTail = []
      for (let end = closes.length - k; end <= closes.length; end++) {
        rsiTail.push(rsiWilder(closes.slice(0, end), 14))
      }
      if (rsiTail.some((v) => v == null)) return null
      const rsi = rsiTail[rsiTail.length - 1]

      // Toward the nearer extreme.
      const target = rsi >= 50 ? ob : os
      const distToExtreme = Math.abs(target - rsi)
      if (rsi >= target && target === ob) return null // already overbought
      if (rsi <= target && target === os) return null // already oversold
      if (distToExtreme > thresholdValue) return { symbol: ctx.symbol, matches: false, nearButStalled: false }

      const distSeries = rsiTail.map((v) => Math.abs(target - v))
      const velocity = convergenceVelocity(distSeries, k) // RSI-points/bar toward extreme
      const direction = target === ob ? 'approaching_overbought' : 'approaching_oversold'
      if (velocity == null || velocity <= 0) {
        return { symbol: ctx.symbol, matches: false, nearButStalled: true, distancePct: distToExtreme, direction }
      }
      const etaBars = distToExtreme / velocity
      return {
        symbol: ctx.symbol,
        matches: true,
        nearButStalled: false,
        price,
        levelValue: target,
        levelLabel: target === ob ? `RSI ${ob}` : `RSI ${os}`,
        distancePct: Math.round(distToExtreme * 100) / 100,
        distanceAtr: null,
        direction,
        velocity: Math.round(velocity * 10000) / 10000,
        etaBars: Math.round(etaBars * 10) / 10,
        readiness: readinessScore({ distancePct: distToExtreme, thresholdValue, etaBars, quote }),
        confirmations: { ...confirmationsFor(quote, closes), rsi: Math.round(rsi * 10) / 10 },
      }
    },
  },

  // ── Bollinger band touch approach (ohlcv) ──────────────────────────────────
  bollinger_approach: {
    id: 'bollinger_approach',
    label: 'Approaching Bollinger band',
    description:
      'Price is nearing the upper or lower Bollinger band (20-day SMA ± 2σ) and converging — a volatility-breakout or reversion setup.',
    dataTier: 'ohlcv',
    threshold: { label: 'Distance to band', unit: '%', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    params: [
      { key: 'window', label: 'Window (days)', type: 'int', min: 5, max: 100, step: 1, default: 20 },
      { key: 'mult', label: 'Std-dev multiplier', type: 'float', min: 1, max: 4, step: 0.5, default: 2 },
      { key: 'velocityBars', label: 'Momentum lookback (bars)', type: 'int', min: 1, max: 10, step: 1, default: 3 },
    ],
    evaluate(ctx) {
      const { quote, params, thresholdValue } = ctx
      const price = num(quote?.price)
      const rows = ctx.dailyOhlcv
      const win = Math.max(5, Math.floor(params.window ?? 20))
      const mult = num(params.mult) ?? 2
      const k = Math.max(1, Math.floor(params.velocityBars ?? 3))
      if (price == null || !rows || rows.length < win + k + 1) return null
      const closes = rows.map((r) => r.close)
      const mid = smaSeries(closes, win)
      const sd = stddevSeries(closes, win)
      const i = closes.length - 1
      if (mid[i] == null || sd[i] == null) return null

      const upper = mid[i] + mult * sd[i]
      const lower = mid[i] - mult * sd[i]
      // Approach the nearer band.
      const toUpper = Math.abs(price - upper)
      const toLower = Math.abs(price - lower)
      const targetUpper = toUpper <= toLower
      const level = targetUpper ? upper : lower
      const signed = ((price - level) / level) * 100

      // Build distance series to the (approx-static) band level for momentum.
      const distSeries = distSeriesToLevel(closes, level, k)
      const velocity = convergenceVelocity(distSeries, k)
      return finishProximity({
        symbol: ctx.symbol, price, level,
        levelLabel: targetUpper ? `Upper band (${win},${mult}σ)` : `Lower band (${win},${mult}σ)`,
        signed, thresholdValue, velocity, side: 'either', atrVal: atr14(rows), quote, closes,
      })
    },
  },

  // ── 52-week high proximity (quote) ─────────────────────────────────────────
  near_52w_high: {
    id: 'near_52w_high',
    label: 'Approaching 52-week high',
    description: 'Price is nearing its 52-week high and rising toward it — a breakout watch.',
    dataTier: 'quote',
    threshold: { label: 'Distance to 52w high', unit: '%', min: 0.1, max: 10, step: 0.1, default: 1 },
    params: [],
    evaluate(ctx) {
      const { quote, thresholdValue } = ctx
      const price = num(quote?.price)
      const level = num(quote?.yearHigh)
      if (price == null || level == null || level === 0) return null
      const signed = ((price - level) / level) * 100 // ≤ 0 when below the high
      const velocity = quoteVelocityToward(quote, signed)
      return finishProximity({
        symbol: ctx.symbol, price, level, levelLabel: '52w high', signed,
        thresholdValue, velocity, side: 'below', atrVal: null, quote, closes: null, targetBars: 3,
      })
    },
  },

  // ── 52-week low proximity (quote) ──────────────────────────────────────────
  near_52w_low: {
    id: 'near_52w_low',
    label: 'Approaching 52-week low',
    description: 'Price is nearing its 52-week low and falling toward it — a breakdown / bounce watch.',
    dataTier: 'quote',
    threshold: { label: 'Distance to 52w low', unit: '%', min: 0.1, max: 10, step: 0.1, default: 1 },
    params: [],
    evaluate(ctx) {
      const { quote, thresholdValue } = ctx
      const price = num(quote?.price)
      const level = num(quote?.yearLow)
      if (price == null || level == null || level === 0) return null
      const signed = ((price - level) / level) * 100 // ≥ 0 when above the low
      const velocity = quoteVelocityToward(quote, signed)
      return finishProximity({
        symbol: ctx.symbol, price, level, levelLabel: '52w low', signed,
        thresholdValue, velocity, side: 'above', atrVal: null, quote, closes: null, targetBars: 3,
      })
    },
  },

  // ── 50-day MA proximity (quote) ────────────────────────────────────────────
  near_50dma: {
    id: 'near_50dma',
    label: 'Approaching 50-day MA',
    description: 'Price is converging on its 50-day moving average — a common dynamic support/resistance test.',
    dataTier: 'quote',
    threshold: { label: 'Distance to 50-DMA', unit: '%', min: 0.1, max: 10, step: 0.1, default: 1 },
    params: [],
    evaluate(ctx) {
      const { quote, thresholdValue } = ctx
      const price = num(quote?.price)
      const level = num(quote?.priceAvg50)
      if (price == null || level == null || level === 0) return null
      const signed = ((price - level) / level) * 100
      const velocity = quoteVelocityToward(quote, signed)
      return finishProximity({
        symbol: ctx.symbol, price, level, levelLabel: '50-DMA', signed,
        thresholdValue, velocity, side: 'either', atrVal: null, quote, closes: null, targetBars: 3,
      })
    },
  },

  // ── 200-day MA proximity (quote) ───────────────────────────────────────────
  near_200dma: {
    id: 'near_200dma',
    label: 'Approaching 200-day MA',
    description: 'Price is converging on its 200-day moving average — the key long-term trend line.',
    dataTier: 'quote',
    threshold: { label: 'Distance to 200-DMA', unit: '%', min: 0.1, max: 10, step: 0.1, default: 1 },
    params: [],
    evaluate(ctx) {
      const { quote, thresholdValue } = ctx
      const price = num(quote?.price)
      const level = num(quote?.priceAvg200)
      if (price == null || level == null || level === 0) return null
      const signed = ((price - level) / level) * 100
      const velocity = quoteVelocityToward(quote, signed)
      return finishProximity({
        symbol: ctx.symbol, price, level, levelLabel: '200-DMA', signed,
        thresholdValue, velocity, side: 'either', atrVal: null, quote, closes: null, targetBars: 3,
      })
    },
  },

  // ── Round-number proximity (quote) ─────────────────────────────────────────
  near_round_number: {
    id: 'near_round_number',
    label: 'Approaching round number',
    description: 'Price is nearing a psychological round-number level ($10 / $50 / $100 steps) and moving toward it.',
    dataTier: 'quote',
    threshold: { label: 'Distance to round #', unit: '%', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    params: [],
    evaluate(ctx) {
      const { quote, thresholdValue } = ctx
      const price = num(quote?.price)
      if (price == null || price <= 0) return null
      const inc = price < 10 ? 1 : price < 50 ? 5 : price < 100 ? 10 : price < 1000 ? 50 : 100
      const level = Math.round(price / inc) * inc
      if (level === 0) return null
      const signed = ((price - level) / level) * 100
      const velocity = quoteVelocityToward(quote, signed)
      return finishProximity({
        symbol: ctx.symbol, price, level, levelLabel: `$${level}`, signed,
        thresholdValue, velocity, side: 'either', atrVal: null, quote, closes: null, targetBars: 3,
      })
    },
  },

  // ── Gap-fill proximity (quote) ─────────────────────────────────────────────
  gap_fill: {
    id: 'gap_fill',
    label: 'Approaching gap fill',
    description:
      "Stock gapped from yesterday's close and price is retracing back toward it — a gap-fill setup (level = previous close).",
    dataTier: 'quote',
    threshold: { label: 'Distance to fill', unit: '%', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    params: [
      { key: 'minGapPct', label: 'Min opening gap', type: 'float', min: 0.5, max: 10, step: 0.5, default: 1 },
    ],
    evaluate(ctx) {
      const { quote, params, thresholdValue } = ctx
      const price = num(quote?.price)
      const level = num(quote?.previousClose)
      const open = num(quote?.open)
      if (price == null || level == null || level === 0 || open == null) return null
      const gapPct = ((open - level) / level) * 100
      const minGap = num(params.minGapPct) ?? 1
      if (Math.abs(gapPct) < minGap) return null // no meaningful gap today
      const signed = ((price - level) / level) * 100
      // Gap up → price should still be above prevClose (from_above, falling to fill); gap down → mirror.
      const side = gapPct > 0 ? 'above' : 'below'
      const velocity = quoteVelocityToward(quote, signed)
      return finishProximity({
        symbol: ctx.symbol, price, level, levelLabel: 'Prev close (gap fill)', signed,
        thresholdValue, velocity, side, atrVal: null, quote, closes: null, targetBars: 3,
      })
    },
  },

  // ── Opening-range break approach (intraday) ────────────────────────────────
  orb_approach: {
    id: 'orb_approach',
    label: 'Approaching opening-range break',
    description:
      "Price is nearing the first N-minute opening-range high (or low) and pressing toward it — an intraday breakout setup.",
    dataTier: 'intraday',
    threshold: { label: 'Distance to OR level', unit: '%', min: 0.1, max: 3, step: 0.1, default: 0.4 },
    params: [
      { key: 'openingMinutes', label: 'Opening range (min)', type: 'int', min: 5, max: 120, step: 5, default: 30 },
      { key: 'velocityBars', label: 'Momentum lookback (bars)', type: 'int', min: 1, max: 10, step: 1, default: 3 },
    ],
    evaluate(ctx) {
      const { quote, params, thresholdValue } = ctx
      const price = num(quote?.price)
      const bars = ctx.intraday5m
      const k = Math.max(1, Math.floor(params.velocityBars ?? 3))
      const openMin = Math.max(5, Math.floor(params.openingMinutes ?? 30))
      if (price == null || !bars || bars.length < k + 2) return null

      // Opening-range window: first `openMin` minutes from 09:30 ET.
      const cutoff = 9 * 60 + 30 + openMin
      let hi = -Infinity
      let lo = Infinity
      for (const b of bars) {
        const t = String(b.date ?? '').split(' ')[1]
        if (!t) continue
        const [hh, mm] = t.split(':').map(Number)
        const mins = hh * 60 + mm
        if (mins >= 9 * 60 + 30 && mins < cutoff) {
          const h = num(b.high) ?? num(b.close)
          const l = num(b.low) ?? num(b.close)
          if (h != null && h > hi) hi = h
          if (l != null && l < lo) lo = l
        }
      }
      if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null

      // Approach the nearer OR boundary; only "approaching" (not already broken).
      const toHigh = Math.abs(price - hi)
      const toLow = Math.abs(price - lo)
      const targetHigh = toHigh <= toLow
      const level = targetHigh ? hi : lo
      const signed = ((price - level) / level) * 100
      const closes = bars.slice(-(k + 1)).map((b) => num(b.close)).filter((c) => c != null)
      const distSeries = distSeriesToLevel(closes, level, k)
      const velocity = convergenceVelocity(distSeries, k)
      return finishProximity({
        symbol: ctx.symbol, price, level,
        levelLabel: targetHigh ? `OR high (${openMin}m)` : `OR low (${openMin}m)`,
        signed, thresholdValue,
        velocity,
        side: targetHigh ? 'below' : 'above', // approaching the high from below / the low from above
        atrVal: null, quote, closes: null, targetBars: 6,
      })
    },
  },

  // ── Gamma levels (Phase 2 — disabled until an options provider is wired) ────
  gamma_levels: {
    id: 'gamma_levels',
    label: 'Approaching call wall / put support',
    description:
      'Price is nearing a large options gamma level (call wall = resistance, put support). Requires an options-data provider (Phase 2).',
    dataTier: 'options',
    disabled: true,
    threshold: { label: 'Distance to level', unit: '%', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    params: [],
    evaluate() {
      return null // wired in Phase 2 via optionsProvider.getGammaLevels
    },
  },
}

/** Public metadata (no evaluate fn) for the UI / API. */
export function listStrategies({ includeDisabled = false } = {}) {
  return Object.values(STRATEGY_REGISTRY)
    .filter((s) => includeDisabled || !s.disabled)
    .map(({ id, label, description, dataTier, supportsIntraday, disabled, threshold, params }) => ({
      id, label, description, dataTier,
      supportsIntraday: Boolean(supportsIntraday),
      disabled: Boolean(disabled),
      threshold, params,
    }))
}

export function getStrategy(id) {
  return STRATEGY_REGISTRY[id] ?? null
}

/** Merge request params with each param's default and clamp to declared bounds. */
export function resolveParams(strategy, rawParams = {}) {
  const out = {}
  for (const p of strategy.params ?? []) {
    let v = rawParams[p.key]
    v = v == null || v === '' ? p.default : Number(v)
    if (!Number.isFinite(v)) v = p.default
    if (p.min != null) v = Math.max(p.min, v)
    if (p.max != null) v = Math.min(p.max, v)
    if (p.type === 'int') v = Math.round(v)
    out[p.key] = v
  }
  return out
}

/** Resolve + clamp the threshold value for a strategy from a raw request value. */
export function resolveThreshold(strategy, rawValue) {
  const t = strategy.threshold
  let v = rawValue == null || rawValue === '' ? t.default : Number(rawValue)
  if (!Number.isFinite(v)) v = t.default
  return Math.min(t.max, Math.max(t.min, v))
}
