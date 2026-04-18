import { fmpGet } from './fmp.js'

const CACHE_TTL_MS = Number(process.env.PREDICTIVE_VOL_CACHE_MS) || 60_000
let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

function toNum(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

function std(values) {
  const xs = values.filter((v) => v != null && Number.isFinite(v))
  if (xs.length < 3) return null
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

async function fetch5m(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  const data = await fmpGet('/historical-chart/5min', { symbol: sym })
  return Array.isArray(data) ? data : []
}

/**
 * Expected next-hour vol proxy:
 * - realized std dev of last 12×5m log returns, annualization not needed (we report %/hour)
 * - scaled by volume spike factor vs last 2 hours
 */
function expectedVolNextHourPct(rows) {
  // FMP returns newest-first often; normalize oldest->newest
  const arr = [...rows].reverse()
  const closes = arr.map((r) => toNum(r.close)).filter((v) => v != null)
  const vols = arr.map((r) => toNum(r.volume) ?? 0)
  if (closes.length < 20) return { volPct: null, volSpike: null }

  const rets = []
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1]
    const b = closes[i]
    if (!a || !b || a <= 0 || b <= 0) continue
    rets.push(Math.log(b / a))
  }
  const last = rets.slice(-12)
  const s = std(last)
  const volPct = s == null ? null : Math.abs(s) * 100

  const volNow = vols.slice(-1)[0] ?? 0
  const volBase = vols.slice(-24, -1) // previous ~2 hours
  const baseAvg = volBase.length ? volBase.reduce((a, b) => a + b, 0) / volBase.length : null
  const spike = baseAvg && baseAvg > 0 ? volNow / baseAvg : null
  return { volPct, volSpike: spike }
}

export async function getVolatilityHeatmap() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const symbols = [
    { symbol: 'SPY', label: 'SPY' },
    { symbol: 'QQQ', label: 'QQQ' },
    { symbol: 'IWM', label: 'IWM' },
    { symbol: 'XLK', label: 'XLK' },
    { symbol: 'XLF', label: 'XLF' },
    { symbol: 'XLE', label: 'XLE' },
    { symbol: 'XLV', label: 'XLV' },
    { symbol: 'XLY', label: 'XLY' },
  ]

  const rows = await Promise.all(
    symbols.map(async (s) => {
      const data = await fetch5m(s.symbol).catch(() => [])
      const { volPct, volSpike } = expectedVolNextHourPct(data)
      // score 0–100: combines vol and spike for heat coloring
      const score =
        volPct == null
          ? null
          : Math.max(
              0,
              Math.min(100, Math.round((volPct * 28 + (volSpike ?? 1) * 10) * 10) / 10),
            )
      return {
        symbol: s.symbol,
        label: s.label,
        expectedVolNextHourPct: volPct == null ? null : Math.round(volPct * 100) / 100,
        volumeSpike: volSpike == null ? null : Math.round(volSpike * 100) / 100,
        score,
      }
    }),
  )

  const value = {
    asOf: new Date().toISOString(),
    source: 'fmp',
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
    rows,
    methodology: 'Proxy: std dev of last 12×5m log returns (≈ 1 hour) and a volume spike factor vs last ~2 hours.',
  }
  cache = { at: now(), value }
  return value
}

