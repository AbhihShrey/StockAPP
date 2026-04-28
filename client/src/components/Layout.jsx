import {
  ArrowUpDown,
  BarChart3,
  Bell,
  BellRing,
  Bookmark,
  FlaskConical,
  Grid3x3,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  Landmark,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CommandBar } from './CommandBar'
import { CommandPaletteProvider, openCommandPalette } from './CommandPalette'
import { MarketingHomeFab } from './MarketingHomeFab'
import { WelcomeHomeNav } from './WelcomeHomeNav'
import { useAuth } from '../context/AuthContext'
import { useAlerts } from '../context/AlertContext'
import { apiUrl, authHeaders } from '../lib/apiBase'
import { getDefaultLanding } from '../lib/prefs'
import { EmberLogo } from './EmberLogo'
import { ClickSparkProvider } from './ClickSparkProvider'
import { EmberIgnition } from './EmberIgnition'

const MAIN_MAX_W = 'max-w-[88rem]'

const BACKTEST_ENABLED = import.meta.env.VITE_FEATURE_BACKTEST === '1'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/markets', label: 'Markets', icon: ArrowUpDown },
  { to: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { to: '/portfolio', label: 'Portfolio', icon: PieChart },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/insider', label: 'Insider Activity', icon: Landmark },
  { to: '/charts', label: 'Charts', icon: BarChart3 },
  { to: '/sectors', label: 'Sectors', icon: Grid3x3 },
  ...(BACKTEST_ENABLED ? [{ to: '/strategies', label: 'Strategies', icon: FlaskConical }] : []),
  { to: '/settings', label: 'Settings', icon: Settings },
]

const linkClass = ({ isActive }) =>
  [
    'group/nav relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200',
    isActive
      ? 'nav-active bg-accent-muted text-accent shadow-[inset_0_0_0_1px_oklch(0.72_0.17_165/0.25)]'
      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
  ].join(' ')

function marketSessionNow() {
  // Lightweight client-side session inference (US equities, ET). Avoids API calls and stays fast.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(new Date())
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const isWeekend = wd === 'Sat' || wd === 'Sun'
  const mins = hh * 60 + mm
  if (isWeekend) return { state: 'closed', label: 'Closed' }
  // Premarket 04:00–09:30, Regular 09:30–16:00, After hours 16:00–20:00 (ET).
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return { state: 'open', label: 'Market open' }
  if (mins >= 16 * 60 && mins < 20 * 60) return { state: 'after', label: 'After hours' }
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return { state: 'pre', label: 'Premarket' }
  return { state: 'closed', label: 'Closed' }
}

function MarketStatusPill({ collapsed }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const s = marketSessionNow()
  const dot =
    s.state === 'open'
      ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
      : s.state === 'after' || s.state === 'pre'
        ? 'bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
        : 'bg-zinc-500'
  const Icon = s.state === 'after' ? Moon : s.state === 'pre' ? Sun : null

  return (
    <div
      className={[
        'flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-zinc-300',
        collapsed ? 'justify-center px-1' : '',
      ].join(' ')}
      title={s.label}
      aria-label={s.label}
      data-tick={tick}
    >
      <span className={['size-2 shrink-0 rounded-full', dot].join(' ')} aria-hidden />
      {collapsed ? null : (
        <>
          {Icon ? <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden /> : null}
          <span className="min-w-0 truncate font-medium">{s.label}</span>
        </>
      )}
    </div>
  )
}

