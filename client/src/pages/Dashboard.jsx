import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, BarChart3, Bell,
  BookOpen, CalendarDays, Flame, Grid3x3, Layers,
  Minus, Moon, PieChart, Sun, TrendingUp,
} from 'lucide-react'
import { WatchlistMiniWidget } from '../components/WatchlistMiniWidget'
import { TradingViewTickerTape } from '../components/TradingViewTickerTape'
import { MiniSparkline } from '../components/MiniSparkline'
import { apiUrl } from '../lib/apiBase'

function formatPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

function formatPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`
}

async function loadJson(path) {
  const res = await fetch(apiUrl(path))
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* empty */ }
  if (!res.ok) throw new Error(json?.message ?? `Failed to load ${path}`)
  return json
}

function todayISO() { return new Date().toISOString().slice(0, 10) }

function getSessionInfo() {
  const etFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  })
  const now = new Date()
  const parts = etFmt.formatToParts(now)
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const timeStr = parts
    .filter((p) => ['hour', 'minute', 'literal', 'dayperiod'].includes(p.type))
    .map((p) => p.value).join('').replace(/\s+/g, ' ').trim()

  const h24 = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(now))
  const mm = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', minute: '2-digit' }).format(now))
  const total = h24 * 60 + mm
  const isWeekend = wd === 'Sat' || wd === 'Sun'
  const fmtR = (mins) => { const h = Math.floor(mins / 60); const m = mins % 60; return h > 0 ? `${h}h ${m}m` : `${m}m` }

  if (isWeekend) return { state: 'closed', label: 'Market closed', sub: `${timeStr} ET — reopens Mon 9:30 AM` }
  if (total >= 9 * 60 + 30 && total < 16 * 60) return { state: 'open', label: 'Market open', sub: `${timeStr} ET · ${fmtR(16 * 60 - total)} remaining` }
  if (total >= 16 * 60 && total < 20 * 60) return { state: 'after', label: 'After hours', sub: `${timeStr} ET` }
  if (total >= 4 * 60 && total < 9 * 60 + 30) return { state: 'pre', label: 'Premarket', sub: `${timeStr} ET · ${fmtR(9 * 60 + 30 - total)} until open` }
  return { state: 'closed', label: 'Market closed', sub: `${timeStr} ET — opens 9:30 AM` }
}

function PulseCard({ asset }) {
  if (!asset) return null
  const pct = Number(asset.changePercent ?? asset.changesPercentage)
  const price = Number(asset.price)
  const up = Number.isFinite(pct) && pct > 0
  const dn = Number.isFinite(pct) && pct < 0
  return (
    <div className="card-hover flex min-w-0 flex-col gap-0.5 rounded-xl border border-border-subtle bg-surface-1/50 px-3.5 py-3">
      <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{asset.symbol}</span>
      <span className="text-sm font-semibold tabular-nums text-zinc-100">{Number.isFinite(price) ? formatPrice(price) : '—'}</span>
      <span className={['text-[11px] font-medium tabular-nums', up ? 'text-emerald-400' : dn ? 'text-rose-400' : 'text-zinc-500'].join(' ')}>
        {Number.isFinite(pct) ? formatPct(pct) : '—'}
      </span>
    </div>
  )
}

function SessionIcon({ hint }) {
  if (hint === 'bmo') return <Sun className="size-3.5 text-amber-300/80" aria-label="Before market open" />
  if (hint === 'amc') return <Moon className="size-3.5 text-indigo-300/80" aria-label="After market close" />
  return <Minus className="size-3 text-zinc-600" />
}

function EarningsWidget({ rows, loading }) {
  if (loading) return (
    <div className="space-y-2 p-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-lg bg-white/[0.04]" />
      ))}
    </div>
  )
  if (!rows?.length) return <p className="py-4 text-center text-xs text-zinc-600">No earnings scheduled today.</p>
  return (
    <div className="divide-y divide-border-subtle/40">
      {rows.slice(0, 6).map((r, i) => (
        <div key={`${r.symbol}-${i}`} className="flex items-center gap-3 px-1 py-2">
          <SessionIcon hint={r.sessionHint} />
          <span className="min-w-[3rem] font-mono text-xs font-semibold text-zinc-100">{r.symbol}</span>
          <span className="flex-1 truncate text-[11px] text-zinc-500">{r.name ?? ''}</span>
          {r.epsEstimate != null && (
            <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
              est <span className="text-zinc-300">${Number(r.epsEstimate).toFixed(2)}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function MacroWidget({ rows, loading }) {
  const highOnly = useMemo(() => (rows ?? []).filter((r) => r.impactLevel === 'high').slice(0, 5), [rows])
  if (loading) return (
    <div className="space-y-2 p-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-lg bg-white/[0.04]" />
      ))}
    </div>
  )
  if (!highOnly.length) return <p className="py-4 text-center text-xs text-zinc-600">No high-impact events this week.</p>
  return (
    <div className="divide-y divide-border-subtle/40">
      {highOnly.map((ev, i) => (
        <div key={i} className="flex items-start gap-3 px-1 py-2">
          <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-rose-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-zinc-200">{ev.event}</p>
            <p className="text-[10px] text-zinc-600">
              {ev.country} · {String(ev.date ?? '').slice(0, 10)}
              {ev.forecast ? <> · est <span className="text-zinc-400">{ev.forecast}</span></> : null}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

const NAV_LINKS = [
  { to: '/markets',    icon: TrendingUp,  label: 'Markets',    desc: 'Macro, breadth, sentiment' },
  { to: '/alerts',     icon: Bell,        label: 'Alerts',     desc: 'Price & VWAP crossings' },
  { to: '/charts',     icon: BarChart3,   label: 'Charts',     desc: 'Technical analysis' },
  { to: '/sectors',    icon: Grid3x3,     label: 'Sectors',    desc: 'Rotation, RRG, heatmap' },
  { to: '/watchlist',  icon: Layers,      label: 'Watchlist',  desc: 'Your tracked symbols' },
  { to: '/portfolio',  icon: PieChart,    label: 'Portfolio',  desc: 'P&L & allocation' },
  { to: '/news',       icon: BookOpen,    label: 'News',       desc: 'Headlines & earnings' },
  ...(import.meta.env.VITE_FEATURE_BACKTEST === '1'
    ? [{ to: '/strategies', icon: BarChart3, label: 'Strategies', desc: 'Backtest & replay' }]
    : []),
]

export function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pulse, setPulse] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [earningsLoading, setEarningsLoading] = useState(true)
  const [macro, setMacro] = useState(null)
  const [macroLoading, setMacroLoading] = useState(true)
  const [pollMs, setPollMs] = useState(30_000)
  const [tick, setTick] = useState(0)

  const load = useCallback(async (opts) => {
    const silent = Boolean(opts?.silent)
    if (!silent) { setLoading(true); setError(null) }
    try {
      const [summary, assets] = await Promise.all([
        loadJson('/api/market-summary'),
        loadJson('/api/global-assets').catch(() => null),
      ])
      setData(summary)
      if (assets?.groups) setPulse(assets.groups)
      const ri = Number(summary?.refreshIntervalMs)
      if (Number.isFinite(ri) && ri >= 15_000) setPollMs(ri)
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Load calendars once on mount
  useEffect(() => {
    const today = todayISO()
    fetch(apiUrl(`/api/earnings-calendar?date=${today}`))
      .then((r) => r.json()).then((j) => setEarnings(Array.isArray(j.rows) ? j.rows : [])).catch(() => setEarnings([]))
      .finally(() => setEarningsLoading(false))
    fetch(apiUrl(`/api/economic-calendar?date=${today}`))
      .then((r) => r.json()).then((j) => setMacro(Array.isArray(j.rows) ? j.rows : [])).catch(() => setMacro([]))
      .finally(() => setMacroLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = window.setInterval(() => { load({ silent: true }); setTick((t) => t + 1) }, pollMs)
    return () => window.clearInterval(id)
  }, [load, pollMs])

  const topFive = useMemo(() => (Array.isArray(data?.topStocks) ? data.topStocks.slice(0, 5) : []), [data])

  const pulseAssets = useMemo(() => {
    if (!pulse) return []
    const indices = Array.isArray(pulse.indices) ? pulse.indices : []
    const commodities = Array.isArray(pulse.commodities) ? pulse.commodities : []
    const keyCommodities = commodities.filter((a) => /VIX|GOLD|GC|VIXY/.test(String(a.symbol ?? '').toUpperCase())).slice(0, 2)
    return [...indices.slice(0, 4), ...keyCommodities].slice(0, 6)
  }, [pulse])

  const session = getSessionInfo()
  void tick

  const dotColor =
    session.state === 'open' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
    : session.state === 'pre' || session.state === 'after' ? 'bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
    : 'bg-zinc-600'

  return (
    <div className="app-page-enter space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          <span className="dashboard-flame" aria-hidden>
            <Flame className="size-6 sm:size-7" strokeWidth={2} />
          </span>
          <span>Dashboard</span>
        </h1>
        <div className="flex items-center gap-2">
          <span className={['size-2 shrink-0 rounded-full', dotColor].join(' ')} />
          <span className="text-sm text-zinc-400">{session.label}</span>
          <span className="text-sm text-zinc-600">·</span>
          <span className="text-sm text-zinc-500">{session.sub}</span>
        </div>
      </header>

      {/* Ticker tape */}
      <div className="dash-module-enter" style={{ '--dash-stagger': '0ms' }}>
        <TradingViewTickerTape />
      </div>

      {/* Market pulse cards */}
      {(pulseAssets.length > 0 || loading) && (
        <div className="dash-module-enter" style={{ '--dash-stagger': '40ms' }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:[grid-template-columns:repeat(auto-fit,minmax(0,1fr))]">
            {loading && !pulse
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[4.5rem] animate-pulse rounded-xl border border-border-subtle bg-white/[0.03]" />
                ))
              : pulseAssets.map((a) => <PulseCard key={a.symbol} asset={a} />)}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !data && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
          <div>
            <p className="font-medium text-rose-200">Couldn't load market data</p>
            <p className="mt-0.5 text-rose-300/70">{error}</p>
          </div>
        </div>
      )}

      {/* Watchlist */}
      <section className="dash-module-enter rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20" style={{ '--dash-stagger': '80ms' }}>
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">My watchlist</h2>
          <Link to="/watchlist" className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300">
            Manage <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="p-5">
          <WatchlistMiniWidget />
        </div>
      </section>

      {/* Most active + Calendars */}
      <div className="dash-module-enter grid grid-cols-1 gap-4 lg:grid-cols-3" style={{ '--dash-stagger': '120ms' }}>
        {/* Most active */}
        {(topFive.length > 0 || loading) && (
          <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Most active</h2>
              <Link to="/markets" className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300">
                Full view <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="divide-y divide-border-subtle/50">
              {loading && !data
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3">
                      <div className="h-3.5 w-14 animate-pulse rounded-full bg-white/[0.06]" />
                      <div className="h-3.5 w-24 animate-pulse rounded-full bg-white/[0.06]" />
                    </div>
                  ))
                : topFive.map((r) => {
                    const pct = Number(r?.changePercent)
                    const up = Number.isFinite(pct) && pct > 0
                    const dn = Number.isFinite(pct) && pct < 0
                    return (
                      <div key={r?.symbol} className="flex items-center justify-between px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="w-14 text-sm font-semibold text-zinc-100">{r?.symbol ?? '—'}</span>
                          {Array.isArray(r?.recentCloses) && <MiniSparkline values={r.recentCloses} />}
                        </div>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className="text-sm text-zinc-400">{formatPrice(r?.close ?? r?.price)}</span>
                          <span className={['min-w-[3.5rem] text-right text-xs font-medium', up ? 'text-emerald-400' : dn ? 'text-rose-400' : 'text-zinc-500'].join(' ')}>
                            {formatPct(pct)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </section>
        )}

        {/* Earnings calendar */}
        <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-zinc-400" />
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Earnings today</h2>
            </div>
            <Link to="/news" className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300">
              Calendar <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="px-5 py-3">
            <EarningsWidget rows={earnings} loading={earningsLoading} />
          </div>
        </section>

        {/* Macro events */}
        <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-zinc-400" />
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">High-impact macro</h2>
            </div>
            <Link to="/news" className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300">
              Full calendar <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="px-5 py-3">
            <MacroWidget rows={macro} loading={macroLoading} />
          </div>
        </section>
      </div>

      {/* Quick nav grid */}
      <div className="dash-module-enter grid grid-cols-2 gap-2 sm:grid-cols-4" style={{ '--dash-stagger': '160ms' }}>
        {NAV_LINKS.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="card-hover group flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface-1/40 px-3.5 py-3.5 transition hover:border-white/20 hover:bg-surface-1/70"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition group-hover:text-zinc-200">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-200">{label}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
