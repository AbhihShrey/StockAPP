import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardCard } from '../components/DashboardCard'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

const PAGE_SIZE = 50
const REFRESH_MS = 15 * 60 * 1000
const NEW_WINDOW_DAYS = 7

const TABS = [
  { id: 'insider', label: 'Insider Trading' },
  { id: 'congress', label: 'Congressional Trading' },
]

const INSIDER_FILTERS = [
  { id: 'significant', label: 'Significant', icon: Sparkles },
  { id: 'all', label: 'All' },
  { id: 'purchase', label: 'Purchases' },
  { id: 'sale', label: 'Sales' },
  { id: 'officer', label: 'Officers' },
  { id: 'director', label: 'Directors' },
]

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtShares(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

function fmtMoney(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const diffMs = Date.now() - d.getTime()
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000
}

// ── Pills ────────────────────────────────────────────────────────────────────

const TXN_PILL = {
  PURCHASE: 'bg-emerald-500/[0.07] text-emerald-300/90 ring-emerald-400/15',
  SALE:     'bg-rose-500/[0.07] text-rose-300/90 ring-rose-400/15',
  OPTION:   'bg-amber-500/[0.06] text-amber-200/85 ring-amber-400/15',
  GIFT:     'bg-white/[0.04] text-zinc-300 ring-white/10',
  AWARD:    'bg-sky-500/[0.06] text-sky-200/85 ring-sky-400/15',
  TAX:      'bg-white/[0.03] text-zinc-400 ring-white/10',
  OTHER:    'bg-white/[0.03] text-zinc-400 ring-white/10',
  EXCHANGE: 'bg-amber-500/[0.06] text-amber-200/85 ring-amber-400/15',
}

function TxnPill({ code, label }) {
  const cls = TXN_PILL[code] ?? TXN_PILL.OTHER
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>
      {label}
    </span>
  )
}

function NewDot() {
  return (
    <span
      className="inline-block size-1.5 shrink-0 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.6)]"
      title="Filed within the last 7 days"
      aria-label="New"
    />
  )
}

function SignificantBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent ring-1 ring-accent/25"
      title="Officer/director purchase or large-dollar trade"
    >
      <Sparkles className="size-2.5" /> Key
    </span>
  )
}

function ChamberPill({ chamber }) {
  if (!chamber) return <span className="text-zinc-600">—</span>
  const isSenate = chamber === 'Senate'
  const cls = isSenate
    ? 'bg-violet-500/[0.07] text-violet-300/90 ring-violet-400/15'
    : 'bg-cyan-500/[0.07] text-cyan-300/90 ring-cyan-400/15'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>
      {chamber}
    </span>
  )
}

function PartyPill({ party }) {
  if (!party) return <span className="text-zinc-600">—</span>
  const map = {
    D: 'bg-blue-500/[0.08] text-blue-300/90 ring-blue-400/15',
    R: 'bg-rose-500/[0.08] text-rose-300/90 ring-rose-400/15',
    I: 'bg-white/[0.04] text-zinc-300 ring-white/10',
  }
  return (
    <span className={`inline-flex size-6 items-center justify-center rounded-md text-[11px] font-semibold ring-1 ${map[party]}`}>
      {party}
    </span>
  )
}

// ── Sortable header ──────────────────────────────────────────────────────────

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

// ── Symbol filter input (debounced) ─────────────────────────────────────────

function SymbolFilter({ value, onChange }) {
  const [local, setLocal] = useState(value)
  const timer = useRef(null)
  useEffect(() => { setLocal(value) }, [value])
  const handle = (v) => {
    setLocal(v.toUpperCase())
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v.trim().toUpperCase()), 400)
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
      <input
        value={local}
        onChange={(e) => handle(e.target.value)}
        placeholder="Filter by symbol (e.g. AAPL)"
        maxLength={12}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 font-mono text-sm uppercase tracking-wide text-zinc-100 outline-none placeholder:text-zinc-600 transition focus:border-white/15 focus:bg-white/[0.05] sm:w-72"
      />
    </div>
  )
}

