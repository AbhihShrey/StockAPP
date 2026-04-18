import { getSp500QuoteSnapshot } from './sp500Snapshot.js'

const CHARTS_GRID_SIZE = Number(process.env.CHARTS_GRID_SIZE) || 16

/**
 * S&P 500 names ordered by today’s % change (best → worst in the grid).
 * Uses half from the top movers and half from the bottom so the tiles are not all the same “winner” profile.
 * Scores are peer ranks within the returned grid.
 */
export async function getChartsUniverse() {
  const snap = await getSp500QuoteSnapshot()
  const rows = snap.symbols
    .map((ticker) => {
      const q = snap.quotes.get(ticker)
      return {
        ticker,
        changePercent: q?.changePercent ?? null,
        price: q?.price ?? null,
      }
    })
    .filter((r) => r.changePercent !== null && Number.isFinite(r.changePercent))

  rows.sort((a, b) => b.changePercent - a.changePercent)

  const half = Math.floor(CHARTS_GRID_SIZE / 2)
  const head = rows.slice(0, half)
  const tail = rows.slice(Math.max(0, rows.length - half))
  /** Worst slice, ordered from least bad to most bad (still descending % overall). */
  const tailDesc = tail.slice().sort((a, b) => b.changePercent - a.changePercent)
  const merged = []
  const seen = new Set()
  for (const r of [...head, ...tailDesc]) {
    if (seen.has(r.ticker)) continue
    seen.add(r.ticker)
    merged.push(r)
    if (merged.length >= CHARTS_GRID_SIZE) break
  }

  const n = merged.length
  const withScores = merged.map((r, rank) => ({
    ...r,
    score: n <= 1 ? 75 : Math.round(100 - (rank / (n - 1)) * 72),
  }))

  return {
    asOf: snap.asOf,
    source: 'fmp',
    rows: withScores,
    cached: snap.cached === true,
    refreshIntervalMs: snap.refreshIntervalMs,
  }
}
