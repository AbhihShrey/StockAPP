import { ArrowUpRight, Loader2, Search, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TableShell } from '../TableShell'
import { apiUrl, authHeaders } from '../../lib/apiBase'

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
  marketCapMin: '',
  marketCapMax: '',
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

/**
 * Classic filter screener — scans US-listed stocks via FMP's stock-screener by
 * exchange / sector / price / volume / % change / market cap. Filters persist per user.
 */
export function ClassicScreener({ token }) {
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <FilterInput label="Min price ($)" value={filters.priceMin} onChange={setField('priceMin')} placeholder="0" />
            <FilterInput label="Max price ($)" value={filters.priceMax} onChange={setField('priceMax')} placeholder="any" />
            <FilterInput label="Min volume" value={filters.volumeMin} onChange={setField('volumeMin')} placeholder="0" />
            <FilterInput label="Min chg%" value={filters.changeMin} onChange={setField('changeMin')} placeholder="-100" />
            <FilterInput label="Max chg%" value={filters.changeMax} onChange={setField('changeMax')} placeholder="+100" />
            <FilterInput label="Min mkt cap ($)" value={filters.marketCapMin} onChange={setField('marketCapMin')} placeholder="0" />
            <FilterInput label="Max mkt cap ($)" value={filters.marketCapMax} onChange={setField('marketCapMax')} placeholder="any" />
          </div>

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

      {runError ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
          {runError}
        </div>
      ) : null}

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
