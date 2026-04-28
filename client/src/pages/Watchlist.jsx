import { ArrowUpRight, BookmarkX, Loader2, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
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

const TABS = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'screener', label: 'Screener' },
]

const EXCHANGES = [
  { id: 'any', label: 'Any' },
  { id: 'NASDAQ', label: 'NASDAQ' },
  { id: 'NYSE', label: 'NYSE' },
  { id: 'AMEX', label: 'AMEX' },
]

const SECTORS = [
  { id: 'any', label: 'Any sector' },
  { id: 'Technology', label: 'Technology' },
  { id: 'Healthcare', label: 'Healthcare' },
  { id: 'Financial Services', label: 'Financials' },
  { id: 'Consumer Cyclical', label: 'Consumer Cyclical' },
  { id: 'Consumer Defensive', label: 'Consumer Defensive' },
  { id: 'Industrials', label: 'Industrials' },
  { id: 'Energy', label: 'Energy' },
  { id: 'Utilities', label: 'Utilities' },
  { id: 'Real Estate', label: 'Real Estate' },
  { id: 'Basic Materials', label: 'Basic Materials' },
  { id: 'Communication Services', label: 'Communication Services' },
]

const DEFAULT_FILTERS = {
  exchange: 'any',
  sector: 'any',
  priceMin: '',
  priceMax: '',
  volumeMin: '',
  changeMin: '',
  changeMax: '',
}

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

function fmtMktCap(n) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toLocaleString()}`
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

// ── Screener tab ─────────────────────────────────────────────────────────────

function FilterInput({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className="glass-input rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
      />
    </div>
  )
}

function ScreenerTab({ token }) {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [results, setResults] = useState(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(null)
  const [filtersLoaded, setFiltersLoaded] = useState(false)

  useEffect(() => {
    async function loadFilters() {
      try {
        const res = await fetch(apiUrl('/api/screener/filters'), { headers: authHeaders(token) })
        const json = await res.json()
        if (res.ok && json.filters && Object.keys(json.filters).length > 0) {
          setFilters((prev) => ({ ...prev, ...json.filters }))
        }
      } catch {}
      setFiltersLoaded(true)
    }
    loadFilters()
  }, [token])

  const setField = (key) => (val) => setFilters((f) => ({ ...f, [key]: val }))

  const handleRun = useCallback(async () => {
    setRunning(true)
    setRunError(null)
    setResults(null)
    try {
      const res = await fetch(apiUrl('/api/screener/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ filters }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Screener failed')
      setResults(json.results ?? [])
    } catch (e) {
      setRunError(e.message)
    } finally {
      setRunning(false)
    }
  }, [filters, token])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSavedMsg(null)
    try {
      const res = await fetch(apiUrl('/api/screener/filters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ filters }),
      })
      if (res.ok) {
        setSavedMsg('Filters saved.')
        setTimeout(() => setSavedMsg(null), 2500)
      }
    } catch {}
    setSaving(false)
  }, [filters, token])

  const handleReset = () => { setFilters(DEFAULT_FILTERS); setResults(null); setRunError(null) }

  if (!filtersLoaded) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading saved filters…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter card */}
      <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-zinc-400" />
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Filter criteria</h2>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Reset
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Exchange + Sector */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Exchange</span>
              <div className="flex flex-wrap gap-1.5">
                {EXCHANGES.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setField('exchange')(ex.id)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                      filters.exchange === ex.id
                        ? 'bg-accent-muted text-accent ring-1 ring-accent/30'
                        : 'border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200',
                    ].join(' ')}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Sector</span>
              <select
                value={filters.sector}
                onChange={(e) => setField('sector')(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 focus:border-accent/35 focus:ring-2"
              >
                {SECTORS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-neutral-900">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Numeric filters */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <FilterInput label="Min price ($)" value={filters.priceMin} onChange={setField('priceMin')} placeholder="0" />
            <FilterInput label="Max price ($)" value={filters.priceMax} onChange={setField('priceMax')} placeholder="any" />
            <FilterInput label="Min volume" value={filters.volumeMin} onChange={setField('volumeMin')} placeholder="0" />
            <FilterInput label="Min chg%" value={filters.changeMin} onChange={setField('changeMin')} placeholder="-100" />
            <FilterInput label="Max chg%" value={filters.changeMax} onChange={setField('changeMax')} placeholder="+100" />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="glass-btn--accent inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {running ? 'Running…' : 'Run screener'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-zinc-100 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save filters
            </button>
            {savedMsg ? <span className="text-xs text-emerald-400">{savedMsg}</span> : null}
          </div>
        </div>
      </section>

      {/* Error */}
      {runError ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
          {runError}
        </div>
      ) : null}

      {/* Results */}
      {results !== null ? (
        results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <p className="text-sm font-medium text-zinc-400">No results matched your filters</p>
            <p className="text-xs text-zinc-600">Try relaxing the criteria and running again.</p>
          </div>
        ) : (
          <TableShell
            title={`Screener results (${results.length})`}
            subtitle="Filtered from US-listed stocks via FMP"
          >
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-1/80 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Chg%</th>
                  <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                  <th className="px-4 py-2.5 text-right font-medium">Mkt cap</th>
                  <th className="px-4 py-2.5 font-medium">Exchange</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/70">
                {results.map((r) => (
                  <tr
                    key={r.symbol}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/analysis/${r.symbol}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/analysis/${r.symbol}`) }}
                    className="group cursor-pointer outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/[0.04]"
                  >
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2 font-semibold text-zinc-100">
                        {r.symbol}
                        <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-60" aria-hidden />
                      </span>
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-zinc-400">{r.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">{fmtPrice(r.price)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <PctCell value={r.changePercent} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{fmtVol(r.volume)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{fmtMktCap(r.marketCap)}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">{r.exchange}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )
      ) : null}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Watchlist() {
  const { token } = useAuth()
  const [tab, setTab] = useState('watchlist')

  return (
    <div className="app-page-enter space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Watchlist</h1>
      </header>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border-subtle bg-surface-1/40 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-lg px-4 py-2 text-xs font-medium transition',
              tab === t.id
                ? 'bg-accent-muted text-accent accent-inset'
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'watchlist' ? (
        <WatchlistTab token={token} />
      ) : (
        <ScreenerTab token={token} />
      )}
    </div>
  )
}
