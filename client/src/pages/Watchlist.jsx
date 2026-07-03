import { ArrowUpRight, BookmarkX, Loader2, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function usePriceFlash(items) {
  const prevRef = useRef({})
  const [flashes, setFlashes] = useState({})
  useEffect(() => {
    const next = {}
    const newFlashes = {}
    let changed = false
    for (const item of items) {
      const prev = prevRef.current[item.symbol]
      if (prev != null && item.price != null && prev !== item.price) {
        newFlashes[item.symbol] = item.price > prev ? 'up' : 'down'
        changed = true
      }
      next[item.symbol] = item.price
    }
    prevRef.current = next
    if (changed) {
      setFlashes(newFlashes)
      const t = setTimeout(() => setFlashes({}), 1000)
      return () => clearTimeout(t)
    }
  }, [items])
  return flashes
}
import { ConsensusPill } from '../components/AnalystCoveragePanel'
import { SkeletonBlock } from '../components/DataSkeleton'
import { TableShell } from '../components/TableShell'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

function fmtPrice(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

function fmtPct(n) {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtVol(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function PctCell({ value }) {
  if (value == null) return <span className="text-ink-3">—</span>
  const color = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-ink-2'
  return (
    <span className={color}>
      {value !== 0 ? (
        <span aria-hidden className="mr-0.5 text-[9px]">{value > 0 ? '▲' : '▼'}</span>
      ) : null}
      {fmtPct(value)}
    </span>
  )
}

// ── Watchlist tab ────────────────────────────────────────────────────────────

function WatchlistTab({ token }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [recentlyAdded, setRecentlyAdded] = useState(() => new Set())
  const flashes = usePriceFlash(items)
  const [error, setError] = useState(null)
  const [addInput, setAddInput] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState(null)
  const [search, setSearch] = useState('')
  const [ratings, setRatings] = useState({})
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const inputRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/watchlist'), { headers: authHeaders(token) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Failed to load watchlist')
      setItems(json.items ?? [])
      setError(null)
    } catch (e) {
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const symbolsKey = items.map((i) => i.symbol).sort().join(',')
  useEffect(() => {
    if (!symbolsKey) { setRatings({}); return }
    let cancelled = false
    async function loadRatings() {
      setRatingsLoading(true)
      try {
        const res = await fetch(
          apiUrl(`/api/analyst-ratings?symbols=${encodeURIComponent(symbolsKey)}`),
          { headers: authHeaders(token) },
        )
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        setRatings(res.ok ? (json.ratings ?? {}) : {})
      } catch {
        if (!cancelled) setRatings({})
      } finally {
        if (!cancelled) setRatingsLoading(false)
      }
    }
    loadRatings()
    return () => { cancelled = true }
  }, [symbolsKey, token])

  useEffect(() => {
    const id = window.setInterval(() => load(true), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  const handleAdd = useCallback(async (e) => {
    e.preventDefault()
    const sym = addInput.trim().toUpperCase()
    if (!sym) return
    setAddBusy(true)
    setAddError(null)
    try {
      const res = await fetch(apiUrl('/api/watchlist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ symbol: sym }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.message ?? 'Failed to add symbol'); return }
      setAddInput('')
      setRecentlyAdded((prev) => {
        const next = new Set(prev)
        next.add(sym)
        return next
      })
      window.setTimeout(() => {
        setRecentlyAdded((prev) => {
          if (!prev.has(sym)) return prev
          const next = new Set(prev)
          next.delete(sym)
          return next
        })
      }, 1900)
      await load(true)
    } catch {
      setAddError('Network error.')
    } finally {
      setAddBusy(false)
    }
  }, [addInput, token, load])

  const handleRemove = useCallback(async (symbol) => {
    try {
      await fetch(apiUrl(`/api/watchlist/${encodeURIComponent(symbol)}`), {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      setItems((prev) => prev.filter((i) => i.symbol !== symbol))
    } catch {}
  }, [token])

  const filtered = items.filter((i) =>
    !search || i.symbol.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      {/* Add symbol bar */}
      <div className="rise rise-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleAdd} className="flex w-full max-w-sm items-center gap-2">
          <label htmlFor="watchlist-add-symbol" className="sr-only">Add symbol</label>
          <input
            id="watchlist-add-symbol"
            ref={inputRef}
            value={addInput}
            onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddError(null) }}
            placeholder="Add symbol (e.g. AAPL)"
            maxLength={12}
            className="input num flex-1"
          />
          <button
            type="submit"
            disabled={addBusy || !addInput.trim()}
            className="btn-primary shrink-0"
          >
            {addBusy
              ? <Loader2 className="size-4 animate-spin" aria-hidden />
              : <Plus className="size-4" aria-hidden />}
            Add
          </button>
        </form>
        {addError ? (
          <p className="text-sm text-down">{addError}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="rise rise-2 panel space-y-3 p-4 sm:p-5" aria-busy aria-label="Loading watchlist">
          <SkeletonBlock className="h-4 w-40" />
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rise rise-2 flex flex-col items-start gap-3 rounded-[14px] border border-down/25 bg-down/5 p-6">
          <p className="text-sm text-down">Could not load your watchlist — {error}</p>
          <button type="button" onClick={() => load()} className="btn-ghost h-8 px-3 text-xs">
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rise rise-2 panel flex flex-col items-center justify-center gap-3 py-16 text-center">
          <BookmarkX className="size-8 text-ink-3" aria-hidden />
          <p className="text-sm font-medium text-ink-2">Your watchlist is empty.</p>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="btn-primary mt-1"
          >
            <Plus className="size-4" aria-hidden /> Add your first symbol
          </button>
        </div>
      ) : (
        <div className="rise rise-2">
          <TableShell
            title={`Watchlist (${items.length})`}
            search={search}
            setSearch={setSearch}
          >
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Price</th>
                  <th className="num">Chg %</th>
                  <th className="num">Volume</th>
                  <th className="num">Day high</th>
                  <th className="num">Day low</th>
                  <th className="text-center">Alerts</th>
                  <th className="text-center">Consensus</th>
                  <th><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const flash = flashes[row.symbol]
                  return (
                    <tr
                      key={row.symbol}
                      className={[
                        'group',
                        recentlyAdded.has(row.symbol)
                          ? 'bg-ember/10'
                          : flash === 'up'
                            ? 'bg-up/5'
                            : flash === 'down'
                              ? 'bg-down/5'
                              : '',
                      ].join(' ')}
                    >
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/analysis/${row.symbol}`)}
                          className="num inline-flex items-center gap-1.5 rounded-md font-semibold text-ink outline-none transition-colors hover:text-flame focus-visible:ring-2 focus-visible:ring-ember/60"
                        >
                          {row.symbol}
                          <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                        </button>
                      </td>
                      <td className="num text-ink">{fmtPrice(row.price)}</td>
                      <td className="num">
                        <PctCell value={row.changePercent} />
                      </td>
                      <td className="num text-ink-3">{fmtVol(row.volume)}</td>
                      <td className="num text-ink-3">{fmtPrice(row.dayHigh)}</td>
                      <td className="num text-ink-3">{fmtPrice(row.dayLow)}</td>
                      <td className="text-center">
                        {row.alertCount > 0 ? (
                          <span className="chip chip-ember num">{row.alertCount}</span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {ratingsLoading && !ratings[row.symbol] ? (
                          <span className="skeleton inline-block h-4 w-8" aria-hidden />
                        ) : (
                          <ConsensusPill code={ratings[row.symbol]?.consensus?.code} />
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => handleRemove(row.symbol)}
                          className="rounded-lg p-1.5 text-ink-3 outline-none transition-colors hover:bg-down/10 hover:text-down focus-visible:ring-2 focus-visible:ring-ember/60"
                          aria-label={`Remove ${row.symbol}`}
                        >
                          <X className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-ink-3" colSpan={9}>
                      No results match &quot;{search}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableShell>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Watchlist() {
  const { token } = useAuth()

  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">Watchlist · Live quotes</p>
        <h1 className="display mt-1 text-2xl sm:text-3xl">Watchlist</h1>
        <div className="ember-rule mt-4" aria-hidden />
      </header>

      <WatchlistTab token={token} />
    </div>
  )
}
