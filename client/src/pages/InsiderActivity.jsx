import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Flame, Loader2, Search } from 'lucide-react'
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
  { id: 'significant', label: 'Significant', icon: Flame },
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
  PURCHASE: 'chip-up',
  SALE:     'chip-down',
  OPTION:   'chip-warn',
  GIFT:     '',
  AWARD:    'border-flame/25 bg-flame/10 text-flame',
  TAX:      '',
  OTHER:    '',
  EXCHANGE: 'chip-warn',
}

function TxnPill({ code, label }) {
  const cls = TXN_PILL[code] ?? TXN_PILL.OTHER
  const isBuy = code === 'PURCHASE'
  const isSell = code === 'SALE'
  return (
    <span className={`chip ${cls}`}>
      {isBuy ? <ArrowUp className="size-3" aria-hidden /> : isSell ? <ArrowDown className="size-3" aria-hidden /> : null}
      {label}
    </span>
  )
}

function NewDot() {
  return (
    <span
      className="inline-block size-1.5 shrink-0 rounded-full bg-up shadow-[0_0_6px_rgba(61,220,151,0.6)]"
      title="Filed within the last 7 days"
      aria-label="New"
    />
  )
}

function SignificantBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-ember/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-flame ring-1 ring-ember/25"
      title="Officer/director purchase or large-dollar trade"
    >
      <Flame className="size-2.5" aria-hidden /> Key
    </span>
  )
}

function ChamberPill({ chamber }) {
  if (!chamber) return <span className="text-ink-3">—</span>
  return <span className="chip">{chamber}</span>
}

function PartyPill({ party }) {
  if (!party) return <span className="text-ink-3">—</span>
  const map = {
    D: 'border-up/25 bg-up/10 text-up',
    R: 'border-down/25 bg-down/10 text-down',
    I: 'border-line bg-surface-2 text-ink-2',
  }
  return (
    <span className={`inline-flex size-6 items-center justify-center rounded-md border text-[11px] font-semibold ${map[party] ?? map.I}`}>
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
    <th className={align === 'right' ? 'num' : align === 'center' ? 'text-center' : ''}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ember/60 transition ${active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}
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
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        value={local}
        onChange={(e) => handle(e.target.value)}
        placeholder="Filter by symbol (e.g. AAPL)"
        maxLength={12}
        aria-label="Filter by symbol"
        className="input num pl-9 uppercase tracking-wide"
      />
    </div>
  )
}

// ── Filter tabs (quiet segmented control) ────────────────────────────────────

