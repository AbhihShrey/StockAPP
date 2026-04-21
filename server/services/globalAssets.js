import { fetchBatchQuotesBySymbols, fetchHistoricalEodLight, fmpGet } from './fmp.js'
import { quoteSnapshotCacheMs } from './marketQuoteCacheMs.js'

const CACHE_TTL_MS = quoteSnapshotCacheMs()

let cache = { at: 0, value: null }

function now() {
  return Date.now()
}

function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(
    String(value)
      .replace(/[%,$\s]/g, '')
      .replace(/,/g, '')
      .trim(),
  )
  return Number.isFinite(n) ? n : null
}

/**
 * Recent daily closes (oldest → newest) for mini sparklines (~last 8 sessions).
 * FMP `/historical-price-eod/light` is newest-first.
 */
function sparklineFromLight(rows, maxPoints = 8) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const slice = rows.slice(0, Math.min(maxPoints, rows.length))
  const closes = slice
    .map((r) => toNumber(r.price ?? r.close))
    .filter((n) => n != null && Number.isFinite(n))
  return closes.reverse()
}

/**
 * 2Y / 10Y Treasury yields (%) and day-over-day % change from FMP curve.
 */
async function fetchTreasuryPair() {
  const data = await fmpGet('/treasury-rates')
  const arr = Array.isArray(data) ? data : []
  const today = arr[0]
  const prev = arr[1]
  if (!today || prev == null) return { y2: null, y10: null }

  const y2 = toNumber(today.year2)
  const y2p = toNumber(prev.year2)
  const y10 = toNumber(today.year10)
  const y10p = toNumber(prev.year10)

  const pct = (y, y0) => {
    if (y === null || y0 === null || y0 === 0) return null
    return ((y - y0) / y0) * 100
  }

  return {
    y2:
      y2 === null
        ? null
        : {
            symbol: '2Y',
            label: '2Y Treasury',
            hint: 'UST 2Y (curve)',
            price: y2,
            changePercent: pct(y2, y2p),
            unit: 'pct',
            category: 'yield',
            fmpSymbol: 'treasury-rates',
          },
    y10:
      y10 === null
        ? null
        : {
            symbol: '10Y',
            label: '10Y Treasury',
            hint: 'UST 10Y (curve)',
            price: y10,
            changePercent: pct(y10, y10p),
            unit: 'pct',
            category: 'yield',
            fmpSymbol: 'treasury-rates',
          },
  }
}

const INDEX_DEFS = [
  { symbol: 'SPY', label: 'S&P 500', hint: 'SPY — large caps' },
  { symbol: 'QQQ', label: 'Nasdaq 100', hint: 'QQQ — growth / tech' },
  { symbol: 'DIA', label: 'Dow Jones', hint: 'DIA — industrials' },
  { symbol: 'IWM', label: 'Russell 2000', hint: 'IWM — small caps' },
]

/**
 * Cross-asset snapshot: major ETFs, yields, USD proxy, gold, oil, bitcoin.
 */
export async function getGlobalAssets() {
  const age = now() - cache.at
  if (cache.value && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const indexSyms = INDEX_DEFS.map((d) => d.symbol)
  const quoteSyms = [...indexSyms, 'UUP', 'GCUSD', 'CLUSD', 'BTCUSD']

  const [treasury, quoteMap, ...indexLights] = await Promise.all([
    fetchTreasuryPair(),
    fetchBatchQuotesBySymbols(quoteSyms),
    ...indexSyms.map((s) => fetchHistoricalEodLight(s)),
  ])

  const indices = INDEX_DEFS.map((def, i) => {
    const q = quoteMap.get(def.symbol)
    const sparkline = sparklineFromLight(indexLights[i])
    if (!q || q.price == null) {
      return {
        symbol: def.symbol,
        label: def.label,
        hint: def.hint,
        price: null,
        changePercent: null,
        unit: 'usd',
        category: 'index',
        fmpSymbol: def.symbol,
        sparkline: sparkline.length ? sparkline : null,
      }
    }
    return {
      symbol: def.symbol,
      label: def.label,
      hint: def.hint,
      price: q.price,
      changePercent: q.changePercent,
      unit: 'usd',
      category: 'index',
      fmpSymbol: def.symbol,
      sparkline: sparkline.length ? sparkline : null,
    }
  })

  const uup = quoteMap.get('UUP')
  const gold = quoteMap.get('GCUSD')
  const oil = quoteMap.get('CLUSD')
  const btc = quoteMap.get('BTCUSD')

  const commodities = [
    gold
      ? {
          symbol: 'GCUSD',
          label: 'Gold',
          hint: 'COMEX gold (GC)',
          price: gold.price,
          changePercent: gold.changePercent,
          unit: 'usd',
          category: 'commodity',
          fmpSymbol: 'GCUSD',
        }
      : null,
    oil
      ? {
          symbol: 'CLUSD',
          label: 'WTI Oil',
          hint: 'Crude oil (CL)',
          price: oil.price,
          changePercent: oil.changePercent,
          unit: 'usd',
          category: 'commodity',
          fmpSymbol: 'CLUSD',
        }
      : null,
    btc
      ? {
          symbol: 'BTCUSD',
          label: 'Bitcoin',
          hint: 'BTC / USD',
          price: btc.price,
          changePercent: btc.changePercent,
          unit: 'usd',
          category: 'crypto',
          fmpSymbol: 'BTCUSD',
        }
      : null,
  ].filter(Boolean)

  const currencies = uup
    ? [
        {
          symbol: 'UUP',
          label: 'DXY (proxy)',
          hint: 'UUP — USD index ETF (DXY proxy)',
          price: uup.price,
          changePercent: uup.changePercent,
          unit: 'usd',
          category: 'currency',
          fmpSymbol: 'UUP',
        },
      ]
    : []

  const yields = [treasury.y2, treasury.y10].filter(Boolean)

  /** Flat list for marquee + backward compatibility */
  const assets = [...indices, ...yields, ...commodities, ...currencies].filter(Boolean)

  const value = {
    asOf: new Date().toISOString(),
    source: 'fmp',
    groups: {
      indices,
      yields,
      commodities,
      currencies,
    },
    assets,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }
  cache = { at: now(), value }
  return value
}
