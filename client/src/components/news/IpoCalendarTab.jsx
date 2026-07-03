import { ArrowDown, ArrowUp, CalendarX, ExternalLink, Loader2, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardCard } from '../DashboardCard'
import { apiUrl } from '../../lib/apiBase'

// ── Date helpers ────────────────────────────────────────────────────────────

function isoDate(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function rangeFor(view) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (view === 'upcoming') {
    const to = new Date(today)
    to.setDate(to.getDate() + 60)
    return { from: isoDate(today), to: isoDate(to) }
  }
  // recent: past 90 days through today
  const from = new Date(today)
  from.setDate(from.getDate() - 90)
  return { from: isoDate(from), to: isoDate(today) }
}

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRange(low, high) {
  if (low == null && high == null) return '—'
  if (low != null && high != null && low !== high) return `$${low.toFixed(2)} – $${high.toFixed(2)}`
  const v = low ?? high
  return v != null ? `$${v.toFixed(2)}` : '—'
}

function fmtShares(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString('en-US')
}

function fmtMoney(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

// ── Pills ───────────────────────────────────────────────────────────────────

const STATUS_CHIP = {
  UPCOMING: 'chip',
  PRICED: 'chip chip-up',
  FILED: 'chip chip-warn',
  WITHDRAWN: 'chip chip-down',
}
const STATUS_LABEL = {
  UPCOMING: 'Upcoming',
  PRICED: 'Priced',
  FILED: 'Filed',
  WITHDRAWN: 'Withdrawn',
}
function StatusPill({ status }) {
  const cls = STATUS_CHIP[status] ?? STATUS_CHIP.UPCOMING
  return <span className={cls}>{STATUS_LABEL[status] ?? 'Upcoming'}</span>
}

function SignificantBadge() {
  return (
    <span
      className="chip chip-ember uppercase tracking-wide"
      title="Large IPO or major-exchange listing with disclosed range"
    >
      <Sparkles className="size-3" aria-hidden /> Key
    </span>
  )
}

function ExchangePill({ exchange }) {
  if (!exchange) return <span className="text-ink-3">—</span>
  return <span className="chip">{exchange}</span>
}

// ── Sortable header ─────────────────────────────────────────────────────────

function SortHeader({ label, sortKey, sort, setSort, align = 'left' }) {
  const active = sort.key === sortKey
  const dir = active ? sort.dir : null
  const onClick = () => {
    if (active) setSort({ key: sortKey, dir: dir === 'asc' ? 'desc' : 'asc' })
    else setSort({ key: sortKey, dir: 'desc' })
  }
  return (
    <th className={align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}>
      <button
        type="button"
        onClick={onClick}
        className={[
          'inline-flex items-center gap-1 uppercase outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ember/60',
          active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
        ].join(' ')}
      >
        {label}
        {active ? (dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : null}
      </button>
    </th>
  )
}

function compareValues(a, b, dir) {
  const mul = dir === 'asc' ? 1 : -1
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * mul
  return String(a).localeCompare(String(b)) * mul
}

// ── Detail modal ────────────────────────────────────────────────────────────

function IpoDetailModal({ row, onClose }) {
  useEffect(() => {
    if (!row) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [row, onClose])

  if (!row) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[14px] border border-line-strong bg-surface-1 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {row.symbol ? (
                <span className="num text-base font-semibold text-ink">{row.symbol}</span>
              ) : null}
              <ExchangePill exchange={row.exchange} />
              <StatusPill status={row.status} />
            </div>
            <h2 className="mt-1 truncate text-sm text-ink-2">{row.company ?? '—'}</h2>
            <p className="num mt-0.5 text-xs text-ink-3">{fmtDate(row.date)}{row.sector ? ` · ${row.sector}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 outline-none transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 text-sm">
          {row.description ? (
            <section>
              <h3 className="eyebrow mb-1.5">About</h3>
              <p className="leading-relaxed text-ink-2">{row.description}</p>
            </section>
          ) : null}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Price range" value={fmtRange(row.priceRangeLow, row.priceRangeHigh)} />
            <Field label="Midpoint" value={row.priceRangeMidpoint != null ? `$${row.priceRangeMidpoint.toFixed(2)}` : '—'} />
            <Field label="Shares offered" value={fmtShares(row.shares)} />
            <Field label="Est. raise" value={fmtMoney(row.estRaise)} />
            <Field label="Est. market cap" value={fmtMoney(row.marketCap)} />
            <Field label="Exchange" value={row.exchange ?? '—'} />
          </section>

          {row.underwriters?.length ? (
            <section>
              <h3 className="eyebrow mb-1.5">Lead underwriters</h3>
              <div className="flex flex-wrap gap-1.5">
                {row.underwriters.map((u, i) => (
                  <span key={`${u}-${i}`} className="chip">
                    {u}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {row.filingUrl ? (
            <a
              href={row.filingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs"
            >
              View filing <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="num mt-0.5 text-ink">{value}</p>
    </div>
  )
}

// ── Summary cards ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, hint }) {
  return (
    <div className="panel panel-hover panel-pad">
      <p className="eyebrow">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-3">{hint}</p> : null}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

const IPO_FILTERS = [
  { id: 'significant', label: 'Significant', icon: Sparkles },
  { id: 'all', label: 'All' },
  { id: 'priced', label: 'Priced' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'filed', label: 'Filed' },
]

export function IpoCalendarTab() {
  const navigate = useNavigate()
  const [view, setView] = useState('upcoming')
  const [filter, setFilter] = useState('significant')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState({ key: 'date', dir: 'asc' })
  const [selected, setSelected] = useState(null)

  // Re-default sort dir whenever the view flips, but don't override if user has chosen.
  useEffect(() => {
    setSort((prev) =>
      prev.key === 'date' ? { key: 'date', dir: view === 'upcoming' ? 'asc' : 'desc' } : prev,
    )
  }, [view])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { from, to } = rangeFor(view)
      const res = await fetch(apiUrl(`/api/ipo-calendar?from=${from}&to=${to}`))
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load IPO calendar')
      setRows(Array.isArray(json.rows) ? json.rows : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let out = rows
    if (filter === 'significant') out = out.filter((r) => r.isSignificant)
    else if (filter === 'priced') out = out.filter((r) => r.status === 'PRICED')
    else if (filter === 'upcoming') out = out.filter((r) => r.status === 'UPCOMING')
    else if (filter === 'filed') out = out.filter((r) => r.status === 'FILED')
    if (filter === 'significant' && sort.key === 'date') {
      // Lead with importance when looking at the curated significant list.
      return [...out].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    }
    return [...out].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir))
  }, [rows, filter, sort])

  const significantCount = useMemo(() => rows.filter((r) => r.isSignificant).length, [rows])

  const summary = useMemo(() => {
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let monthCount = 0
    let totalRaise = 0
    const mids = []
    for (const r of rows) {
      if (typeof r.date === 'string' && r.date.startsWith(monthKey)) monthCount += 1
      if (Number.isFinite(r.estRaise)) totalRaise += r.estRaise
      if (Number.isFinite(r.priceRangeMidpoint)) mids.push(r.priceRangeMidpoint)
    }
    const avgMid = mids.length ? mids.reduce((a, b) => a + b, 0) / mids.length : null
    return { monthCount, totalRaise, avgMid }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="rise rise-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex gap-1 rounded-xl border border-line bg-surface-1 p-1">
          {[
            { id: 'upcoming', label: 'Upcoming · 60d' },
            { id: 'recent', label: 'Recent · 90d' },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={[
                'rounded-lg px-4 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                view === v.id ? 'bg-surface-3 text-flame' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              ].join(' ')}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {IPO_FILTERS.map((f) => {
            const active = filter === f.id
            const Icon = f.icon
            const isSig = f.id === 'significant'
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                  active
                    ? isSig
                      ? 'border-ember/30 bg-ember/10 text-flame'
                      : 'border-line-strong bg-surface-3 text-ink'
                    : 'border-line bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink',
                ].join(' ')}
              >
                {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
                {f.label}
                {isSig && significantCount > 0 ? (
                  <span className={['num text-[10px]', active ? 'text-flame/80' : 'text-ink-3'].join(' ')}>
                    {significantCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rise rise-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="IPOs this month"
          value={loading ? '—' : summary.monthCount.toLocaleString()}
          hint={view === 'upcoming' ? 'Scheduled in current month' : 'Listed in current month'}
        />
        <SummaryCard
          label="Total est. raise"
          value={loading ? '—' : `$${(summary.totalRaise / 1e9).toFixed(2)}B`}
          hint="Σ midpoint × shares offered"
        />
        <SummaryCard
          label="Avg price midpoint"
          value={loading ? '—' : summary.avgMid != null ? `$${summary.avgMid.toFixed(2)}` : '—'}
          hint="Across deals with disclosed range"
        />
      </div>

      <div className="rise rise-5">
        <DashboardCard
          title={loading ? 'Loading IPO calendar…' : `${filtered.length.toLocaleString()} deal${filtered.length === 1 ? '' : 's'}`}
          action={
            filter === 'significant' ? (
              <span className="text-[11px] text-ink-3">Sorted by importance</span>
            ) : null
          }
        >
          <div className="-mx-4 -my-4 sm:-mx-5 sm:-my-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-ink-3">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
              </div>
            ) : error ? (
              <div className="m-5 rounded-xl border border-down/25 bg-down/5 p-6 text-sm">
                <p className="font-medium text-down">Couldn’t load IPO calendar</p>
                <p className="mt-1 text-ink-2">{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <CalendarX className="size-8 text-ink-3" aria-hidden />
                <p className="text-sm text-ink-3">
                  {rows.length === 0 ? (
                    <>No IPOs found for the {view === 'upcoming' ? 'upcoming 60 days' : 'past 90 days'}.</>
                  ) : filter === 'significant' ? (
                    <>No IPOs cleared the significance threshold in this window.</>
                  ) : (
                    <>No IPOs match the “{filter}” filter in this window.</>
                  )}
                </p>
                {rows.length > 0 && filter !== 'all' ? (
                  <button type="button" onClick={() => setFilter('all')} className="btn-ghost text-xs">
                    Show all {rows.length.toLocaleString()} deal{rows.length === 1 ? '' : 's'}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="tbl rounded-none border-0 bg-transparent">
                <table className="min-w-[1200px]">
                  <thead>
                    <tr>
                      <SortHeader label="Date" sortKey="date" sort={sort} setSort={setSort} />
                      <SortHeader label="Symbol" sortKey="symbol" sort={sort} setSort={setSort} />
                      <SortHeader label="Company" sortKey="company" sort={sort} setSort={setSort} />
                      <SortHeader label="Exchange" sortKey="exchange" sort={sort} setSort={setSort} />
                      <SortHeader label="Sector" sortKey="sector" sort={sort} setSort={setSort} />
                      <SortHeader label="Price range" sortKey="priceRangeMidpoint" sort={sort} setSort={setSort} align="right" />
                      <SortHeader label="Shares" sortKey="shares" sort={sort} setSort={setSort} align="right" />
                      <SortHeader label="Est. raise" sortKey="estRaise" sort={sort} setSort={setSort} align="right" />
                      <SortHeader label="Status" sortKey="status" sort={sort} setSort={setSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr
                        key={`${r.symbol ?? r.company ?? 'row'}-${r.date ?? ''}-${i}`}
                        onClick={() => setSelected(r)}
                        className={['cursor-pointer', r.isSignificant ? 'bg-ember/5' : ''].join(' ')}
                      >
                        <td
                          className={[
                            'whitespace-nowrap border-l-2',
                            r.isSignificant ? 'border-l-ember/60' : 'border-l-transparent',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="num">{fmtDate(r.date)}</span>
                            {r.isSignificant ? <SignificantBadge /> : null}
                          </div>
                        </td>
                        <td>
                          {r.symbol ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${r.symbol}`) }}
                              className="num text-[13px] font-semibold text-ink outline-none transition-colors duration-150 hover:text-ember focus-visible:ring-2 focus-visible:ring-ember/60"
                            >
                              {r.symbol}
                            </button>
                          ) : <span className="text-ink-3">—</span>}
                        </td>
                        <td className="max-w-[20rem] truncate text-ink" title={r.company ?? ''}>
                          {r.company ?? '—'}
                        </td>
                        <td><ExchangePill exchange={r.exchange} /></td>
                        <td className="max-w-[14rem] truncate text-ink-3" title={r.sector ?? ''}>
                          {r.sector ?? '—'}
                        </td>
                        <td className="num whitespace-nowrap">
                          {fmtRange(r.priceRangeLow, r.priceRangeHigh)}
                        </td>
                        <td className="num whitespace-nowrap">
                          {fmtShares(r.shares)}
                        </td>
                        <td className="num whitespace-nowrap font-semibold text-ink">
                          {fmtMoney(r.estRaise)}
                        </td>
                        <td><StatusPill status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DashboardCard>
      </div>

      <IpoDetailModal row={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
