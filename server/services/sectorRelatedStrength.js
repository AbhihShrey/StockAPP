import { fmpGet } from './fmp.js'
import { getSp500QuoteSnapshot } from './sp500Snapshot.js'
import { SECTOR_ETFS } from './sectorQuadrant.js'

const CACHE_TTL_MS = Number(process.env.RELATED_STRENGTH_CACHE_MS) || 60_000
let cache = { at: 0, key: null, value: null }

let constituentCache = { at: 0, rows: null }
const CONSTITUENTS_TTL_MS = 24 * 60 * 60_000

function now() {
  return Date.now()
}

function normalizeSectorName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
}

function sectorAliasesFor(etfSectorName) {
  const n = normalizeSectorName(etfSectorName)
  // FMP sector naming is often "Consumer Cyclical/Defensive" instead of SPDR labels.
  const aliases = new Set([n])
  // Consumer sectors
  if (n === 'consumer staples') aliases.add('consumer defensive')
  if (n === 'consumer disc' || n === 'consumer discretionary' || n === 'consumer discretionary ') {
    aliases.add('consumer cyclical')
  }

  // Common FMP canonical sector strings
  if (n === 'financials') aliases.add('financial services')
  if (n === 'materials') aliases.add('basic materials')
  if (n === 'health care') {
    aliases.add('healthcare')
    aliases.add('health care')
  }
  if (n === 'communication serv' || n === 'communication services') aliases.add('communication services')
  if (n === 'industrials') aliases.add('industrials')
  if (n === 'utilities') aliases.add('utilities')
  if (n === 'energy') aliases.add('energy')
  if (n === 'real estate') aliases.add('real estate')
  if (n === 'technology' || n === 'information technology') {
    aliases.add('technology')
    aliases.add('information technology')
  }
  return [...aliases]
}

function sectorMatchesAny(candidateSector, sectorNorms) {
  const s = normalizeSectorName(candidateSector)
  if (!s) return false
  // Exact match first
  if (sectorNorms.includes(s)) return true
  // Fuzzy fallback: substring match both ways (handles slight wording differences)
  return sectorNorms.some((a) => a && (s.includes(a) || a.includes(s)))
}

function sectorFromEtfSymbol(etfSymbol) {
  const sym = String(etfSymbol ?? '').trim().toUpperCase()
  const found = SECTOR_ETFS.find((s) => s.symbol === sym)
  return found?.name ?? null
}

async function loadSp500Constituents() {
  const age = now() - constituentCache.at
  if (constituentCache.rows && age < CONSTITUENTS_TTL_MS) return constituentCache.rows
  const data = await fmpGet('/sp500-constituent')
  const arr = Array.isArray(data) ? data : []
  constituentCache = { at: now(), rows: arr }
  return arr
}

export async function getSectorRelatedStrength(etfSymbol) {
  const sectorName = sectorFromEtfSymbol(etfSymbol)
  if (!sectorName) {
    const err = new Error('Unknown sector ETF symbol')
    err.code = 'BAD_REQUEST'
    throw err
  }

  const key = String(etfSymbol).trim().toUpperCase()
  const age = now() - cache.at
  if (cache.value && cache.key === key && age < CACHE_TTL_MS) return { ...cache.value, cached: true }

  const constituents = await loadSp500Constituents()
  const sectorNorms = sectorAliasesFor(sectorName)

  // Try both `sector` and `gicsSector` naming; fall back to nothing.
  const sectorSymbols = constituents
    .filter((r) => {
      const raw = r?.sector ?? r?.gicsSector ?? r?.gics_sector ?? r?.gicsSectorName ?? r?.gics_sector_name
      return sectorMatchesAny(raw, sectorNorms)
    })
    .map((r) => String(r?.symbol ?? '').trim().toUpperCase())
    .filter(Boolean)

  if (sectorSymbols.length === 0) {
    const err = new Error(`Could not map S&P 500 constituents to sector ${sectorName}`)
    err.code = 'FMP_HTTP'
    throw err
  }

  const snap = await getSp500QuoteSnapshot()
  const rows = sectorSymbols
    .map((sym) => {
      const q = snap.quotes.get(sym)
      return {
        symbol: sym,
        changePercent: q?.changePercent ?? null,
        price: q?.price ?? null,
        volume: q?.volume ?? null,
      }
    })
    .filter((r) => r.changePercent != null && Number.isFinite(r.changePercent))
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))

  const top = rows.slice(0, 8)
  const bottom = rows.slice(-8).reverse()

  const value = {
    asOf: snap.asOf,
    source: 'fmp',
    sectorEtf: key,
    sectorName,
    cached: false,
    refreshIntervalMs: CACHE_TTL_MS,
    leaders: top,
    laggards: bottom,
  }

  cache = { at: now(), key, value }
  return value
}

