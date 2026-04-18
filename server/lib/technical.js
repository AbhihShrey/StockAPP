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

function emaSeries(values, span) {
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
