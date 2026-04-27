/**
 * Financial Modeling Prep — stable API (premium).
 * @see https://site.financialmodelingprep.com/developer/docs/stable
 */
const BASE_URL = 'https://financialmodelingprep.com/stable'

export function getFmpApiKey() {
  const key = process.env.FMP_API_KEY?.trim()
  if (!key) {
    const err = new Error(
      'Missing FMP_API_KEY. Add it to server/.env (Financial Modeling Prep dashboard).',
    )
    err.code = 'FMP_KEY_MISSING'
    throw err
  }
  return key
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

function toInt(value) {
  const n = toNumber(value)
  return n === null ? null : Math.trunc(n)
}

function fmpErrorMessage(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const e = json['Error Message'] ?? json.error ?? json.message
  return typeof e === 'string' ? e : null
}

/**
 * @param {string} path e.g. `/biggest-gainers` (no base)
 * @param {Record<string, string | number | undefined>} [params]
 */
const FMP_TIMEOUT_MS = 10_000

async function fmpFetchOnce(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FMP_TIMEOUT_MS),
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { json = null }

  const msg = fmpErrorMessage(json)
  if (msg) {
    const err = new Error(String(msg))
    err.code = /api\s*key|unauthorized|invalid/i.test(msg) ? 'FMP_KEY_MISSING' : 'FMP_HTTP'
    throw err
  }
  if (!res.ok) {
    const err = new Error(`FMP HTTP ${res.status}`)
    if (res.status === 429) err.code = 'FMP_RATE_LIMIT'
    else if (res.status === 402 || res.status === 403) err.code = 'FMP_FORBIDDEN'
    else err.code = 'FMP_HTTP'
    throw err
  }
  return json
}

function isNetworkError(err) {
  // TypeError from fetch (DNS failure, TCP reset, AbortError from timeout)
  return err instanceof TypeError || err?.name === 'AbortError' || err?.name === 'TimeoutError'
}