function SidebarBody({ collapsed, onNavigate, onToggleCollapse, location, user, onSignOutToWelcome }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={[
          'flex shrink-0 flex-col gap-2 border-b border-border-subtle',
          collapsed ? 'items-center px-2 py-3' : 'px-3 py-3',
        ].join(' ')}
      >
        <div className={['flex w-full items-start gap-2', collapsed ? 'flex-col items-center' : 'justify-between'].join(' ')}>
          <Link
            to={getDefaultLanding()}
            onClick={onNavigate}
            className={[
              'flex min-w-0 rounded-lg outline-none ring-accent/30 focus-visible:ring-2',
              collapsed ? 'flex-col items-center justify-center gap-0' : 'min-w-0 flex-1 items-center gap-2.5',
            ].join(' ')}
            title="Home"
          >
            {collapsed
              ? <EmberLogo size="xs" iconOnly />
              : <EmberLogo size="xs" layout="horizontal" showTagline={false} />
            }
          </Link>
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={[
                'hidden rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 lg:inline-flex',
                collapsed ? '' : 'shrink-0',
              ].join(' ')}
              aria-label="Toggle sidebar"
              title="Collapse / expand"
            >
              {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => { openCommandPalette(); onNavigate?.() }}
          className={[
            'flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-200',
            collapsed ? 'justify-center px-1' : '',
          ].join(' ')}
          aria-label="Search stocks (⌘K)"
          title="Search stocks (⌘K / Ctrl+K)"
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1 truncate text-left">Search…</span>
              <span className="shrink-0 rounded border border-white/10 px-1 py-0.5 text-[9px] font-medium text-zinc-500">⌘K</span>
            </>
          )}
        </button>
        <MarketStatusPill collapsed={collapsed} />
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary">
        {nav.map(({ to, label, icon: Icon }) => {
          const chartsActive =
            to === '/charts' &&
            (location.pathname === '/charts' || location.pathname.startsWith('/analysis/'))
          const isStrategies = to === '/strategies' && location.pathname.startsWith('/strategies')
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={(args) => linkClass({ ...args, isActive: args.isActive || chartsActive })}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
            >
              <Icon
                className={[
                  'size-[1.125rem] shrink-0 opacity-70 group-aria-[current=page]/nav:opacity-100',
                  isStrategies ? 'motion-safe:transition-transform motion-safe:duration-300 group-hover/nav:rotate-12' : '',
                ].join(' ')}
                strokeWidth={2}
                aria-hidden
              />
              {!collapsed ? label : null}
            </NavLink>
          )
        })}
      </nav>
      <div className={['shrink-0 border-t border-border-subtle p-3', collapsed ? 'flex justify-center' : ''].join(' ')}>
        <WelcomeHomeNav
          collapsed={collapsed}
          user={user}
          onSignOut={onSignOutToWelcome}
          onNavigate={onNavigate}
        />
      </div>
      {!collapsed ? (
        <div className="shrink-0 border-t border-border-subtle px-3 pb-3 pt-2.5">
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600" aria-label="Legal">
            <Link to="/privacy" onClick={onNavigate} className="transition hover:text-zinc-300">Privacy</Link>
            <Link to="/terms" onClick={onNavigate} className="transition hover:text-zinc-300">Terms</Link>
            <Link to="/disclaimer" onClick={onNavigate} className="transition hover:text-zinc-300">Disclaimer</Link>
            <Link to="/cookies" onClick={onNavigate} className="transition hover:text-zinc-300">Cookies</Link>
          </nav>
        </div>
      ) : null}
    </div>
  )
}

function conditionLabel(condition, threshold) {
  const orhlM =
    threshold != null && threshold !== '' && Number.isFinite(Number(threshold))
      ? `${Number(threshold)} min`
      : 'OR'
  switch (condition) {
    case 'vwap_above': return 'above VWAP'
    case 'vwap_below': return 'below VWAP'
    case 'price_above': return `above $${Number(threshold).toFixed(2)}`
    case 'price_below': return `below $${Number(threshold).toFixed(2)}`
    case 'orhl_above': return `above OR High (${orhlM})`
    case 'orhl_below': return `below OR Low (${orhlM})`
    case 'earnings_report': return 'reports earnings today'
    default: return condition
  }
}

