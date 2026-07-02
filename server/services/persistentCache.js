/**
 * Two-level cache: L1 in-memory Map (fast) + L2 SQLite `kv_cache` (durable).
 *
 * Why: the screener's per-symbol OHLCV history and earnings lookups used to live only in
 * process memory, so every Render redeploy threw them away and the next scan re-fetched
 * hundreds of symbols from FMP. Persisting to the SQLite DB we already run means a warm
 * cache survives restarts. Reads are still served from memory when hot.
 *
 * Values are JSON-serialized. `expires_at` is an epoch-ms timestamp.
 */
import db from '../db.js'

/** @type {Map<string, { value: any, expiresAt: number }>} */
const mem = new Map()

const selStmt = db.prepare('SELECT value, expires_at FROM kv_cache WHERE key = ?')
const upsertStmt = db.prepare(`
  INSERT INTO kv_cache (key, value, expires_at) VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
`)
const delStmt = db.prepare('DELETE FROM kv_cache WHERE key = ?')

/**
 * Returns the cached value, or `undefined` on a miss. A stored `null` is a real cached
 * value (e.g. "this symbol has no upcoming earnings") and is returned as `null`.
 */
export function pcGet(key) {
  const now = Date.now()

  const hot = mem.get(key)
  if (hot) {
    if (hot.expiresAt > now) return hot.value
    mem.delete(key)
  }

  const row = selStmt.get(key)
  if (!row) return undefined
  if (row.expires_at <= now) {
    try { delStmt.run(key) } catch { /* ignore */ }
    return undefined
  }
  let value
  try { value = JSON.parse(row.value) } catch { return undefined }
  mem.set(key, { value, expiresAt: row.expires_at })
  return value
}

export function pcSet(key, value, ttlMs) {
  const expiresAt = Date.now() + Math.max(0, Number(ttlMs) || 0)
  mem.set(key, { value, expiresAt })
  try {
    upsertStmt.run(key, JSON.stringify(value), expiresAt)
  } catch {
    // Non-serializable value or a transient write error — the L1 entry still serves this process.
  }
}

export function pcDelete(key) {
  mem.delete(key)
  try { delStmt.run(key) } catch { /* ignore */ }
}

/** Delete expired rows from the SQLite layer (called by the daily cleanup cron). */
export function pruneExpiredCache() {
  try {
    return db.prepare('DELETE FROM kv_cache WHERE expires_at <= ?').run(Date.now()).changes
  } catch {
    return 0
  }
}
