import { ArrowDown, ArrowUp, ExternalLink, Loader2, Sparkles, X } from 'lucide-react'
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

const STATUS_PILL = {
  UPCOMING:  'bg-teal-500/[0.08] text-teal-300/90 ring-teal-400/20',
  PRICED:    'bg-emerald-500/[0.08] text-emerald-300/90 ring-emerald-400/20',
  FILED:     'bg-amber-500/[0.07] text-amber-200/90 ring-amber-400/20',
  WITHDRAWN: 'bg-rose-500/[0.08] text-rose-300/90 ring-rose-400/20',
}
const STATUS_LABEL = {
  UPCOMING: 'Upcoming',
  PRICED: 'Priced',
  FILED: 'Filed',
  WITHDRAWN: 'Withdrawn',
}
function StatusPill({ status }) {
  const cls = STATUS_PILL[status] ?? STATUS_PILL.UPCOMING
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>
      {STATUS_LABEL[status] ?? 'Upcoming'}
    </span>
  )
}

function SignificantBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent ring-1 ring-accent/25"
      title="Large IPO or major-exchange listing with disclosed range"
    >
      <Sparkles className="size-2.5" /> Key
    </span>
  )
}

const EXCHANGE_PILL = {
  NASDAQ: 'bg-sky-500/[0.07] text-sky-300/90 ring-sky-400/15',
  NYSE:   'bg-violet-500/[0.07] text-violet-300/90 ring-violet-400/15',
  AMEX:   'bg-zinc-500/[0.08] text-zinc-300 ring-zinc-400/15',
}
function ExchangePill({ exchange }) {
  if (!exchange) return <span className="text-zinc-600">—</span>
  const cls = EXCHANGE_PILL[exchange] ?? 'bg-white/[0.04] text-zinc-300 ring-white/10'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>
      {exchange}
    </span>
  )
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
    <th className={`px-6 py-4 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] transition ${active ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        {label}
        {active ? (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : null}
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
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900/95 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {row.symbol ? (
                <span className="font-mono text-base font-semibold tracking-tight text-zinc-100">{row.symbol}</span>
              ) : null}
              <ExchangePill exchange={row.exchange} />
              <StatusPill status={row.status} />
            </div>
            <h2 className="mt-1 truncate text-sm text-zinc-300">{row.company ?? '—'}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{fmtDate(row.date)}{row.sector ? ` · ${row.sector}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 text-sm">
          {row.description ? (
            <section>
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">About</h3>
              <p className="text-zinc-300">{row.description}</p>
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
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                Lead underwriters
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {row.underwriters.map((u, i) => (
                  <span
                    key={`${u}-${i}`}
                    className="inline-flex items-center rounded-md bg-white/[0.04] px-2 py-0.5 text-[12px] text-zinc-300 ring-1 ring-white/10"
                  >
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-1.5 text-sm font-medium text-accent ring-1 ring-accent/25 transition hover:bg-accent/20"
            >
              View filing <ExternalLink className="size-3.5" />
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
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <p className="mt-0.5 tabular-nums text-zinc-100">{value}</p>
    </div>
  )
}

// ── Summary cards ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900/50 px-6 py-5 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.55)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-zinc-100">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
          {[
            { id: 'upcoming', label: 'Upcoming · 60d' },
            { id: 'recent', label: 'Recent · 90d' },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={[
                'rounded-lg px-4 py-1.5 text-xs font-medium transition',
                view === v.id
                  ? 'bg-white/[0.06] text-zinc-100 ring-1 ring-white/10'
                  : 'text-zinc-500 hover:text-zinc-300',
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
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  active
                    ? isSig
                      ? 'bg-accent/12 text-accent ring-1 ring-accent/25'
                      : 'bg-white/[0.07] text-zinc-100 ring-1 ring-white/15'
                    : 'border border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200',
                ].join(' ')}
              >
                {Icon ? <Icon className="size-3.5" /> : null}
                {f.label}
                {isSig && significantCount > 0 ? (
                  <span className={`tabular-nums text-[10px] ${active ? 'text-accent/80' : 'text-zinc-500'}`}>
                    {significantCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      <DashboardCard
        title={loading ? 'Loading IPO calendar…' : `${filtered.length.toLocaleString()} deal${filtered.length === 1 ? '' : 's'}`}
        action={
          filter === 'significant' ? (
            <span className="text-[11px] text-zinc-500">Sorted by importance</span>
          ) : null
        }
        className="p-0"
      >
        <div className="-mx-5 -my-5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="m-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-300">
              <p className="font-medium">Couldn’t load IPO calendar</p>
              <p className="mt-1 text-rose-200/80">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm text-zinc-500">
              {rows.length === 0 ? (
                <>No IPOs found for the {view === 'upcoming' ? 'upcoming 60 days' : 'past 90 days'}.</>
              ) : filter === 'significant' ? (
                <>
                  No IPOs cleared the significance threshold in this window.{' '}
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="text-accent transition hover:text-accent/80"
                  >
                    Show all {rows.length.toLocaleString()} deal{rows.length === 1 ? '' : 's'}
                  </button>
                  .
                </>
              ) : (
                <>No IPOs match the “{filter}” filter in this window.</>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-white/[0.015] text-[11px]">
                  <tr className="border-b border-white/[0.06]">
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
                <tbody className="divide-y divide-white/[0.05]">
                  {filtered.map((r, i) => (
                    <tr
                      key={`${r.symbol ?? r.company ?? 'row'}-${r.date ?? ''}-${i}`}
                      onClick={() => setSelected(r)}
                      className={[
                        'cursor-pointer transition-colors hover:bg-white/[0.025]',
                        r.isSignificant ? 'bg-accent/[0.025]' : '',
                      ].join(' ')}
                    >
                      <td
                        className={[
                          'whitespace-nowrap px-6 py-5 text-zinc-400',
                          r.isSignificant ? 'border-l-2 border-l-accent/50' : 'border-l-2 border-l-transparent',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{fmtDate(r.date)}</span>
                          {r.isSignificant ? <SignificantBadge /> : null}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {r.symbol ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${r.symbol}`) }}
                            className="font-mono text-[13px] font-semibold text-zinc-100 transition hover:text-accent"
                          >
                            {r.symbol}
                          </button>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="max-w-[20rem] truncate px-6 py-5 text-zinc-200" title={r.company ?? ''}>
                        {r.company ?? '—'}
                      </td>
                      <td className="px-6 py-5"><ExchangePill exchange={r.exchange} /></td>
                      <td className="max-w-[14rem] truncate px-6 py-5 text-zinc-400" title={r.sector ?? ''}>
                        {r.sector ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-right tabular-nums text-zinc-300">
                        {fmtRange(r.priceRangeLow, r.priceRangeHigh)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-right tabular-nums text-zinc-300">
                        {fmtShares(r.shares)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-right tabular-nums font-semibold text-zinc-100">
                        {fmtMoney(r.estRaise)}
                      </td>
                      <td className="px-6 py-5"><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardCard>

      <IpoDetailModal row={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