export async function fmpGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`)
  url.searchParams.set('apikey', getFmpApiKey())
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }

  try {
    return await fmpFetchOnce(url)
  } catch (err) {
    // One retry on transient network errors (not on auth / HTTP errors)
    if (isNetworkError(err)) {
      await new Promise((r) => setTimeout(r, 1_500))
      return fmpFetchOnce(url)
    }
    throw err
  }
}


function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Company profile (name / sector) keyed by UPPER symbol.
 * FMP stable exposes `/profile?symbol=…` (one symbol per request); we cap fan-out for calendars.
 */
export async function fetchCompanyProfilesMap(symbols, options = {}) {
  const concurrency = Math.max(1, Math.min(12, Number(options.concurrency) || 8))
  const maxSymbols = Math.max(1, Math.min(120, Number(options.maxSymbols) || 60))

  const unique = [
    ...new Set(
      symbols
        .map((s) => String(s ?? '')
          .trim()
          .toUpperCase())
        .filter(Boolean),
    ),
  ].slice(0, maxSymbols)

  const map = new Map()
  let idx = 0

  async function worker() {
    for (;;) {
      const i = idx++
      if (i >= unique.length) return
      const sym = unique[i]
      try {
        const data = await fmpGet('/profile', { symbol: sym })
        const row = Array.isArray(data) ? data[0] : data
        if (!row) continue
        const key = String(row.symbol ?? sym)
          .trim()
          .toUpperCase()
        map.set(key, {
          companyName: row.companyName ?? row.name ?? null,
          sector: row.sector ?? null,
          industry: row.industry ?? null,
        })
      } catch {
        // ignore per-symbol failures
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()))
  return map
}

/**
 * Earnings report rows keyed by UPPER symbol.
 * Used to backfill missing EPS estimate/actual for some earnings-calendar rows.
 * Endpoint: `/earnings?symbol=…`
 */
export async function fetchEarningsReportsMap(symbols, options = {}) {
  const concurrency = Math.max(1, Math.min(10, Number(options.concurrency) || 6))
  const maxSymbols = Math.max(1, Math.min(80, Number(options.maxSymbols) || 40))

  const unique = [
    ...new Set(
      symbols
        .map((s) => String(s ?? '')
          .trim()
          .toUpperCase())
        .filter(Boolean),
    ),
  ].slice(0, maxSymbols)

  const map = new Map()
  let idx = 0

  async function worker() {
    for (;;) {
      const i = idx++
      if (i >= unique.length) return
      const sym = unique[i]
      try {
        const data = await fmpGet('/earnings', { symbol: sym })
        const rows = Array.isArray(data) ? data : []
        if (rows.length === 0) continue
        map.set(sym, rows)
      } catch {
        // ignore per-symbol failures
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => worker()))
  return map
}


function quoteFieldsFromFmpRow(q) {
  const sym = String(q.symbol ?? '')
    .trim()
    .toUpperCase()
  if (!sym) return null
  return {
    sym,
    row: {
      volume: toInt(q.volume),
      avgVolume: toInt(q.avgVolume ?? q.averageVolume ?? q.volAvg),
      price: toNumber(q.price),
      open: toNumber(q.open),
      dayHigh: toNumber(q.dayHigh ?? q.high),
      dayLow: toNumber(q.dayLow ?? q.low),
      previousClose: toNumber(q.previousClose ?? q.openPrevious ?? q.closePrevious),
      changePercent: toNumber(q.changePercentage ?? q.changesPercentage),
      change: toNumber(q.change),
      priceAvg50: toNumber(q.priceAvg50),
      priceAvg200: toNumber(q.priceAvg200),
      yearHigh: toNumber(q.yearHigh ?? q['52WeekHigh']),
      yearLow: toNumber(q.yearLow ?? q['52WeekLow']),
    },
  }
}


/** One batch-quote request supports many symbols (chunked for URL limits). */
export async function fetchBatchQuotesBySymbols(symbols, chunkSize = 80) {
  const unique = [
    ...new Set(
      symbols
        .map((s) => String(s ?? '')
          .trim()
          .toUpperCase())
        .filter(Boolean),
    ),
  ]
  if (unique.length === 0) return new Map()

  const chunks = chunkArray(unique, chunkSize)
  const batches = await Promise.all(
    chunks.map((symList) => fmpGet('/batch-quote', { symbols: symList.join(',') })),
  )

  const map = new Map()
  for (const data of batches) {
    const arr = Array.isArray(data) ? data : []
    for (const q of arr) {
      const parsed = quoteFieldsFromFmpRow(q)
      if (parsed) map.set(parsed.sym, parsed.row)
    }
  }

  return map
}

/** Recent daily rows (newest first); `price` is the close for that session. */
export async function fetchHistoricalEodLight(symbol) {
  const sym = String(symbol ?? '')
    .trim()
    .toUpperCase()
  const data = await fmpGet('/historical-price-eod/light', { symbol: sym })
  return Array.isArray(data) ? data : []
}

export async function fetchBiggestGainers() {
  const data = await fmpGet('/biggest-gainers')
  return Array.isArray(data) ? data : []
}

export async function fetchBiggestLosers() {
  const data = await fmpGet('/biggest-losers')
  return Array.isArray(data) ? data : []
}

export async function fetchMostActives() {
  const data = await fmpGet('/most-actives')
  return Array.isArray(data) ? data : []
}

/**
 * Full EOD history (newest-first or mixed — sorted ascending by date).
 * @returns {Array<{ date: string, close: number }>}
 */
export async function fetchHistoricalEodFull(symbol) {
  const sym = String(symbol).toUpperCase()
  const data = await fmpGet('/historical-price-eod/full', { symbol: sym })
  /** Stable API may return `{ historical: [] }` or a raw array of bars. */
  const historical = Array.isArray(data)
    ? data
    : Array.isArray(data?.historical)
      ? data.historical
      : []
  if (historical.length === 0) {
    const err = new Error(`No EOD history for ${sym}`)
    err.code = 'FMP_HTTP'
    throw err
  }
  const rows = historical
    .map((row) => ({
      date: row.date,
      close: toNumber(row.close ?? row.adjClose ?? row.adjustedClose),
    }))
    .filter((r) => r.date && r.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (rows.length === 0) {
    const err = new Error(`No usable closes in EOD history for ${sym}`)
    err.code = 'FMP_HTTP'
    throw err
  }
  return rows
}

/**
 * Full EOD history with OHLCV for VWAP / technicals (ascending by date).
 * @returns {Array<{ date: string, open: number, high: number, low: number, close: number, volume: number }>}
 */
export async function fetchHistoricalEodFullOhlcv(symbol) {
  const sym = String(symbol).toUpperCase()
  const data = await fmpGet('/historical-price-eod/full', { symbol: sym })
  const historical = Array.isArray(data)
    ? data
    : Array.isArray(data?.historical)
      ? data.historical
      : []
  if (historical.length === 0) {
    const err = new Error(`No EOD OHLCV history for ${sym}`)
    err.code = 'FMP_HTTP'
    throw err
  }
  const rows = historical
    .map((row) => {
      const vol = toInt(row.volume ?? row.vol)
      const close = toNumber(row.close ?? row.adjClose ?? row.adjustedClose)
      const high = toNumber(row.high) ?? close
      const low = toNumber(row.low) ?? close
      return {
        date: row.date,
        open: toNumber(row.open) ?? close,
        high,
        low,
        close,
        volume: vol != null && vol >= 0 ? vol : 0,
      }
    })
    .filter((r) => r.date && r.close !== null && r.high !== null && r.low !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (rows.length === 0) {
    const err = new Error(`No usable OHLCV rows for ${sym}`)
    err.code = 'FMP_HTTP'
    throw err
  }
  return rows
}

/** Normalize FMP stock-market row → shared mover shape */
export function normalizeFmpMoverRow(row) {
  const pct =
    toNumber(row.changesPercentage) ??
    toNumber(row.changePercentage) ??
    toNumber(row.changespercentage)
  return {
    ticker: String(row.symbol ?? row.ticker ?? '')
      .trim()
      .toUpperCase() || null,
    price: toNumber(row.price),
    change: toNumber(row.change),
    changePercent: pct,
    volume: toInt(row.volume ?? row.vol ?? row.totalVolume),
  }
}
