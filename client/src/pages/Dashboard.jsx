import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, BarChart3, Bell,
  BookOpen, CalendarDays, Grid3x3, Layers,
  Minus, Moon, PieChart, Sun, TrendingDown, TrendingUp,
} from 'lucide-react'
import { WatchlistMiniWidget } from '../components/WatchlistMiniWidget'
import { TradingViewTickerTape } from '../components/TradingViewTickerTape'
import { MiniSparkline } from '../components/MiniSparkline'
import { DashboardCard } from '../components/DashboardCard'
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
  const DirIcon = up ? TrendingUp : dn ? TrendingDown : null
  return (
    <div className="panel panel-hover flex min-w-0 flex-col gap-0.5 px-3.5 py-3">
      <span className="eyebrow truncate">{asset.symbol}</span>
      <span className="num text-sm font-semibold text-ink">{Number.isFinite(price) ? formatPrice(price) : '—'}</span>
      <span className={['num flex items-center gap-1 text-[11px] font-medium', up ? 'text-up' : dn ? 'text-down' : 'text-ink-3'].join(' ')}>
        {DirIcon ? <DirIcon className="size-3" aria-hidden /> : null}
        {Number.isFinite(pct) ? formatPct(pct) : '—'}
      </span>
    </div>
  )
}

function SessionIcon({ hint }) {
  if (hint === 'bmo') return <Sun className="size-3.5 text-warn" aria-label="Before market open" />
  if (hint === 'amc') return <Moon className="size-3.5 text-ink-3" aria-label="After market close" />
  return <Minus className="size-3 text-ink-3" />
}

