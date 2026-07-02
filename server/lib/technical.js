/** @param {number[]} closes oldest → newest */

export function pctChangeOverLag(closes, tradingDayLag) {
  if (!closes?.length || tradingDayLag < 1) return null
  if (closes.length <= tradingDayLag) return null
  const last = closes[closes.length - 1]
  const prev = closes[closes.length - 1 - tradingDayLag]
  if (prev == null || prev === 0 || last == null) return null
  return (last / prev - 1) * 100
}

/** Wilder RSI (last value). */
export function rsiWilder(closes, period = 14) {
  if (!closes?.length || closes.length < period + 1) return null

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) avgGain += diff
    else avgLoss -= diff
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const g = diff > 0 ? diff : 0
    const l = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function emaSeries(values, span) {
  if (!values.length) return []
  const k = 2 / (span + 1)
  const out = [values[0]]
  let e = values[0]
  for (let i = 1; i < values.length; i++) {
    e = values[i] * k + e * (1 - k)
    out.push(e)
  }
  return out
}

/**
 * Simple moving average series, aligned to `values` (oldest → newest).
 * Entries before a full `window` is available are `null`.
 * @param {number[]} values
 * @param {number} window
 * @returns {(number|null)[]}
 */
export function smaSeries(values, window) {
  const n = values?.length ?? 0
  const out = new Array(n).fill(null)
  if (n === 0 || window < 1) return out
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    if (i >= window - 1) out[i] = sum / window
  }
  return out
}

/**
 * Rolling population standard-deviation series, aligned to `values`.
 * Entries before a full `window` is available are `null`.
 * @returns {(number|null)[]}
 */
export function stddevSeries(values, window) {
  const n = values?.length ?? 0
  const out = new Array(n).fill(null)
  if (n === 0 || window < 1) return out
  const means = smaSeries(values, window)
  for (let i = window - 1; i < n; i++) {
    const mean = means[i]
    if (mean == null) continue
    let acc = 0
    for (let j = i - window + 1; j <= i; j++) {
      const d = values[j] - mean
      acc += d * d
    }
    out[i] = Math.sqrt(acc / window)
  }
  return out
}

/**
 * Wilder ATR (last value) from OHLC bars (oldest → newest).
 * @param {Array<{ high: number, low: number, close: number }>} bars
 * @param {number} period
 * @returns {number | null}
 */
export function atr14(bars, period = 14) {
  if (!bars?.length || bars.length < period + 1) return null
  const trs = []
  for (let i = 1; i < bars.length; i++) {
    const h = Number(bars[i].high)
    const l = Number(bars[i].low)
    const pc = Number(bars[i - 1].close)
    if (![h, l, pc].every(Number.isFinite)) return null
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  if (trs.length < period) return null
  // Seed with the simple average of the first `period` true ranges, then Wilder-smooth.
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
  }
  return Number.isFinite(atr) ? atr : null
}

/**
 * Convergence velocity of a distance series (oldest → newest): the average
 * per-bar *shrinkage* of the distance over the last `k` bars.
 * Positive → the value is moving toward the target (converging); ≤ 0 → flat or diverging.
 * @param {(number|null)[]} distSeries  distance-to-target per bar (same units throughout)
 * @param {number} k lookback in bars
 * @returns {number | null}
 */
export function convergenceVelocity(distSeries, k = 3) {
  if (!distSeries?.length || k < 1) return null
  const n = distSeries.length
  if (n < k + 1) return null
  const dNow = distSeries[n - 1]
  const dPast = distSeries[n - 1 - k]
  if (dNow == null || dPast == null || !Number.isFinite(dNow) || !Number.isFinite(dPast)) return null
  return (dPast - dNow) / k
}

/**
 * MACD(12,26,9) — returns last line, signal, histogram or null.
 * @returns {{ line: number, signal: number, histogram: number } | null}
 */
export function macdLast(closes, fast = 12, slow = 26, signalLen = 9) {
  if (!closes?.length || closes.length < slow + signalLen + 2) return null
  const emaF = emaSeries(closes, fast)
  const emaS = emaSeries(closes, slow)
  const macdLine = closes.map((_, i) => emaF[i] - emaS[i])
  const sig = emaSeries(macdLine, signalLen)
  const i = closes.length - 1
  const line = macdLine[i]
  const signal = sig[i]
  if (line == null || signal == null || !Number.isFinite(line) || !Number.isFinite(signal)) return null
  return { line, signal, histogram: line - signal }
}

export function trendFromIndicators(rsi, macd) {
  if (rsi == null || !macd) return 'Neutral'
  const { line, signal, histogram } = macd
  if (rsi >= 55 && line >= signal && histogram >= 0) return 'Bullish'
  if (rsi <= 45 && line <= signal && histogram <= 0) return 'Bearish'
  return 'Neutral'
}
