import db from '../db.js'
import { fmpGet } from './fmp.js'

export async function runScreener(filters = {}) {
  const params = { country: 'US', limit: 100 }

  if (filters.exchange && filters.exchange !== 'any') {
    params.exchange = filters.exchange.toUpperCase()
  }
  if (filters.priceMin != null && filters.priceMin !== '') params.priceMoreThan = Number(filters.priceMin)
  if (filters.priceMax != null && filters.priceMax !== '') params.priceLowerThan = Number(filters.priceMax)
  if (filters.volumeMin != null && filters.volumeMin !== '') params.volumeMoreThan = Number(filters.volumeMin)
  if (filters.changeMin != null && filters.changeMin !== '') params.changeMoreThan = Number(filters.changeMin)
  if (filters.changeMax != null && filters.changeMax !== '') params.changeLowerThan = Number(filters.changeMax)
  if (filters.sector && filters.sector !== 'any') params.sector = filters.sector

  const data = await fmpGet('/stock-screener', params)
  const rows = Array.isArray(data) ? data : []

  return rows.map((s) => ({
    symbol: String(s.symbol ?? '').toUpperCase(),
    name: s.companyName ?? s.name ?? '',
    price: s.price != null ? Number(s.price) : null,
    changePercent: s.changesPercentage != null ? Number(s.changesPercentage) : null,
    volume: s.volume != null ? Math.trunc(Number(s.volume)) : null,
    marketCap: s.marketCap != null ? Number(s.marketCap) : null,
    exchange: s.exchangeShortName ?? s.exchange ?? '',
    sector: s.sector ?? '',
  }))
}

export function getScreenerFilters(userId) {
  const row = db.prepare('SELECT filters FROM screener_filters WHERE user_id = ?').get(userId)
  if (!row) return {}
  try { return JSON.parse(row.filters) } catch { return {} }
}

export function saveScreenerFilters(userId, filters) {
  db.prepare(`
    INSERT INTO screener_filters (user_id, filters, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET filters = excluded.filters, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(filters))
  return { ok: true }
}
