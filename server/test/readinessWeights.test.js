// Set weights BEFORE importing the registry — readiness weights are read lazily + memoized.
// Pure proximity (1/0/0) makes the readiness score deterministic and easy to assert.
process.env.READINESS_WEIGHT_PROXIMITY = '1'
process.env.READINESS_WEIGHT_MOMENTUM = '0'
process.env.READINESS_WEIGHT_VOLUME = '0'

import test from 'node:test'
import assert from 'node:assert/strict'
import { STRATEGY_REGISTRY } from '../lib/screenerStrategies.js'

test('readiness weights honor env override (pure proximity → readiness = 100·closeness)', () => {
  const high = STRATEGY_REGISTRY.near_52w_high
  // price 99.5 vs 100 high, threshold 1% → distance 0.5% → closeness = 1 - 0.5/1 = 0.5.
  // open 99 → rising toward the high, so the momentum gate passes and it matches.
  const r = high.evaluate({
    symbol: 'T',
    quote: { price: 99.5, yearHigh: 100, open: 99 },
    params: {},
    thresholdValue: 1,
  })
  assert.equal(r.matches, true)
  assert.equal(r.readiness, 50) // 100 · (1·0.5 + 0·m + 0·c)
})