function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useAlerts()
  const [open, setOpen] = useState(false)
  const [firing, setFiring] = useState(false)
  const ref = useRef(null)
  const lastLenRef = useRef(notifications.length)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (notifications.length > lastLenRef.current) {
      setFiring(true)
      const t = setTimeout(() => setFiring(false), 1200)
      lastLenRef.current = notifications.length
      return () => clearTimeout(t)
    }
    lastLenRef.current = notifications.length
  }, [notifications.length])

  const toggle = () => {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) markAllRead()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        aria-label="Notifications"
      >
        {unreadCount > 0
          ? <BellRing className="size-5 text-accent" data-bell-state={firing ? 'firing' : ''} />
          : <Bell className="size-5" data-bell-state={firing ? 'firing' : ''} />}
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-zinc-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/10 bg-neutral-950/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-100">Alerts</p>
            {notifications.length > 0 && (
              <div className="flex items-center gap-3">
                <button type="button" onClick={markAllRead} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                  Mark all read
                </button>
                <button type="button" onClick={clearAll} className="text-xs text-zinc-500 hover:text-rose-400 transition">
                  Clear all
                </button>
              </div>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-600">No notifications yet.</p>
            ) : (
              notifications.slice(0, 20).map((n) => {
                const isEarnings = n.condition === 'earnings_report'
                const time = new Date(n.triggeredAt * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
                return (
                  <div key={n.id} className={['border-b border-white/[0.06] px-4 py-3', !n.read ? 'bg-accent/5' : ''].join(' ')}>
                    <p className="text-sm font-medium text-zinc-100">
                      <span className="text-accent">{n.symbol}</span> {conditionLabel(n.condition, n.threshold)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {isEarnings
                        ? n.message || 'Earnings report today'
                        : <>
                            At ${n.triggeredPrice?.toFixed(2)}
                            {n.vwapAtTrigger ? ` · VWAP $${n.vwapAtTrigger.toFixed(2)}` : ''}
                          </>
                      }
                      {' · '}
                      {time} ET
                    </p>
                  </div>
                )
              })
            )}
          </div>
          <div className="border-t border-white/10 px-4 py-2.5">
            <Link to="/alerts" onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              Manage alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function EmailVerificationBanner({ token }) {
  const [verified, setVerified] = useState(true) // optimistic — hide until we know
  const [resendBusy, setResendBusy] = useState(false)
  const [resendStatus, setResendStatus] = useState(null) // 'sent' | 'error' | null
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { headers: authHeaders(token) })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && data.ok && data.user) setVerified(Boolean(data.user.emailVerified))
      } catch {
        // ignore — we keep the banner hidden on a network error
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const handleResend = async () => {
    setResendBusy(true)
    setResendStatus(null)
    try {
      const res = await fetch(apiUrl('/api/auth/resend-verification'), {
        method: 'POST',
        headers: authHeaders(token),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setResendStatus('error')
      } else if (data.alreadyVerified) {
        setVerified(true)
      } else {
        setResendStatus('sent')
      }
    } catch {
      setResendStatus('error')
    } finally {
      setResendBusy(false)
    }
  }

  if (verified || dismissed) return null

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/[0.07]">
      <div className="mx-auto flex max-w-[88rem] flex-col gap-2 px-4 py-2 text-xs text-amber-200 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Mail className="size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Verify your email</strong> to receive alert and digest emails. Check your inbox for the link.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {resendStatus === 'sent' ? (
            <span className="text-emerald-300">Sent — check your inbox.</span>
          ) : resendStatus === 'error' ? (
            <span className="text-rose-300">Could not send. Try again later.</span>
          ) : null}
          <button
            type="button"
            disabled={resendBusy}
            onClick={handleResend}
            className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-60"
          >
            {resendBusy ? 'Sending…' : 'Resend'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-amber-300/80 transition hover:text-amber-100"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function AlertToasts() {
  const { notifications } = useAlerts()
  const [visible, setVisible] = useState([])
  const shownRef = useRef(new Set())

  useEffect(() => {
    const newOnes = notifications.filter((n) => !shownRef.current.has(n.id) && !n.suppressedByQuietHours)
    if (newOnes.length === 0) return
    newOnes.forEach((n) => shownRef.current.add(n.id))
    setVisible((prev) => [...newOnes, ...prev].slice(0, 5))
    newOnes.forEach((n) => {
      setTimeout(() => setVisible((prev) => prev.filter((t) => t.id !== n.id)), 6000)
    })
  }, [notifications])

  if (visible.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] flex max-w-sm flex-col gap-2 sm:right-6">
      {visible.map((n) => {
        const isEarnings = n.condition === 'earnings_report'
        return (
        <div
          key={n.id}
          className="ember-toast pointer-events-auto relative flex items-start gap-3 rounded-2xl border border-accent/20 bg-neutral-950/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <span className="ember-toast-ignition" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="ember-toast-spark" style={{ '--spark-x': `${(i + 1) * 9}%`, '--spark-delay': `${i * 30}ms` }} />
            ))}
          </span>
          <BellRing className="mt-0.5 size-4 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              <span className="text-accent">{n.symbol}</span> {isEarnings ? 'earnings today' : 'alert fired'}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {isEarnings
                ? (n.message || conditionLabel(n.condition, n.threshold))
                : `${conditionLabel(n.condition, n.threshold)} · $${n.triggeredPrice?.toFixed(2)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVisible((prev) => prev.filter((t) => t.id !== n.id))}
            className="ml-auto rounded-md p-0.5 text-zinc-600 hover:text-zinc-300"
          >
            <X className="size-3.5" />
          </button>
        </div>
        )
      })}
    </div>
  )
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, logout } = useAuth()

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('navCollapsed')
      if (raw === '1') setCollapsed(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('navCollapsed', collapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [collapsed])

  const commandItems = useMemo(
    () => [
      { to: '/dashboard', label: 'Dashboard', shortcut: 'G D' },
      { to: '/markets', label: 'Markets', shortcut: 'G M' },
      { to: '/watchlist', label: 'Watchlist', shortcut: 'G W' },
      { to: '/portfolio', label: 'Portfolio', shortcut: 'G P' },
      { to: '/alerts', label: 'Alerts', shortcut: 'G A' },
      { to: '/news', label: 'News', shortcut: 'G N' },
      { to: '/insider', label: 'Insider Activity', shortcut: 'G I' },
      { to: '/charts', label: 'Charts', shortcut: 'G C' },
      { to: '/sectors', label: 'Sectors', shortcut: 'G S' },
      ...(BACKTEST_ENABLED ? [{ to: '/strategies', label: 'Backtesting', shortcut: 'G B' }] : []),
      { to: '/settings', label: 'Settings', shortcut: 'G ,' },
    ],
    [],
  )

  const toggleCollapsed = () => setCollapsed((v) => !v)

  const signOutToWelcome = useCallback(() => {
    logout()
    navigate('/welcome', { replace: true })
  }, [logout, navigate])

  return (
    <CommandPaletteProvider>
    <div className="h-dvh overflow-hidden font-sans text-zinc-200 antialiased">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex h-full min-w-0">
        {/* Desktop sidebar — width animates */}
        <aside
          className={[
            'z-20 hidden h-dvh shrink-0 overflow-x-hidden border-r border-border-subtle bg-surface-0/70 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex lg:flex-col',
            collapsed ? 'w-[5.5rem]' : 'w-64',
          ].join(' ')}
        >
          <SidebarBody
            collapsed={collapsed}
            location={location}
            onToggleCollapse={toggleCollapsed}
            user={user}
            onSignOutToWelcome={signOutToWelcome}
          />
        </aside>

        {/* Mobile drawer — slides from left */}
        <aside
          className={[
            'fixed left-0 top-0 z-50 flex h-dvh w-[min(17.5rem,90vw)] flex-col border-r border-border-subtle bg-surface-0/95 shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden',
            mobileOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full',
          ].join(' ')}
          aria-hidden={!mobileOpen}
        >
          <div className="flex h-14 shrink-0 items-center justify-end border-b border-border-subtle px-2">
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarBody
              collapsed={false}
              location={location}
              onNavigate={() => setMobileOpen(false)}
              user={user}
              onSignOutToWelcome={signOutToWelcome}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-0/80 backdrop-blur-xl">
            <div className={`mx-auto flex h-14 w-full items-center gap-3 px-4 sm:px-6 lg:px-8 ${MAIN_MAX_W}`}>
              <button
                type="button"
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>
              <Link to={getDefaultLanding()} className="flex min-w-0 items-center lg:hidden">
                <EmberLogo size="xs" layout="horizontal" showTagline={false} />
              </Link>
              <div className="flex-1 lg:hidden" />
              <div className="flex items-center gap-1 lg:hidden">
                <NotificationBell />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-zinc-100"
                  onClick={() => {
                    logout()
                    navigate('/welcome', { replace: true })
                  }}
                >
                  <LogOut className="size-3.5 opacity-80" aria-hidden />
                  Out
                </button>
              </div>
              <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
                <CommandBar items={commandItems} />
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                <NotificationBell />
                <span className="hidden max-w-[8rem] truncate text-xs text-zinc-500 xl:block" title={user?.email}>
                  {user?.email}
                </span>
                <button
                  type="button"
                  onClick={signOutToWelcome}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-zinc-100"
                >
                  <LogOut className="size-3.5 opacity-80" aria-hidden />
                  Sign out
                </button>
              </div>
            </div>
          </header>

          <EmailVerificationBanner token={token} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-5 lg:px-6 lg:py-8">
            <div key={location.pathname} className={`app-page-enter mx-auto w-full ${MAIN_MAX_W}`}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <MarketingHomeFab />
      <ClickSparkProvider />
      <EmberIgnition />
      <AlertToasts />
    </div>
    </CommandPaletteProvider>
  )
}
