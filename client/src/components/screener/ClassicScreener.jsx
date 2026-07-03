import { ArrowUpRight, Loader2, RotateCcw, Search, SearchX, SlidersHorizontal } from 'lucide-react'
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
  if (value == null) return <span className="text-ink-3">—</span>
  const color = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-ink-2'
  const glyph = value > 0 ? '▲' : value < 0 ? '▼' : null
  return (
    <span className={color}>
      {glyph ? (
        <span aria-hidden className="mr-0.5 text-[9px] align-middle">
          {glyph}
        </span>
      ) : null}
      {fmtPct(value)}
    </span>
  )
}

function FilterInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '—'}
        className="input"
      />
    </label>
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
      } catch {
        // ignore — fall back to default filters
      }
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
    } catch {
      // ignore — save is best-effort
    }
    setSaving(false)
  }, [filters, token])

  const handleReset = () => { setFilters(DEFAULT_FILTERS); setResults(null); setRunError(null) }

  if (!filtersLoaded) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-ink-3">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        Loading saved filters…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="panel">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-ink-3" aria-hidden />
            <h2 className="eyebrow">Filter criteria</h2>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-3 transition-colors duration-150 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </button>
        </div>

        <div className="space-y-5 panel-pad">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="field-label" id="classic-exchange-label">Exchange</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="classic-exchange-label">
                {EXCHANGES.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setField('exchange')(ex.id)}
                    aria-pressed={filters.exchange === ex.id}
                    className={[
                      'rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                      filters.exchange === ex.id
                        ? 'border-ember/30 bg-ember/10 text-flame'
                        : 'border-line bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink',
                    ].join(' ')}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="field-label">Sector</span>
              <select
                value={filters.sector}
                onChange={(e) => setField('sector')(e.target.value)}
                className="select"
              >
                {SECTORS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-surface-2 text-ink">
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
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
              className="btn-primary"
            >
              {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
              {running ? 'Running…' : 'Run screener'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-ghost"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save filters
            </button>
            {savedMsg ? (
              <span className="chip chip-up" role="status">{savedMsg}</span>
            ) : null}
          </div>
        </div>
      </section>

      {runError ? (
        <div className="rounded-[14px] border border-down/30 bg-down/10 p-4 text-sm text-down" role="alert">
          {runError} — adjust the filters and run again.
        </div>
      ) : null}

      {results !== null ? (
        results.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="size-8 text-ink-3" aria-hidden />
            <p className="text-sm text-ink-2">No results matched your filters — relax the criteria and run again.</p>
            <button type="button" onClick={handleReset} className="btn-ghost">
              Reset filters
            </button>
          </div>
        ) : (
          <div className="rise">
            <TableShell
              title={`Screener results (${results.length})`}
              subtitle="Filtered from US-listed stocks via FMP"
            >
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th className="num">Price</th>
                    <th className="num">Chg%</th>
                    <th className="num">Volume</th>
                    <th className="num">Mkt cap</th>
                    <th>Exchange</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr
                      key={r.symbol}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/analysis/${r.symbol}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/analysis/${r.symbol}`) }}
                      className="group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:ring-inset"
                    >
                      <td>
                        <span className="num inline-flex items-center gap-2 font-semibold text-ink">
                          {r.symbol}
                          <ArrowUpRight className="size-3.5 text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
                        </span>
                      </td>
                      <td className="max-w-[12rem] truncate">{r.name || '—'}</td>
                      <td className="num text-ink">{fmtPrice(r.price)}</td>
                      <td className="num"><PctCell value={r.changePercent} /></td>
                      <td className="num">{fmtVol(r.volume)}</td>
                      <td className="num">{fmtMktCap(r.marketCap)}</td>
                      <td className="text-xs text-ink-3">{r.exchange}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </div>
        )
      ) : null}
    </div>
  )
}
