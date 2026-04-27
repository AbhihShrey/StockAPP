import { fetchCompanyProfilesMap, fmpGet } from './fmp.js'

const FEED_TTL_MS = 15 * 60 * 1000
const SYMBOL_TTL_MS = 30 * 60 * 1000

const feedCache = { insider: { at: 0, value: null }, congress: { at: 0, value: null } }
const symbolCache = new Map() // sym → { at, value }

function now() { return Date.now() }

function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(String(value).replace(/[%,$\s]/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function toInt(value) {
  const n = toNumber(value)
  return n === null ? null : Math.trunc(n)
}

function classifyInsiderTransactionType(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return { code: 'OTHER', label: 'Other' }
  if (s.includes('p-purchase') || s === 'p' || s.includes('purchase')) return { code: 'PURCHASE', label: 'Purchase' }
  if (s.includes('s-sale') || s === 's' || s.includes('sale') || s.includes('sold')) return { code: 'SALE', label: 'Sale' }
  if (s.includes('m-exempt') || s.includes('exercise') || s.includes('option')) return { code: 'OPTION', label: 'Option Exercise' }
  if (s.includes('g-gift') || s.includes('gift')) return { code: 'GIFT', label: 'Gift' }
  if (s.includes('a-award') || s.includes('grant') || s.includes('award')) return { code: 'AWARD', label: 'Award' }
  if (s.includes('f-tax') || s.includes('tax')) return { code: 'TAX', label: 'Tax Withholding' }
  return { code: 'OTHER', label: raw ?? 'Other' }
}

function classifyTitle(raw) {
  const s = String(raw ?? '').toLowerCase()
  if (!s) return null
  if (s.includes('director')) return 'director'
  if (
    s.includes('officer') ||
    s.includes('president') ||
    s.includes('ceo') ||
    s.includes('cfo') ||
    s.includes('coo') ||
    s.includes('cto') ||
    s.includes('chief') ||
    s.includes('vp') ||
    s.includes('vice president') ||
    s.includes('treasurer') ||
    s.includes('secretary')
  ) return 'officer'
  if (s.includes('10%') || s.includes('owner')) return 'owner'
  return 'other'
}

function deriveDirection(r, txnCode) {
  // Form 4 records every line as Acquired ("A") or Disposed ("D"); prefer that
  // because OPTION/AWARD/GIFT/TAX rows also have a real direction.
  const ad = String(r.acquistionOrDisposition ?? r.acquisitionOrDisposition ?? '')
    .trim()
    .toUpperCase()
  if (ad === 'A') return 'up'
  if (ad === 'D') return 'down'
  if (txnCode === 'PURCHASE' || txnCode === 'AWARD' || txnCode === 'OPTION') return 'up'
  if (txnCode === 'SALE' || txnCode === 'TAX' || txnCode === 'GIFT') return 'down'
  return 'flat'
}

function computeImportance({ txnCode, role, value, direction }) {
  // 0..100 score. Purchases by officers/directors with material dollar size rank highest.
  let score = 0
  if (txnCode === 'PURCHASE') score += 45
  else if (txnCode === 'SALE') score += 15
  else if (txnCode === 'OPTION' || txnCode === 'AWARD') score += 5
  if (role === 'officer') score += 25
  else if (role === 'director') score += 18
  else if (role === 'owner') score += 12
  const v = Number.isFinite(value) ? Math.abs(value) : 0
  if (v >= 5_000_000) score += 30
  else if (v >= 1_000_000) score += 22
  else if (v >= 250_000) score += 14
  else if (v >= 50_000) score += 7
  if (direction === 'up' && txnCode === 'PURCHASE') score += 5 // open-market buys are rare/predictive
  return Math.max(0, Math.min(100, score))
}

function normalizeInsiderRow(r) {
  const sym = String(r.symbol ?? '').trim().toUpperCase()
  if (!sym) return null
  const txn = classifyInsiderTransactionType(
    r.transactionType ?? r.acquistionOrDisposition ?? r.acquisitionOrDisposition ?? r.transactionCode,
  )
  const shares = toNumber(r.securitiesTransacted ?? r.transactionShares ?? r.shares)
  const price = toNumber(r.price ?? r.transactionPricePerShare ?? r.pricePerShare)
  const value = (() => {
    const v = toNumber(r.totalValue ?? r.transactionValue)
    if (v != null && v !== 0) return v
    if (shares != null && price != null && shares !== 0 && price !== 0) return shares * price
    return null // suppress meaningless $0 (gifts, awards w/ no price)
  })()
  const title = r.typeOfOwner ?? r.position ?? r.officerTitle ?? r.relationship ?? null
  const role = classifyTitle(title)
  const direction = deriveDirection(r, txn.code)
  const importance = computeImportance({ txnCode: txn.code, role, value, direction })
  return {
    symbol: sym,
    company: r.companyName ?? r.symbolName ?? r.companyTicker ?? null,
    insiderName: r.reportingName ?? r.reportingCik ?? r.insiderName ?? null,
    title,
    role,
    transactionDate: r.transactionDate ?? r.filingDate ?? r.date ?? null,
    filingDate: r.filingDate ?? r.acceptedDate ?? null,
    transactionType: txn.code,
    transactionLabel: txn.label,
    shares,
    price,
    value,
    direction,
    importance,
    isSignificant: importance >= 60,
    link: r.link ?? null,
  }
}

function classifyParty(raw) {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s) return null
  if (s.startsWith('D')) return 'D'
  if (s.startsWith('R')) return 'R'
  if (s.startsWith('I')) return 'I'
  return null
}

function classifyCongressTransaction(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return { code: 'OTHER', label: raw ?? 'Other' }
  if (s.includes('purchase') || s.includes('buy')) return { code: 'PURCHASE', label: 'Purchase' }
  if (s.includes('sale') || s.includes('sold')) return { code: 'SALE', label: 'Sale' }
  if (s.includes('exchange')) return { code: 'EXCHANGE', label: 'Exchange' }
  return { code: 'OTHER', label: raw ?? 'Other' }
}

function parseCongressAmountRange(raw) {
  // FMP/STOCK Act amounts are reported as buckets like "$1,001 - $15,000" or "$1,000,001 +".
  if (raw == null) return { min: null, max: null, mid: null }
  const s = String(raw).replace(/\$/g, '').replace(/,/g, '').trim()
  if (!s) return { min: null, max: null, mid: null }
  const matches = s.match(/(\d+(?:\.\d+)?)/g)
  if (!matches || matches.length === 0) return { min: null, max: null, mid: null }
  const nums = matches.map(Number).filter((n) => Number.isFinite(n))
  if (nums.length === 0) return { min: null, max: null, mid: null }
  const min = nums[0]
  const max = nums.length > 1 ? nums[1] : nums[0]
  return { min, max, mid: (min + max) / 2 }
}

function computeCongressImportance({ chamber, txnCode, amountMid }) {
  let score = 0
  const v = Number.isFinite(amountMid) ? amountMid : 0
  if (v >= 1_000_000) score += 60
  else if (v >= 250_000) score += 45
  else if (v >= 100_000) score += 32
  else if (v >= 50_000) score += 22
  else if (v >= 15_000) score += 12
  if (chamber === 'Senate') score += 18
  else if (chamber === 'House') score += 8
  if (txnCode === 'PURCHASE') score += 15
  else if (txnCode === 'SALE') score += 8
  return Math.max(0, Math.min(100, score))
}

function normalizeCongressRow(r, chamber) {
  const sym = String(r.symbol ?? r.ticker ?? '').trim().toUpperCase()
  const txn = classifyCongressTransaction(r.type ?? r.transactionType ?? r.disclosureType ?? r.representative?.transactionType)
  const memberName =
    [r.firstName, r.lastName].filter(Boolean).join(' ').trim() ||
    r.representative ||
    r.senator ||
    r.office ||
    null
  const amountRange = r.amount ?? r.assetAmount ?? null
  const { min: amountMin, max: amountMax, mid: amountMid } = parseCongressAmountRange(amountRange)
  const importance = computeCongressImportance({ chamber, txnCode: txn.code, amountMid })
  return {
    chamber,
    symbol: sym || null,
    company: r.assetDescription ?? r.assetType ?? null,
    memberName,
    party: classifyParty(r.party),
    state: r.district ?? r.state ?? null,
    transactionType: txn.code,
    transactionLabel: txn.label,
    amountRange,
    amountMin,
    amountMax,
    amountMid,
    importance,
    isSignificant: importance >= 50,
    transactionDate: r.transactionDate ?? r.date ?? null,
    filingDate: r.disclosureDate ?? r.filingDate ?? null,
    link: r.link ?? null,
  }
}

async function fetchInsiderFromPaths(paths, params) {
  let lastErr = null
  for (const path of paths) {
    try {
      const data = await fmpGet(path, params)
      if (Array.isArray(data)) return data
    } catch (err) {
      lastErr = err
      // 404 → endpoint shape isn't this one; try next. Other errors → bubble.
      if (err?.code !== 'FMP_HTTP' || !/404/.test(String(err.message))) throw err
    }
  }
  if (lastErr) throw lastErr
  return []
}

async function enrichCompanyNames(rows) {
  const missing = [...new Set(rows.filter((r) => !r.company).map((r) => r.symbol))]
  if (missing.length === 0) return rows
  let profiles
  try {
    profiles = await fetchCompanyProfilesMap(missing, { concurrency: 8, maxSymbols: 80 })
  } catch {
    return rows
  }
  return rows.map((r) =>
    r.company ? r : { ...r, company: profiles.get(r.symbol)?.companyName ?? null },
  )
}

async function fetchInsiderFeedFromFmp() {
  const arr = await fetchInsiderFromPaths(
    ['/insider-trading/latest', '/insider-trading'],
    { limit: 100 },
  )
  const rows = arr.map(normalizeInsiderRow).filter(Boolean)
  return enrichCompanyNames(rows)
}

async function fetchInsiderForSymbolFromFmp(symbol) {
  const arr = await fetchInsiderFromPaths(
    ['/insider-trading/search', '/insider-trading'],
    { symbol, limit: 50 },
  )
  const rows = arr.map(normalizeInsiderRow).filter(Boolean)
  return enrichCompanyNames(rows)
}

async function fetchCongressFeedFromFmp() {
  const [senateRes, houseRes] = await Promise.allSettled([
    fetchInsiderFromPaths(['/senate-latest', '/senate-trading'], { limit: 100 }),
    fetchInsiderFromPaths(['/house-latest', '/house-trading', '/house-disclosure'], { limit: 100 }),
  ])
  const senate = senateRes.status === 'fulfilled' && Array.isArray(senateRes.value)
    ? senateRes.value.map((r) => normalizeCongressRow(r, 'Senate'))
    : []
  const house = houseRes.status === 'fulfilled' && Array.isArray(houseRes.value)
    ? houseRes.value.map((r) => normalizeCongressRow(r, 'House'))
    : []
  const all = [...senate, ...house]
  all.sort((a, b) => String(b.transactionDate ?? '').localeCompare(String(a.transactionDate ?? '')))
  return enrichCongressCompanyNames(all)
}

async function enrichCongressCompanyNames(rows) {
  const missing = [...new Set(rows.filter((r) => r.symbol && !r.company).map((r) => r.symbol))]
  if (missing.length === 0) return rows
  let profiles
  try {
    profiles = await fetchCompanyProfilesMap(missing, { concurrency: 8, maxSymbols: 60 })
  } catch {
    return rows
  }
  return rows.map((r) =>
    r.company || !r.symbol ? r : { ...r, company: profiles.get(r.symbol)?.companyName ?? null },
  )
}

export async function getInsiderFeed() {
  const cached = feedCache.insider
  if (cached.value && now() - cached.at < FEED_TTL_MS) {
    return { rows: cached.value, cached: true, asOf: new Date(cached.at).toISOString() }
  }
  const rows = await fetchInsiderFeedFromFmp()
  feedCache.insider = { at: now(), value: rows }
  return { rows, cached: false, asOf: new Date().toISOString() }
}

export async function getInsiderForSymbol(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym) return { rows: [], cached: false, asOf: new Date().toISOString() }
  const entry = symbolCache.get(sym)
  if (entry && now() - entry.at < SYMBOL_TTL_MS) {
    return { rows: entry.value, cached: true, asOf: new Date(entry.at).toISOString() }
  }
  const rows = await fetchInsiderForSymbolFromFmp(sym)
  symbolCache.set(sym, { at: now(), value: rows })
  return { rows, cached: false, asOf: new Date().toISOString() }
}

export async function getCongressFeed() {
  const cached = feedCache.congress
  if (cached.value && now() - cached.at < FEED_TTL_MS) {
    return { rows: cached.value, cached: true, asOf: new Date(cached.at).toISOString() }
  }
  const rows = await fetchCongressFeedFromFmp()
  feedCache.congress = { at: now(), value: rows }
  return { rows, cached: false, asOf: new Date().toISOString() }
}

export async function getCongressForSymbol(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym) return { rows: [], cached: false, asOf: new Date().toISOString() }
  const { rows } = await getCongressFeed()
  return {
    rows: rows.filter((r) => r.symbol === sym),
    cached: true,
    asOf: new Date().toISOString(),
  }
}