// ── Insider tab ─────────────────────────────────────────────────────────────

function InsiderTab({ token }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [symbol, setSymbol] = useState('')
  const [filter, setFilter] = useState('significant')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState({ key: 'transactionDate', dir: 'desc' })

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const url = symbol
        ? apiUrl(`/api/insider-trading?symbol=${encodeURIComponent(symbol)}`)
        : apiUrl('/api/insider-trading')
      const res = await fetch(url, { headers: authHeaders(token) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load insider trades')
      setRows(Array.isArray(json.rows) ? json.rows : [])
      setError(null)
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [symbol, token])

  useEffect(() => { setPage(0); load() }, [load])
  useEffect(() => {
    const id = window.setInterval(() => load(true), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  const filtered = useMemo(() => {
    let out = rows
    if (filter === 'significant') out = out.filter((r) => r.isSignificant)
    else if (filter === 'purchase') out = out.filter((r) => r.transactionType === 'PURCHASE')
    else if (filter === 'sale') out = out.filter((r) => r.transactionType === 'SALE')
    else if (filter === 'officer') out = out.filter((r) => r.role === 'officer')
    else if (filter === 'director') out = out.filter((r) => r.role === 'director')
    // When viewing the curated "Significant" feed, lead with importance; otherwise honor the user's sort.
    if (filter === 'significant' && sort.key === 'transactionDate' && sort.dir === 'desc') {
      return [...out].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    }
    return [...out].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir))
  }, [rows, filter, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const significantCount = useMemo(() => rows.filter((r) => r.isSignificant).length, [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SymbolFilter value={symbol} onChange={(v) => { setSymbol(v); setPage(0) }} />
        <div className="flex flex-wrap gap-1.5">
          {INSIDER_FILTERS.map((f) => {
            const active = filter === f.id
            const Icon = f.icon
            const isSig = f.id === 'significant'
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => { setFilter(f.id); setPage(0) }}
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

      <DashboardCard
        title={
          loading
            ? 'Loading insider trades…'
            : `${filtered.length.toLocaleString()} trade${filtered.length === 1 ? '' : 's'}`
        }
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
            <div className="m-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-300">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm text-zinc-500">
              No insider trades match {symbol ? `“${symbol}”` : 'the current filter'}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-white/[0.015] text-[11px]">
                  <tr className="border-b border-white/[0.06]">
                    <SortHeader label="Date" sortKey="transactionDate" sort={sort} setSort={setSort} />
                    <SortHeader label="Symbol" sortKey="symbol" sort={sort} setSort={setSort} />
                    <SortHeader label="Company" sortKey="company" sort={sort} setSort={setSort} />
                    <SortHeader label="Insider" sortKey="insiderName" sort={sort} setSort={setSort} />
                    <SortHeader label="Title" sortKey="title" sort={sort} setSort={setSort} />
                    <SortHeader label="Type" sortKey="transactionType" sort={sort} setSort={setSort} />
                    <SortHeader label="Shares" sortKey="shares" sort={sort} setSort={setSort} align="right" />
                    <SortHeader label="Value" sortKey="value" sort={sort} setSort={setSort} align="right" />
                    <th className="px-6 py-4 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">Dir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {pageRows.map((r, i) => (
                    <tr
                      key={`${r.symbol}-${r.transactionDate}-${i}`}
                      className={[
                        'transition-colors hover:bg-white/[0.025]',
                        r.isSignificant ? 'bg-accent/[0.025]' : '',
                      ].join(' ')}
                    >
                      <td className={[
                        'whitespace-nowrap px-6 py-5 text-zinc-400',
                        r.isSignificant ? 'border-l-2 border-l-accent/50' : 'border-l-2 border-l-transparent',
                      ].join(' ')}>
                        <div className="flex items-center gap-1.5">
                          <span>{fmtDate(r.transactionDate)}</span>
                          {isWithinDays(r.filingDate ?? r.transactionDate, NEW_WINDOW_DAYS) ? <NewDot /> : null}
                          {r.isSignificant ? <SignificantBadge /> : null}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <button
                          type="button"
                          onClick={() => navigate(`/analysis/${r.symbol}`)}
                          className="font-mono text-[13px] font-semibold text-zinc-100 transition hover:text-accent"
                        >
                          {r.symbol}
                        </button>
                      </td>
                      <td className="max-w-[18rem] truncate px-6 py-5 text-zinc-400" title={r.company ?? ''}>{r.company ?? '—'}</td>
                      <td className="px-6 py-5 text-zinc-200">{r.insiderName ?? '—'}</td>
                      <td className="max-w-[16rem] truncate px-6 py-5 text-zinc-500" title={r.title ?? ''}>{r.title ?? '—'}</td>
                      <td className="px-6 py-5"><TxnPill code={r.transactionType} label={r.transactionLabel} /></td>
                      <td className="px-6 py-5 text-right tabular-nums text-zinc-300">{fmtShares(r.shares)}</td>
                      <td className="px-6 py-5 text-right tabular-nums font-semibold text-zinc-100">{fmtMoney(r.value)}</td>
                      <td className="px-6 py-5 text-center">
                        {r.direction === 'up' ? <ArrowUp className="mx-auto size-4 text-emerald-400/85" />
                          : r.direction === 'down' ? <ArrowDown className="mx-auto size-4 text-rose-400/85" />
                          : <span className="text-zinc-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} />
            </div>
          )}
        </div>
      </DashboardCard>
    </div>
  )
}

// ── Congressional tab ───────────────────────────────────────────────────────

const CONGRESS_FILTERS = [
  { id: 'significant', label: 'Significant', icon: Sparkles },
  { id: 'all', label: 'All' },
  { id: 'purchase', label: 'Purchases' },
  { id: 'sale', label: 'Sales' },
  { id: 'senate', label: 'Senate' },
  { id: 'house', label: 'House' },
]

function CongressTab({ token }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [symbol, setSymbol] = useState('')
  const [filter, setFilter] = useState('significant')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState({ key: 'transactionDate', dir: 'desc' })

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const url = symbol
        ? apiUrl(`/api/congressional-trading?symbol=${encodeURIComponent(symbol)}`)
        : apiUrl('/api/congressional-trading')
      const res = await fetch(url, { headers: authHeaders(token) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load congressional trades')
      setRows(Array.isArray(json.rows) ? json.rows : [])
      setError(null)
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [symbol, token])

  useEffect(() => { setPage(0); load() }, [load])
  useEffect(() => {
    const id = window.setInterval(() => load(true), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  const filtered = useMemo(() => {
    let out = rows
    if (filter === 'significant') out = out.filter((r) => r.isSignificant)
    else if (filter === 'purchase') out = out.filter((r) => r.transactionType === 'PURCHASE')
    else if (filter === 'sale') out = out.filter((r) => r.transactionType === 'SALE')
    else if (filter === 'senate') out = out.filter((r) => r.chamber === 'Senate')
    else if (filter === 'house') out = out.filter((r) => r.chamber === 'House')
    if (filter === 'significant' && sort.key === 'transactionDate' && sort.dir === 'desc') {
      return [...out].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    }
    return [...out].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir))
  }, [rows, filter, sort])

  const significantCount = useMemo(() => rows.filter((r) => r.isSignificant).length, [rows])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SymbolFilter value={symbol} onChange={(v) => { setSymbol(v); setPage(0) }} />
        <div className="flex flex-wrap gap-1.5">
          {CONGRESS_FILTERS.map((f) => {
            const active = filter === f.id
            const Icon = f.icon
            const isSig = f.id === 'significant'
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => { setFilter(f.id); setPage(0) }}
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

      <DashboardCard
        title={loading ? 'Loading congressional trades…' : `${filtered.length.toLocaleString()} trade${filtered.length === 1 ? '' : 's'}`}
        action={filter === 'significant' ? <span className="text-[11px] text-zinc-500">Sorted by importance</span> : null}
        className="p-0"
      >
        <div className="-mx-5 -my-5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="m-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-300">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm text-zinc-500">
              No congressional trades match {symbol ? `“${symbol}”` : 'the current filter'}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-white/[0.015] text-[11px]">
                  <tr className="border-b border-white/[0.06]">
                    <SortHeader label="Date" sortKey="transactionDate" sort={sort} setSort={setSort} />
                    <SortHeader label="Symbol" sortKey="symbol" sort={sort} setSort={setSort} />
                    <SortHeader label="Company" sortKey="company" sort={sort} setSort={setSort} />
                    <SortHeader label="Member" sortKey="memberName" sort={sort} setSort={setSort} />
                    <SortHeader label="Chamber" sortKey="chamber" sort={sort} setSort={setSort} />
                    <SortHeader label="Party" sortKey="party" sort={sort} setSort={setSort} />
                    <SortHeader label="Type" sortKey="transactionType" sort={sort} setSort={setSort} />
                    <SortHeader label="Amount" sortKey="amountMid" sort={sort} setSort={setSort} align="right" />
                    <SortHeader label="Filed" sortKey="filingDate" sort={sort} setSort={setSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {pageRows.map((r, i) => (
                    <tr
                      key={`${r.symbol}-${r.transactionDate}-${r.memberName}-${i}`}
                      className={[
                        'transition-colors hover:bg-white/[0.025]',
                        r.isSignificant ? 'bg-accent/[0.025]' : '',
                      ].join(' ')}
                    >
                      <td className={[
                        'whitespace-nowrap px-6 py-5 text-zinc-400',
                        r.isSignificant ? 'border-l-2 border-l-accent/50' : 'border-l-2 border-l-transparent',
                      ].join(' ')}>
                        <div className="flex items-center gap-1.5">
                          <span>{fmtDate(r.transactionDate)}</span>
                          {r.isSignificant ? <SignificantBadge /> : null}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {r.symbol ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/analysis/${r.symbol}`)}
                            className="font-mono text-[13px] font-semibold text-zinc-100 transition hover:text-accent"
                          >
                            {r.symbol}
                          </button>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="max-w-[18rem] truncate px-6 py-5 text-zinc-400" title={r.company ?? ''}>{r.company ?? '—'}</td>
                      <td className="px-6 py-5 text-zinc-200">{r.memberName ?? '—'}</td>
                      <td className="px-6 py-5"><ChamberPill chamber={r.chamber} /></td>
                      <td className="px-6 py-5"><PartyPill party={r.party} /></td>
                      <td className="px-6 py-5"><TxnPill code={r.transactionType} label={r.transactionLabel} /></td>
                      <td className="whitespace-nowrap px-6 py-5 text-right tabular-nums text-zinc-300">
                        {r.amountRange ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-zinc-500">{fmtDate(r.filingDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} total={filtered.length} />
            </div>
          )}
        </div>
      </DashboardCard>
    </div>
  )
}

function Pagination({ page, pageCount, onChange, total }) {
  if (total <= PAGE_SIZE) return null
  const start = page * PAGE_SIZE + 1
  const end = Math.min(total, (page + 1) * PAGE_SIZE)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] px-6 py-4 text-xs text-zinc-500">
      <span className="tabular-nums">{start}–{end} of {total.toLocaleString()}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-zinc-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" /> Prev
        </button>
        <span className="tabular-nums text-zinc-400">{page + 1} / {pageCount}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
          className="inline-flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-zinc-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export function InsiderActivity() {
  const { token } = useAuth()
  const [tab, setTab] = useState('insider')

  return (
    <div className="app-page-enter space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Insider Activity</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Form 4 insider trades and Senate / House disclosures.</p>
      </header>

      <div className="inline-flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-lg px-4 py-1.5 text-xs font-medium transition',
              tab === t.id
                ? 'bg-white/[0.06] text-zinc-100 ring-1 ring-white/10'
                : 'text-zinc-500 hover:text-zinc-300',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'insider' ? <InsiderTab token={token} /> : <CongressTab token={token} />}
    </div>
  )
}
