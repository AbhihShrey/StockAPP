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
  if (value == null) return <span className="text-zinc-500">—</span>
  const color = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-rose-400' : 'text-zinc-300'
  return <span className={color}>{fmtPct(value)}</span>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <form onSubmit={handleAdd} className="flex w-full max-w-sm items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={addInput}
              onChange={(e) => { setAddInput(e.target.value.toUpperCase()); setAddError(null) }}
              placeholder="Add symbol (e.g. AAPL)"
              maxLength={12}
              className="glass-input w-full rounded-xl py-2 pl-3 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <button
            type="submit"
            disabled={addBusy || !addInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent-muted px-3 py-2 text-sm font-semibold text-accent accent-inset transition hover:brightness-110 disabled:opacity-50"
          >
            {addBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </button>
        </form>
        {addError ? (
          <p className="text-sm text-rose-400">{addError}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border-subtle bg-surface-1/60 py-16 text-sm text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading watchlist…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-300">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <BookmarkX className="size-8 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-400">Your watchlist is empty</p>
          <p className="max-w-xs text-xs text-zinc-600">
            Type a ticker above and click Add to start tracking stocks.
          </p>
        </div>
      ) : (
        <TableShell
          title={`Watchlist (${items.length})`}
          search={search}
          setSearch={setSearch}
        >
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-1/80 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-2.5 font-medium">Symbol</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
                <th className="px-4 py-2.5 text-right font-medium">Chg%</th>
                <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                <th className="px-4 py-2.5 text-right font-medium">Day High</th>
                <th className="px-4 py-2.5 text-right font-medium">Day Low</th>
                <th className="px-4 py-2.5 text-center font-medium">Alerts</th>
                <th className="px-4 py-2.5 text-center font-medium">Consensus</th>
                <th className="px-4 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/70">
              {filtered.map((row) => {
                const flash = flashes[row.symbol]
                return (
                <tr
                  key={row.symbol}
                  data-just-added={recentlyAdded.has(row.symbol) ? '1' : undefined}
                  className={['watchlist-row group transition-colors hover:bg-white/5', flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''].join(' ')}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/analysis/${row.symbol}`)}
                      className="inline-flex items-center gap-2 font-semibold text-zinc-100 hover:text-accent"
                    >
                      {row.symbol}
                      <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-60" aria-hidden />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{fmtPrice(row.price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <PctCell value={row.changePercent} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{fmtVol(row.volume)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{fmtPrice(row.dayHigh)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{fmtPrice(row.dayLow)}</td>
                  <td className="px-4 py-3 text-center">
                    {row.alertCount > 0 ? (
                      <span className="inline-flex items-center justify-center rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent ring-1 ring-accent/20">
                        {row.alertCount}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ratingsLoading && !ratings[row.symbol] ? (
                      <span className="inline-block h-4 w-8 animate-pulse rounded bg-white/5" />
                    ) : (
                      <ConsensusPill code={ratings[row.symbol]?.consensus?.code} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(row.symbol)}
                      className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                      aria-label={`Remove ${row.symbol}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </td>
                </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-zinc-500" colSpan={9}>
                    No results match &quot;{search}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Watchlist() {
  const { token } = useAuth()

  return (
    <div className="app-page-enter space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Watchlist</h1>
      </header>

      <WatchlistTab token={token} />
    </div>
  )
}