function EarningsWidget({ rows, loading }) {
  if (loading) return (
    <div className="space-y-2 p-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-8" />
      ))}
    </div>
  )
  if (!rows?.length) return <p className="py-4 text-center text-xs text-ink-3">No earnings scheduled today.</p>
  return (
    <div className="divide-y divide-line">
      {rows.slice(0, 6).map((r, i) => (
        <div key={`${r.symbol}-${i}`} className="flex items-center gap-3 py-2">
          <SessionIcon hint={r.sessionHint} />
          <span className="num min-w-[3rem] text-xs font-semibold text-ink">{r.symbol}</span>
          <span className="flex-1 truncate text-[11px] text-ink-3">{r.name ?? ''}</span>
          {r.epsEstimate != null && (
            <span className="num shrink-0 text-[11px] text-ink-3">
              est <span className="text-ink-2">${Number(r.epsEstimate).toFixed(2)}</span>
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
        <div key={i} className="skeleton h-8" />
      ))}
    </div>
  )
  if (!highOnly.length) return <p className="py-4 text-center text-xs text-ink-3">No high-impact events this week.</p>
  return (
    <div className="divide-y divide-line">
      {highOnly.map((ev, i) => (
        <div key={i} className="flex items-start gap-3 py-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-down" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">{ev.event}</p>
            <p className="num text-[10px] text-ink-3">
              {ev.country} · {String(ev.date ?? '').slice(0, 10)}
              {ev.forecast ? <> · est <span className="text-ink-2">{ev.forecast}</span></> : null}
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
    session.state === 'open' ? 'bg-up shadow-[0_0_8px_rgba(61,220,151,0.7)]'
    : session.state === 'pre' || session.state === 'after' ? 'bg-warn shadow-[0_0_6px_rgba(255,194,75,0.55)]'
    : 'bg-ink-3'

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rise">
        <p className="eyebrow">Overview · US equities</p>
        <h1 className="display mt-1.5 text-2xl sm:text-3xl">Dashboard</h1>
        <div className="ember-rule mt-4" />
        <div className="mt-3 flex items-center gap-2">
          <span className={['size-2 shrink-0 rounded-full', dotColor].join(' ')} />
          <span className="text-sm text-ink-2">{session.label}</span>
          <span className="text-sm text-ink-3">·</span>
          <span className="num text-sm text-ink-3">{session.sub}</span>
        </div>
      </header>

      {/* Ticker tape */}
      <div className="rise rise-1">
        <TradingViewTickerTape />
      </div>

      {/* Market pulse cards */}
      {(pulseAssets.length > 0 || loading) && (
        <div className="rise rise-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:[grid-template-columns:repeat(auto-fit,minmax(0,1fr))]">
            {loading && !pulse
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-[4.5rem] rounded-[14px]" />
                ))
              : pulseAssets.map((a) => <PulseCard key={a.symbol} asset={a} />)}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !data && (
        <div className="rise flex items-start gap-3 rounded-[14px] border border-down/25 bg-down/5 p-5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-down" />
          <div>
            <p className="font-medium text-ink">Couldn't load market data</p>
            <p className="mt-0.5 text-down">{error}</p>
          </div>
        </div>
      )}

      {/* Watchlist */}
      <section className="rise rise-3">
        <DashboardCard
          title="My watchlist"
          action={
            <Link to="/watchlist" className="flex items-center gap-1 text-xs text-ink-3 transition hover:text-ink">
              Manage <ArrowRight className="size-3" />
            </Link>
          }
        >
          <WatchlistMiniWidget />
        </DashboardCard>
      </section>

      {/* Most active + Calendars */}
      <div className="rise rise-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Most active */}
        {(topFive.length > 0 || loading) && (
          <DashboardCard
            title="Most active"
            action={
              <Link to="/markets" className="flex items-center gap-1 text-xs text-ink-3 transition hover:text-ink">
                Full view <ArrowRight className="size-3" />
              </Link>
            }
          >
            <div className="-mx-4 -my-4 divide-y divide-line sm:-mx-5 sm:-my-5">
              {loading && !data
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 sm:px-5">
                      <div className="skeleton h-3.5 w-14 rounded-full" />
                      <div className="skeleton h-3.5 w-24 rounded-full" />
                    </div>
                  ))
                : topFive.map((r) => {
                    const pct = Number(r?.changePercent)
                    const up = Number.isFinite(pct) && pct > 0
                    const dn = Number.isFinite(pct) && pct < 0
                    const DirIcon = up ? TrendingUp : dn ? TrendingDown : null
                    return (
                      <div key={r?.symbol} className="flex items-center justify-between px-4 py-2.5 sm:px-5">
                        <div className="flex items-center gap-3">
                          <span className="w-14 text-sm font-semibold text-ink">{r?.symbol ?? '—'}</span>
                          {Array.isArray(r?.recentCloses) && <MiniSparkline values={r.recentCloses} />}
                        </div>
                        <div className="num flex items-center gap-3">
                          <span className="text-sm text-ink-2">{formatPrice(r?.close ?? r?.price)}</span>
                          <span className={['flex min-w-[4rem] items-center justify-end gap-1 text-xs font-medium', up ? 'text-up' : dn ? 'text-down' : 'text-ink-3'].join(' ')}>
                            {DirIcon ? <DirIcon className="size-3" aria-hidden /> : null}
                            {formatPct(pct)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </DashboardCard>
        )}

        {/* Earnings calendar */}
        <DashboardCard
          title={
            <span className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-ink-3" />
              Earnings today
            </span>
          }
          action={
            <Link to="/news" className="flex items-center gap-1 text-xs text-ink-3 transition hover:text-ink">
              Calendar <ArrowRight className="size-3" />
            </Link>
          }
        >
          <EarningsWidget rows={earnings} loading={earningsLoading} />
        </DashboardCard>

        {/* Macro events */}
        <DashboardCard
          title={
            <span className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-ink-3" />
              High-impact macro
            </span>
          }
          action={
            <Link to="/news" className="flex items-center gap-1 text-xs text-ink-3 transition hover:text-ink">
              Full calendar <ArrowRight className="size-3" />
            </Link>
          }
        >
          <MacroWidget rows={macro} loading={macroLoading} />
        </DashboardCard>
      </div>

      {/* Quick nav grid */}
      <div className="rise rise-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {NAV_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.to}
              to={link.to}
              className="panel panel-hover group flex items-start gap-3 px-3.5 py-3.5"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-3 transition group-hover:border-ember/30 group-hover:text-flame">
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink">{link.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-3">{link.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
