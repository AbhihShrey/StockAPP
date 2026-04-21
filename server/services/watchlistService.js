import db from '../db.js'
import { fetchBatchQuotesBySymbols } from './fmp.js'

export function getWatchlistSymbols(userId) {
  return db.prepare('SELECT symbol, added_at FROM watchlists WHERE user_id = ? ORDER BY added_at DESC').all(userId)
}

export async function getWatchlistWithQuotes(userId) {
  const rows = getWatchlistSymbols(userId)
  if (rows.length === 0) return []
  const symbols = rows.map((r) => r.symbol)
  const quoteMap = await fetchBatchQuotesBySymbols(symbols)

  // Alert counts per symbol (active alerts only)
  const alertCounts = db.prepare(`
    SELECT symbol, COUNT(*) as count
    FROM alerts
    WHERE user_id = ? AND is_active = 1
    GROUP BY symbol
  `).all(userId)
  const alertCountMap = new Map(alertCounts.map((r) => [r.symbol.toUpperCase(), r.count]))

  return rows.map((r) => {
    const sym = r.symbol.toUpperCase()
    const q = quoteMap.get(sym) ?? {}
    return {
      symbol: sym,
      addedAt: r.added_at,
      price: q.price ?? null,
      changePercent: q.changePercent ?? null,
      volume: q.volume ?? null,
      dayHigh: q.dayHigh ?? null,
      dayLow: q.dayLow ?? null,
      priceAvg50: q.priceAvg50 ?? null,
      priceAvg200: q.priceAvg200 ?? null,
      alertCount: alertCountMap.get(sym) ?? 0,
    }
  })
}

export async function validateSymbol(symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  try {
    const quoteMap = await fetchBatchQuotesBySymbols([sym])
    const q = quoteMap.get(sym)
    return q?.price != null
  } catch {
    return false
  }
}

export function addToWatchlist(userId, symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  if (!sym || sym.length > 12 || !/^[A-Z0-9.^-]+$/.test(sym)) {
    return { ok: false, error: 'Invalid symbol.' }
  }
  const count = db.prepare('SELECT COUNT(*) as n FROM watchlists WHERE user_id = ?').get(userId).n
  if (count >= 50) {
    return { ok: false, error: 'Watchlist limit is 50 symbols.' }
  }
  const existing = db.prepare('SELECT id FROM watchlists WHERE user_id = ? AND symbol = ?').get(userId, sym)
  if (existing) {
    return { ok: false, error: `${sym} is already in your watchlist.` }
  }
  db.prepare('INSERT INTO watchlists (user_id, symbol) VALUES (?, ?)').run(userId, sym)
  return { ok: true, symbol: sym }
}

export function removeFromWatchlist(userId, symbol) {
  const sym = String(symbol ?? '').trim().toUpperCase()
  const result = db.prepare('DELETE FROM watchlists WHERE user_id = ? AND symbol = ?').run(userId, sym)
  if (result.changes === 0) return { ok: false, error: 'Symbol not found in watchlist.' }
  return { ok: true }
}
