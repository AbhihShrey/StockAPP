import { fetchCompanyProfilesMap, fetchEarningsReportsMap, fmpGet } from './fmp.js'

const CACHE_TTL_MS =
  Number(process.env.MARKET_DATA_CACHE_MS) ||
  Number(process.env.ALPHA_VANTAGE_CACHE_MS) ||
  10 * 60_000

let cache = { at: 0, key: '', value: null }

function now() {
  return Date.now()
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function todayISO() {
  return isoDate(new Date())
}

function firstNonEmpty(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v === null || v === undefined) continue
    const s = String(v).trim()
    if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') continue
    return v
  }
  return null
}

function toNumberLoose(value) {
  if (value === null || value === undefined) return null
  const n = Number(
    String(value)
      .replace(/[%,$\s]/g, '')
      .replace(/,/g, '')
      .trim(),
  )
  return Number.isFinite(n) ? n : null
}

function normalizeEarningsRow(row) {
  const symbol = String(row.symbol ?? row.ticker ?? '')
    .trim()
    .toUpperCase()

  const epsActual = firstNonEmpty(row, [
    'eps',
    'epsActual',
    'epsReported',
    'actualEps',
    'actual',
    'reportedEps',
    'reportedEPS',
    'reported',
  ])
  const epsEstimate = firstNonEmpty(row, [
    'epsEstimated',
    'epsEstimate',
    'estimatedEps',
    'estimatedEPS',
    'epsExpected',
    'expectedEps',
    'consensusEps',
    'meanEps',
    'medianEps',
    'forecastEps',
  ])

  const date = row.date ?? row.earningsDate ?? row.fiscalDateEnding ?? row.epsDate ?? null
  const name = row.name ?? row.companyName ?? row.company ?? null

  const a = toNumberLoose(epsActual)
  const e = toNumberLoose(epsEstimate)

  let surprisePct = null
  if (a != null && e != null && Number.isFinite(a) && Number.isFinite(e) && Math.abs(e) > 1e-9) {
    surprisePct = ((a - e) / Math.abs(e)) * 100
  }

  let result = null
  if (a != null && e != null && Number.isFinite(a) && Number.isFinite(e)) {
    if (a > e) result = 'BEAT'
    else if (a < e) result = 'MISS'
    else result = 'MEET'
  }

  const when = String(row.time ?? row.hour ?? row.session ?? '').toLowerCase()
  let sessionHint = null
  if (when.includes('amc') || when.includes('after') || when.includes('close')) {
    sessionHint = 'amc'
  } else if (when.includes('bmo') || when.includes('before') || when.includes('open')) {
    sessionHint = 'bmo'
  }

  return {
    date,
    symbol: symbol || null,
    name,
    sector: row.sector ?? null,
    epsActual,
    epsEstimate,
    epsActualNum: a,
    epsEstimateNum: e,
    surprisePct,
    result,
    time: when || null,
    sessionHint,
  }
}

/**
 * Earnings calendar for a single day.
 * - Pulls FMP `/earnings-calendar`
 * - Enriches with `/profile` (name/sector) and `/earnings` (backfill EPS when sparse)
 */
export async function getEarningsCalendarForDate(dateParam) {
  const date = dateParam || todayISO()
  const key = date
  const age = now() - cache.at
  if (cache.value && cache.key === key && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  let rows = []
  try {
    rows = await fmpGet('/earnings-calendar', { from: date, to: date })
  } catch {
    rows = []
  }

  let normalized = (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a, b) => String((b?.eps ?? b?.epsActual ?? b?.epsReported) ?? '').localeCompare(String((a?.eps ?? a?.epsActual ?? a?.epsReported) ?? '')))
    .map(normalizeEarningsRow)

  const needProfile = normalized.filter((r) => r.symbol && (!r.name || !r.sector)).slice(0, 120)
  const symForProfile = needProfile.map((r) => r.symbol)
  const profiles = await fetchCompanyProfilesMap(symForProfile, { maxSymbols: 120, concurrency: 10 })

  normalized = normalized.map((r) => {
    if (!r.symbol) return r
    const p = profiles.get(r.symbol)
    if (!p) return r
    return {
      ...r,
      name: r.name ?? p.companyName ?? null,
      sector: r.sector ?? p.sector ?? null,
    }
  })

  const needEpsBackfill = normalized
    .filter((r) => r.symbol && (r.epsActual == null || r.epsEstimate == null))
    .slice(0, 60)
  const epsSymbols = needEpsBackfill.map((r) => r.symbol)
  const earningsReportsBySymbol = await fetchEarningsReportsMap(epsSymbols, { maxSymbols: 60, concurrency: 6 })

  function dayKey(s) {
    return s ? String(s).slice(0, 10) : null
  }

  normalized = normalized.map((r) => {
    if (!r.symbol) return r
    if (r.epsActual != null && r.epsEstimate != null) return r
    const rowsForSym = earningsReportsBySymbol.get(r.symbol)
    if (!Array.isArray(rowsForSym) || rowsForSym.length === 0) return r
    const target = dayKey(r.date)
    const match =
      (target ? rowsForSym.find((x) => dayKey(x?.date) === target) : null) ??
      rowsForSym[0]
    if (!match) return r
    const back = normalizeEarningsRow({ ...match, symbol: r.symbol, name: r.name, sector: r.sector })
    return {
      ...r,
      epsActual: r.epsActual ?? back.epsActual,
      epsEstimate: r.epsEstimate ?? back.epsEstimate,
      epsActualNum: r.epsActualNum ?? back.epsActualNum,
      epsEstimateNum: r.epsEstimateNum ?? back.epsEstimateNum,
      surprisePct: r.surprisePct ?? back.surprisePct,
      result: r.result ?? back.result,
    }
  })

  // Sort: strongest beats at top, then others by surprise descending, then symbol
  normalized.sort((a, b) => {
    const sa = a.surprisePct ?? -Infinity
    const sb = b.surprisePct ?? -Infinity
    if (Number.isFinite(sa) || Number.isFinite(sb)) {
      if (!Number.isFinite(sa)) return 1
      if (!Number.isFinite(sb)) return -1
      return sb - sa
    }
    return String(a.symbol ?? '').localeCompare(String(b.symbol ?? ''))
  })

  const value = {
    asOf: new Date().toISOString(),
    source: 'fmp',
    date,
    rows: normalized,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
  }
  cache = { at: now(), key, value }
  return value
}