function FilterTabs({ filters, filter, setFilter, significantCount }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {filters.map((f) => {
        const active = filter === f.id
        const Icon = f.icon
        const isSig = f.id === 'significant'
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={active}
            onClick={() => setFilter(f.id)}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
              active
                ? 'bg-ember/10 text-flame ring-1 ring-ember/25'
                : 'border border-line bg-surface-2 text-ink-3 hover:bg-surface-3 hover:text-ink-2',
            ].join(' ')}
          >
            {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
            {f.label}
            {isSig && significantCount > 0 ? (
              <span className={`num text-[10px] ${active ? 'text-flame/80' : 'text-ink-3'}`}>
                {significantCount}
              </span>
            ) : null}
          </button>
        )
      })}
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
        <FilterTabs
          filters={INSIDER_FILTERS}
          filter={filter}
          setFilter={(id) => { setFilter(id); setPage(0) }}
          significantCount={significantCount}
        />
      </div>

      <DashboardCard
        title={
          loading
            ? 'Loading insider trades…'
            : `${filtered.length.toLocaleString()} trade${filtered.length === 1 ? '' : 's'}`
        }
        action={
          filter === 'significant' ? (
            <span className="text-[11px] text-ink-3">Sorted by importance</span>
          ) : null
        }
        className="p-0"
      >
        <div className="-mx-4 -my-4 sm:-mx-5 sm:-my-5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-ink-3">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Loading…
            </div>
          ) : error ? (
            <div className="m-5 rounded-xl border border-down/25 bg-down/5 p-6 text-sm text-down">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm text-ink-3">
              No insider trades match {symbol ? `“${symbol}”` : 'the current filter'}.
            </div>
          ) : (
            <div className="tbl rounded-none border-0 bg-transparent">
              <table className="min-w-[1100px]">
                <thead>
                  <tr>
                    <SortHeader label="Date" sortKey="transactionDate" sort={sort} setSort={setSort} />
                    <SortHeader label="Symbol" sortKey="symbol" sort={sort} setSort={setSort} />
                    <SortHeader label="Company" sortKey="company" sort={sort} setSort={setSort} />
                    <SortHeader label="Insider" sortKey="insiderName" sort={sort} setSort={setSort} />
                    <SortHeader label="Title" sortKey="title" sort={sort} setSort={setSort} />
                    <SortHeader label="Type" sortKey="transactionType" sort={sort} setSort={setSort} />
                    <SortHeader label="Shares" sortKey="shares" sort={sort} setSort={setSort} align="right" />
                    <SortHeader label="Value" sortKey="value" sort={sort} setSort={setSort} align="right" />
                    <th className="text-center">Dir</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => (
                    <tr
                      key={`${r.symbol}-${r.transactionDate}-${i}`}
                      className={r.isSignificant ? 'bg-ember/8 ring-1 ring-inset ring-ember/25' : ''}
                    >
                      <td className="whitespace-nowrap text-ink-2">
                        <div className="flex items-center gap-1.5">
                          <span className="num">{fmtDate(r.transactionDate)}</span>
                          {isWithinDays(r.filingDate ?? r.transactionDate, NEW_WINDOW_DAYS) ? <NewDot /> : null}
                          {r.isSignificant ? <SignificantBadge /> : null}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/analysis/${r.symbol}`)}
                          className="num text-[13px] font-semibold text-ink transition hover:text-flame outline-none focus-visible:ring-2 focus-visible:ring-ember/60 rounded"
                        >
                          {r.symbol}
                        </button>
                      </td>
                      <td className="max-w-[18rem] truncate text-ink-2" title={r.company ?? ''}>{r.company ?? '—'}</td>
                      <td className="text-ink">{r.insiderName ?? '—'}</td>
                      <td className="max-w-[16rem] truncate text-ink-3" title={r.title ?? ''}>{r.title ?? '—'}</td>
                      <td><TxnPill code={r.transactionType} label={r.transactionLabel} /></td>
                      <td className="num text-ink-2">{fmtShares(r.shares)}</td>
                      <td className="num font-semibold text-ink">{fmtMoney(r.value)}</td>
                      <td className="text-center">
                        {r.direction === 'up' ? <ArrowUp className="mx-auto size-4 text-up" aria-label="Up" />
                          : r.direction === 'down' ? <ArrowDown className="mx-auto size-4 text-down" aria-label="Down" />
                          : <span className="text-ink-3">—</span>}
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
  { id: 'significant', label: 'Significant', icon: Flame },
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
        <FilterTabs
          filters={CONGRESS_FILTERS}
          filter={filter}
          setFilter={(id) => { setFilter(id); setPage(0) }}
          significantCount={significantCount}
        />
      </div>

      <DashboardCard
        title={loading ? 'Loading congressional trades…' : `${filtered.length.toLocaleString()} trade${filtered.length === 1 ? '' : 's'}`}
        action={filter === 'significant' ? <span className="text-[11px] text-ink-3">Sorted by importance</span> : null}
        className="p-0"
      >
        <div className="-mx-4 -my-4 sm:-mx-5 sm:-my-5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-ink-3">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Loading…
            </div>
          ) : error ? (
            <div className="m-5 rounded-xl border border-down/25 bg-down/5 p-6 text-sm text-down">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm text-ink-3">
              No congressional trades match {symbol ? `“${symbol}”` : 'the current filter'}.
            </div>
          ) : (
            <div className="tbl rounded-none border-0 bg-transparent">
              <table className="min-w-[1100px]">
                <thead>
                  <tr>
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
                <tbody>
                  {pageRows.map((r, i) => (
                    <tr
                      key={`${r.symbol}-${r.transactionDate}-${r.memberName}-${i}`}
                      className={r.isSignificant ? 'bg-ember/8 ring-1 ring-inset ring-ember/25' : ''}
                    >
                      <td className="whitespace-nowrap text-ink-2">
                        <div className="flex items-center gap-1.5">
                          <span className="num">{fmtDate(r.transactionDate)}</span>
                          {r.isSignificant ? <SignificantBadge /> : null}
                        </div>
                      </td>
                      <td>
                        {r.symbol ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/analysis/${r.symbol}`)}
                            className="num text-[13px] font-semibold text-ink transition hover:text-flame outline-none focus-visible:ring-2 focus-visible:ring-ember/60 rounded"
                          >
                            {r.symbol}
                          </button>
                        ) : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="max-w-[18rem] truncate text-ink-2" title={r.company ?? ''}>{r.company ?? '—'}</td>
                      <td className="text-ink">{r.memberName ?? '—'}</td>
                      <td><ChamberPill chamber={r.chamber} /></td>
                      <td><PartyPill party={r.party} /></td>
                      <td><TxnPill code={r.transactionType} label={r.transactionLabel} /></td>
                      <td className="num whitespace-nowrap text-ink-2">
                        {r.amountRange ?? '—'}
                      </td>
                      <td className="num whitespace-nowrap text-ink-3">{fmtDate(r.filingDate)}</td>
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
    <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4 text-xs text-ink-3">
      <span className="num">{start}–{end} of {total.toLocaleString()}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="btn-ghost h-8 px-2.5 text-xs"
        >
          <ChevronLeft className="size-3.5" aria-hidden /> Prev
        </button>
        <span className="num text-ink-2">{page + 1} / {pageCount}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
          className="btn-ghost h-8 px-2.5 text-xs"
        >
          Next <ChevronRight className="size-3.5" aria-hidden />
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
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">Insider activity · US equities</p>
        <h1 className="display text-2xl sm:text-3xl">Insider Activity</h1>
        <div className="ember-rule mt-4" />
      </header>

      <div className="rise rise-1 inline-flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(t.id)}
              className={[
                'rounded-lg px-4 py-1.5 text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                active
                  ? 'bg-ember/10 text-flame ring-1 ring-ember/25'
                  : 'text-ink-3 hover:text-ink-2',
              ].join(' ')}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="rise rise-2">
        {tab === 'insider' ? <InsiderTab token={token} /> : <CongressTab token={token} />}
      </div>
    </div>
  )
}
