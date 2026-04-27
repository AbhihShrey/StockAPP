import { fmpGet } from './fmp.js'

/**
 * IPO Calendar — wraps FMP IPO endpoints.
 *
 * FMP's IPO data is split across a few endpoints, each with partial fields:
 *   - `/ipos-calendar`   — main schedule (date, symbol, company, exchange, range, shares)
 *   - `/ipos-disclosure` — recent S-1 filings (filing date, status, filing URL)
 *   - `/ipos-prospectus` — pricing details (range, shares, ipo date, sometimes proceeds)
 *
 * We fetch all available sources and merge by symbol so each row is as complete
 * as possible. Field-name aliases are used because FMP's schema drifts a bit.
 */

const TTL_MS = 30 * 60 * 1000 // 30 min — IPO listings change slowly
const cache = new Map() // key=`${from}|${to}` → { at, value }

function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(String(value).replace(/[%,$\s]/g, '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function parsePriceRange(raw) {
  if (raw == null) return { low: null, high: null }
  if (typeof raw === 'object') {
    return {
      low: toNumber(raw.low ?? raw.priceRangeLow),
      high: toNumber(raw.high ?? raw.priceRangeHigh),
    }
  }
  const s = String(raw)
  const m = s.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/i)
  if (m) return { low: toNumber(m[1]), high: toNumber(m[2]) }
  const single = toNumber(s)
  return single != null ? { low: single, high: single } : { low: null, high: null }
}

function classifyStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return 'UPCOMING'
  if (s.includes('priced') || s.includes('listed')) return 'PRICED'
  if (s.includes('withdraw') || s.includes('postpon')) return 'WITHDRAWN'
  if (s.includes('filed') || s.includes('filing') || s.includes('proposed') || s.includes('registered')) return 'FILED'
  if (s.includes('upcoming') || s.includes('expected') || s.includes('scheduled')) return 'UPCOMING'
  return 'UPCOMING'
}

function classifyExchange(raw) {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s) return null
  if (s.includes('NASDAQ')) return 'NASDAQ'
  if (s.includes('NYSE') || s.includes('NEW YORK')) return 'NYSE'
  if (s.includes('AMEX') || s === 'NYSEAMERICAN') return 'AMEX'
  return s.slice(0, 12)
}

function pickUnderwriters(r) {
  const raw = r.leadUnderwriter ?? r.leadUnderwriters ?? r.underwriters ?? r.underwriter
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean)
  return String(raw)
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Importance score (0–100). FMP rarely returns marketCap on IPO endpoints, so
 * estRaise (shares × midpoint price) is the primary signal — it's almost always
 * computable when both shares and a price range are disclosed.
 */
function computeIpoImportance({ marketCap, estRaise, exchange, status, hasRange, hasShares }) {
  let score = 0
  const raise = Number.isFinite(estRaise) ? estRaise : 0
  if (raise >= 1_000_000_000) score += 55
  else if (raise >= 500_000_000) score += 42
  else if (raise >= 250_000_000) score += 32
  else if (raise >= 100_000_000) score += 22
  else if (raise >= 50_000_000) score += 14
  else if (raise > 0) score += 6

  const cap = Number.isFinite(marketCap) ? marketCap : 0
  if (cap >= 5_000_000_000) score += 25
  else if (cap >= 1_000_000_000) score += 18
  else if (cap >= 500_000_000) score += 12
  else if (cap >= 100_000_000) score += 6

  if (exchange === 'NASDAQ' || exchange === 'NYSE') score += 12
  else if (exchange === 'AMEX') score += 4

  if (status === 'PRICED') score += 10
  else if (status === 'UPCOMING') score += 8
  else if (status === 'FILED') score += 4

  if (hasRange) score += 5
  if (hasShares) score += 3

  return Math.max(0, Math.min(100, score))
}

function symbolKey(s) {
  return String(s ?? '').trim().toUpperCase()
}

function pickFirst(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v
  }
  return null
}

function mergeRaw(a, b) {
  // Prefer non-empty values from `a` (primary), fall through to `b` (secondary).
  const out = { ...b, ...a }
  for (const k of Object.keys(b)) {
    const av = a?.[k]
    if (av === null || av === undefined || av === '') out[k] = b[k]
  }
  return out
}

