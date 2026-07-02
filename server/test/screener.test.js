import test from 'node:test'
import assert from 'node:assert/strict'
import {
  smaSeries,
  stddevSeries,
  atr14,
  convergenceVelocity,
} from '../lib/technical.js'
import { STRATEGY_REGISTRY } from '../lib/screenerStrategies.js'

// ── indicator building blocks ───────────────────────────────────────────────

test('smaSeries: trailing average, null before full window', () => {
  assert.deepEqual(smaSeries([1, 2, 3, 4, 5], 2), [null, 1.5, 2.5, 3.5, 4.5])
})

test('stddevSeries: population std over window', () => {
  const s = stddevSeries([2, 4, 4, 6], 2)
  assert.equal(s[0], null)
  assert.ok(Math.abs(s[1] - 1) < 1e-9) // mean 3, sqrt(((2-3)^2+(4-3)^2)/2)=1
})

test('atr14: null with too few bars, finite otherwise', () => {
  assert.equal(atr14([{ high: 1, low: 0, close: 0.5 }], 14), null)
  const bars = Array.from({ length: 20 }, (_, i) => ({ high: i + 1.5, low: i + 0.5, close: i + 1 }))
  const a = atr14(bars, 14)
  assert.ok(Number.isFinite(a) && a > 0)
})

test('convergenceVelocity: positive when distance shrinks, negative when it grows', () => {
  assert.equal(convergenceVelocity([3, 2, 1], 2), 1) // (3-1)/2
  assert.equal(convergenceVelocity([1, 2, 3], 2), -1)
  assert.equal(convergenceVelocity([1, 2], 3), null) // not enough points
})

// ── near_52w_high: quote-tier two-gate logic (proximity + momentum) ──────────

const high = STRATEGY_REGISTRY.near_52w_high
function highCtx(quote, thresholdValue = 1) {
  return { symbol: 'T', quote, params: {}, thresholdValue }
}

test('near_52w_high: within band AND rising toward high → matches', () => {
  const r = high.evaluate(highCtx({ price: 99, yearHigh: 100, open: 98, volume: 120, avgVolume: 100 }))
  assert.equal(r.matches, true)
  assert.equal(r.direction, 'from_below')
  assert.ok(r.readiness > 0)
  assert.ok(r.etaBars > 0)
})

test('near_52w_high: within band but falling away → excluded, counted as nearButStalled', () => {
  const r = high.evaluate(highCtx({ price: 99, yearHigh: 100, open: 100, volume: 100, avgVolume: 100 }))
  assert.equal(r.matches, false)
  assert.equal(r.nearButStalled, true)
})

test('near_52w_high: already broken above the high → not a candidate (null)', () => {
  const r = high.evaluate(highCtx({ price: 101, yearHigh: 100, open: 100 }))
  assert.equal(r, null)
})

test('near_52w_high: too far from the high → excluded, NOT stalled', () => {
  const r = high.evaluate(highCtx({ price: 95, yearHigh: 100, open: 94 }))
  assert.equal(r.matches, false)
  assert.equal(r.nearButStalled, false)
})

// ── gap_fill: side + momentum toward previous close ──────────────────────────

test('gap_fill: gapped up and retracing toward prev close → matches', () => {
  const gap = STRATEGY_REGISTRY.gap_fill
  // prevClose 100, opened at 103 (gap up 3%), now 100.3 falling back toward the fill
  const r = gap.evaluate({
    symbol: 'G',
    quote: { price: 100.3, previousClose: 100, open: 103, volume: 100, avgVolume: 100 },
    params: { minGapPct: 1 },
    thresholdValue: 0.5,
  })
  assert.equal(r.matches, true)
  assert.equal(r.direction, 'from_above')
})

test('gap_fill: no meaningful gap → not applicable (null)', () => {
  const gap = STRATEGY_REGISTRY.gap_fill
  const r = gap.evaluate({
    symbol: 'G',
    quote: { price: 100.1, previousClose: 100, open: 100.05 },
    params: { minGapPct: 1 },
    thresholdValue: 0.5,
  })
  assert.equal(r, null)
})

// ── vwap_proximity (daily): converging vs flat ───────────────────────────────

const vwap = STRATEGY_REGISTRY.vwap_proximity
function flatBars(values) {
  return values.map((v, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    open: v, high: v, low: v, close: v, volume: 1,
  }))
}

test('vwap_proximity: price easing toward VWAP over last bars → matches', () => {
  // 24 flat bars at 100, then a tail that steps down monotonically toward the VWAP band.
  const closes = [...Array(24).fill(100), 100.8, 100.6, 100.4, 100.2]
  const rows = flatBars(closes)
  const ctx = {
    symbol: 'V',
    quote: { price: 100.2, open: 100.9, volume: 100, avgVolume: 100 },
    dailyOhlcv: rows,
    params: { rollWindow: 20, velocityBars: 3 },
    thresholdValue: 0.5,
  }
  const r = vwap.evaluate(ctx)
  assert.ok(r && r.matches === true, 'expected a converging VWAP match')
  assert.ok(r.etaBars >= 0)
})

test('vwap_proximity: dead-flat price (no momentum) → excluded as stalled', () => {
  const rows = flatBars(Array(28).fill(100))
  const ctx = {
    symbol: 'V',
    quote: { price: 100, open: 100, volume: 100, avgVolume: 100 },
    dailyOhlcv: rows,
    params: { rollWindow: 20, velocityBars: 3 },
    thresholdValue: 0.5,
  }
  const r = vwap.evaluate(ctx)
  assert.equal(r.matches, false)
  assert.equal(r.nearButStalled, true)
})

// ── ma_cross_approach: narrowing (matches) vs already crossed (null) ─────────

const ma = STRATEGY_REGISTRY.ma_cross_approach

test('ma_cross_approach: fast converging up toward slow, not yet crossed → matches (golden)', () => {
  // Downtrend then a recovery so the 5-SMA rises toward the 20-SMA from below.
  const down = Array.from({ length: 22 }, (_, i) => 120 - i) // 120..99
  const up = [101, 103, 105, 107, 109] // recovery pulls the fast MA up toward the slow MA
  const closes = [...down, ...up]
  const rows = closes.map((c, i) => ({ date: `d${i}`, open: c, high: c, low: c, close: c, volume: 1 }))
  const r = ma.evaluate({
    symbol: 'M',
    quote: { price: closes[closes.length - 1], volume: 100, avgVolume: 100 },
    dailyOhlcv: rows,
    params: { fastWindow: 5, slowWindow: 20 },
    thresholdValue: 5, // generous band so the test targets the narrowing/direction logic
  })
  assert.ok(r && r.matches === true, 'expected an imminent-cross match')
  assert.equal(r.direction, 'golden_cross_imminent')
  assert.ok(r.etaBars > 0)
})

test('ma_cross_approach: steady uptrend (already crossed / diverging) → not a fresh match', () => {
  const closes = Array.from({ length: 30 }, (_, i) => 100 + i) // fast far above slow, gap widening
  const rows = closes.map((c, i) => ({ date: `d${i}`, open: c, high: c, low: c, close: c, volume: 1 }))
  const r = ma.evaluate({
    symbol: 'M',
    quote: { price: closes[closes.length - 1], volume: 100, avgVolume: 100 },
    dailyOhlcv: rows,
    params: { fastWindow: 5, slowWindow: 20 },
    thresholdValue: 0.5,
  })
  // Either too far (matches:false) — the gap is wide in a steady trend.
  assert.ok(!r || r.matches === false)
})
