const MIN_MS = 5_000

/**
 * TTL for FMP quote-heavy snapshots (movers, batch quotes, indices, scanners, etc.).
 * Override with MARKET_DATA_CACHE_MS (or legacy ALPHA_VANTAGE_CACHE_MS) in server/.env.
 * Default 30s — still bounded by FMP plan limits and rate caps.
 */
export function quoteSnapshotCacheMs() {
  const a = Number(process.env.MARKET_DATA_CACHE_MS)
  if (Number.isFinite(a) && a >= MIN_MS) return a
  const b = Number(process.env.ALPHA_VANTAGE_CACHE_MS)
  if (Number.isFinite(b) && b >= MIN_MS) return b
  return 30_000
}
