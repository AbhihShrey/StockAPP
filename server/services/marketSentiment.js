import { fmpGet } from './fmp.js'

const CACHE_TTL_MS =
  Number(process.env.MARKET_DATA_CACHE_MS) ||
  Number(process.env.ALPHA_VANTAGE_CACHE_MS) ||
  2 * 60_000

const CNN_GRAPH =
  'https://production.dataviz.cnn.io/index/fearandgreed/graphdata'

let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

function clamp(min, max, x) {
  return Math.min(max, Math.max(min, x))
}

/**
 * Map VIX to greed 0–100 (lower vol ≈ more greed).
 */
function vixLevelToGreed(vix) {
  if (vix === null || !Number.isFinite(vix)) return null
  const lo = 12
  const hi = 38
  const t = (hi - vix) / (hi - lo)
  return clamp(0, 100, t * 100)
}

/**
 * Equity put/call style ratio: lower ≈ more call-heavy / greed.
 */
function putCallRatioToGreed(ratio) {
  if (ratio === null || !Number.isFinite(ratio)) return null
  const lo = 0.55
  const hi = 1.12
  const t = (hi - ratio) / (hi - lo)
  return clamp(0, 100, t * 100)
}

function sentimentLabel(score) {
  if (score == null || !Number.isFinite(score)) return { key: 'unknown', label: '—' }
  if (score <= 20) return { key: 'extreme_fear', label: 'Extreme fear' }
  if (score <= 40) return { key: 'fear', label: 'Fear' }
  if (score <= 55) return { key: 'neutral', label: 'Neutral' }
  if (score <= 75) return { key: 'greed', label: 'Greed' }
  return { key: 'extreme_greed', label: 'Extreme greed' }
}

async function fetchVixQuote() {
  const data = await fmpGet('/quote', { symbol: '^VIX' })
  const arr = Array.isArray(data) ? data : []
  const row = arr[0]
  const price = row ? Number(row.price) : null
  return Number.isFinite(price) ? price : null
}

/**
 * CBOE equity put/call is paywalled on FMP for many keys; we use CNN Fear & Greed
 * “put_call_options” series, whose points are the underlying ratio values.
 */
async function fetchPutCallRatioFromCnn() {
  const res = await fetch(CNN_GRAPH, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.cnn.com/markets/fear-and-greed',
      Origin: 'https://www.cnn.com',
    },
  })
  if (!res.ok) {
    const err = new Error(`CNN HTTP ${res.status}`)
    err.code = 'SENTIMENT_HTTP'
    throw err
  }
  const json = await res.json()
  const series = json?.put_call_options
  const data = Array.isArray(series?.data) ? series.data : []
  if (data.length === 0) return { ratio: null, raw: null }
  const last = data[data.length - 1]
  const y = last?.y
  const ratio = typeof y === 'number' && Number.isFinite(y) ? y : null
  return { ratio, raw: series }
}

/**
 * Weighted 0–100 score: VIX (FMP) + put/call ratio (CNN auxiliary feed; FMP ^CPC unavailable on typical plans).
 */
export async function getMarketSentiment() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const [vix, pc] = await Promise.all([fetchVixQuote(), fetchPutCallRatioFromCnn()])

  const wVix = 0.55
  const wPc = 0.45

  const gVix = vixLevelToGreed(vix)
  const gPc = putCallRatioToGreed(pc.ratio)

  let score = null
  if (gVix != null && gPc != null) score = wVix * gVix + wPc * gPc
  else if (gVix != null) score = gVix
  else if (gPc != null) score = gPc

  score = score == null ? null : Math.round(score * 10) / 10

  const { key, label } = sentimentLabel(score)

  const value = {
    asOf: new Date().toISOString(),
    score,
    label,
    labelKey: key,
    vix: vix == null ? null : Math.round(vix * 100) / 100,
    putCallRatio: pc.ratio == null ? null : Math.round(pc.ratio * 1000) / 1000,
    putCallSource: pc.ratio == null ? null : 'cnn_put_call_series',
    weights: { vix: wVix, putCall: wPc },
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }
  cache = { at: now(), value }
  return value
}