function normalizeRow(r) {
  const symbol = symbolKey(r.symbol ?? r.ticker) || null
  const range = parsePriceRange(
    r.priceRange ?? r.expectedPriceRange ?? r.priceRangeRange ?? {
      low: r.priceRangeLow ?? r.lowPrice ?? r.minPrice,
      high: r.priceRangeHigh ?? r.highPrice ?? r.maxPrice,
    },
  )
  const shares = toNumber(r.shares ?? r.numberOfShares ?? r.totalShares ?? r.sharesOffered ?? r.sharesIssued)
  const midpoint = range.low != null && range.high != null ? (range.low + range.high) / 2 : (range.low ?? range.high)
  const computedRaise = shares != null && midpoint != null ? shares * midpoint : null
  const estRaise =
    toNumber(r.proceeds) ??
    toNumber(r.amountFiled) ??
    toNumber(r.totalProceeds) ??
    computedRaise

  const marketCap =
    toNumber(r.marketCap) ??
    toNumber(r.estMarketCap) ??
    toNumber(r.expectedMarketCap) ??
    null

  const exchange = classifyExchange(r.exchange ?? r.exchangeShortName ?? r.market)
  const status = classifyStatus(r.status ?? r.actions ?? r.dealStatus ?? r.ipoStatus)
  const importance = computeIpoImportance({
    marketCap,
    estRaise,
    exchange,
    status,
    hasRange: range.low != null && range.high != null,
    hasShares: shares != null && shares > 0,
  })

  return {
    date: pickFirst(r.date, r.ipoDate, r.expectedDate, r.filingDate, r.acceptedDate),
    symbol,
    company: pickFirst(r.company, r.companyName, r.name),
    exchange,
    sector: pickFirst(r.sector, r.industry),
    priceRangeLow: range.low,
    priceRangeHigh: range.high,
    priceRangeMidpoint: midpoint,
    shares,
    estRaise,
    marketCap,
    status,
    importance,
    isSignificant: importance >= 35, // lowered: most rows lack marketCap, so we anchor on estRaise + exchange
    description: pickFirst(r.description, r.summary, r.about),
    underwriters: pickUnderwriters(r),
    filingUrl: pickFirst(r.filingUrl, r.url, r.filing, r.prospectusUrl, r.link),
  }
}

async function fetchFromCandidatePaths(paths, params) {
  let lastErr = null
  for (const path of paths) {
    try {
      const data = await fmpGet(path, params)
      if (Array.isArray(data)) return data
      if (data && typeof data === 'object' && Array.isArray(data.ipoCalendar)) {
        return data.ipoCalendar
      }
    } catch (err) {
      lastErr = err
      const isMissing =
        err?.code === 'FMP_HTTP' && /404|not\s*found/i.test(String(err.message))
      const isForbidden = err?.code === 'FMP_FORBIDDEN'
      if (!isMissing && !isForbidden) throw err
    }
  }
  if (lastErr) {
    // Surface the last 404/403 only if every path failed.
    const isMissing = lastErr?.code === 'FMP_HTTP' && /404/.test(String(lastErr.message))
    const isForbidden = lastErr?.code === 'FMP_FORBIDDEN'
    if (!isMissing && !isForbidden) throw lastErr
  }
  return []
}

async function fetchSourceSafely(paths, params) {
  try {
    return await fetchFromCandidatePaths(paths, params)
  } catch {
    return []
  }
}

/**
 * Fetch all three FMP IPO sources in parallel and merge by symbol.
 * Each source contributes whatever fields it has; later sources fill gaps.
 */
async function fetchAllSources({ from, to }) {
  const [calendar, disclosure, prospectus] = await Promise.all([
    fetchSourceSafely(['/ipos-calendar', '/ipo-calendar', '/ipos', '/calendar/ipo'], { from, to }),
    fetchSourceSafely(['/ipos-disclosure'], { from, to }),
    fetchSourceSafely(['/ipos-prospectus'], { from, to }),
  ])

  const bySym = new Map()
  const noSym = []

  function add(rows, priority) {
    for (const r of rows) {
      const sym = symbolKey(r.symbol ?? r.ticker)
      if (!sym) {
        noSym.push({ raw: r, priority })
        continue
      }
      const existing = bySym.get(sym)
      if (!existing) {
        bySym.set(sym, { raw: r, priority })
      } else if (priority < existing.priority) {
        // Lower priority number = primary source. Merge with primary winning.
        bySym.set(sym, { raw: mergeRaw(r, existing.raw), priority })
      } else {
        // Existing is primary; merge new fields into existing.
        existing.raw = mergeRaw(existing.raw, r)
      }
    }
  }

  // Priority: calendar (1) is primary, prospectus (2) fills pricing gaps, disclosure (3) fills filings.
  add(calendar, 1)
  add(prospectus, 2)
  add(disclosure, 3)

  const merged = [...bySym.values(), ...noSym].map((entry) => entry.raw)
  return merged
}

export async function getIpoCalendar({ from, to }) {
  if (!from || !to) {
    const err = new Error('Missing date range')
    err.code = 'BAD_REQUEST'
    throw err
  }
  const key = `${from}|${to}`
  const entry = cache.get(key)
  if (entry && Date.now() - entry.at < TTL_MS) {
    return { rows: entry.value, cached: true, asOf: new Date(entry.at).toISOString(), from, to }
  }

  const arr = await fetchAllSources({ from, to })
  const rows = arr.map(normalizeRow).filter((r) => r.symbol || r.company)
  cache.set(key, { at: Date.now(), value: rows })
  return { rows, cached: false, asOf: new Date().toISOString(), from, to }
}
