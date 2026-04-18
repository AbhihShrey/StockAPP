import { fmpGet } from './fmp.js'

const CACHE_TTL_MS =
  Number(process.env.MARKET_DATA_CACHE_MS) ||
  Number(process.env.ALPHA_VANTAGE_CACHE_MS) ||
  10 * 60_000

let cache = { at: 0, key: '', value: null }

function now() {
  return Date.now()
}

function unwrapValue(v) {
  if (v === null || v === undefined) return null
  if (typeof v !== 'object') return v
  if (Array.isArray(v)) return v.length ? unwrapValue(v[0]) : null
  return (
    v.value ??
    v.raw ??
    v.val ??
    v.amount ??
    v.number ??
    v.result ??
    v.data ??
    null
  )
}

function firstNonEmpty(obj, keys) {
  for (const k of keys) {
    const v0 = obj?.[k]
    const v = unwrapValue(v0)
    if (v === null || v === undefined) continue
    const s = String(v).trim()
    if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') continue
    return v
  }
  return null
}

/**
 * @returns {'high' | 'medium' | 'low'}
 */
function parseImpactLevel(row) {
  const raw = row.impact ?? row.importance ?? row.priority ?? row.level ?? null
  if (raw === null || raw === undefined) return 'medium'
  const n = Number(raw)
  if (Number.isFinite(n)) {
    if (n >= 3) return 'high'
    if (n <= 1) return 'low'
    return 'medium'
  }
  const s = String(raw).toLowerCase().trim()
  if (s.includes('high') || s === 'h' || s.includes('***')) return 'high'
  if (s.includes('low') || s === 'l' || /\blow\b/.test(s)) return 'low'
  if (s.includes('medium') || s.includes('med') || s === 'm' || s.includes('**')) return 'medium'
  return 'medium'
}

function normalizeEconomicRow(row) {
  const actual = firstNonEmpty(row, [
    'actual',
    'actualValue',
    'actualCore',
    'actualResult',
    'reported',
    'reportedValue',
    'value',
    'data',
    'release',
  ])
  const estimate = firstNonEmpty(row, [
    'estimate',
    'estimated',
    'estimatedValue',
    'estimateValue',
    'forecast',
    'consensus',
    'expected',
    'expectedValue',
    'survey',
    'median',
    'mean',
    'projection',
  ])
  const previous = firstNonEmpty(row, [
    'previous',
    'previousValue',
    'prev',
    'prior',
    'last',
    'reference',
    'revised',
    'revisedPrevious',
    'previousRevised',
  ])

  return {
    date: row.date ?? row.time ?? row.eventDate ?? row.releaseDate ?? null,
    country: row.country ?? row.currency ?? null,
    event: row.event ?? row.title ?? row.name ?? row.indicator ?? 'Event',
    impactLevel: parseImpactLevel(row),
    unit: row.unit ?? null,
    actual,
    /** Forecast (FMP "estimate") */
    forecast: estimate,
    previous,
  }
}

function addDays(isoDateStr, days) {
  const d = new Date(`${isoDateStr}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Macro economic calendar for a 7-day window starting at `date` (inclusive).
 */
export async function getEconomicCalendarRange(dateParam) {
  const anchor = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10)
  const from = anchor
  const to = addDays(anchor, 6)
  const key = `${from}_${to}`
  const age = now() - cache.at
  if (cache.value && cache.key === key && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  let rows = []
  try {
    rows = await fmpGet('/economic-calendar', { from, to })
  } catch {
    rows = []
  }

  const normalized = (Array.isArray(rows) ? rows : [])
    .map(normalizeEconomicRow)
    .slice()
    .sort((a, b) => {
      const da = String(a.date ?? '')
      const db = String(b.date ?? '')
      if (da !== db) return da.localeCompare(db)
      return String(a.event ?? '').localeCompare(String(b.event ?? ''))
    })

  const value = {
    asOf: new Date().toISOString(),
    source: 'fmp',
    range: { from, to },
    rows: normalized,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }
  cache = { at: now(), key, value }
  return value
}
