import {
  ArrowRight,
  Bell,
  HelpCircle,
  Layers,
  LineChart,
  Mail,
  Package,
  PieChart,
  Radar,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { MarketBackdrop } from '../components/MarketBackdrop'
import { RevealOnScroll } from '../components/RevealOnScroll'
import { WelcomeAuthModal } from '../components/WelcomeAuthModal'
import { WelcomeMarketingNav } from '../components/WelcomeMarketingNav'
import { EmberMark } from '../components/EmberLogo'
import { useAuth } from '../context/AuthContext'
import { getDefaultLanding } from '../lib/prefs'

const CAPABILITIES = [
  {
    icon: Radar,
    title: 'Screener',
    detail:
      'Ranks the S&P 500 by momentum, trend, and liquidity with tunable factor weights. Earnings-week flags and a local cache keep re-runs instant.',
  },
  {
    icon: Bell,
    title: 'Alerts',
    detail:
      'Price levels, VWAP crosses, opening-range breakouts, and earnings days. Conditions are checked server-side, so alerts fire even with the tab closed.',
  },
  {
    icon: PieChart,
    title: 'Portfolio',
    detail:
      'Enter shares and average cost — no brokerage link. Live market value, gain/loss, daily move, and an allocation breakdown update as prices tick.',
  },
  {
    icon: LineChart,
    title: 'Live markets',
    detail:
      'Streaming quotes, market breadth (% above the 200-day), sector rotation, and full charting with VWAP studies. ⌘K jumps anywhere.',
  },
]

const STATS = [
  { value: '500', label: 'S&P constituents screened' },
  { value: '15s', label: 'Quote refresh interval' },
  { value: '11', label: 'Sector lenses' },
  { value: '3', label: 'Backtest engines' },
]

/**
 * @param {{ redirectIfAuthenticated?: boolean }} props
 * When `redirectIfAuthenticated` is true (default), signed-in users are sent to the dashboard.
 * Use `false` on `/welcome` so the marketing page stays reachable while logged in.
 */
export function Welcome({ redirectIfAuthenticated = true }) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signup')

  const openSignup = useCallback(() => {
    setAuthMode('signup')
    setAuthOpen(true)
  }, [])

  const openSignin = useCallback(() => {
    setAuthMode('signin')
    setAuthOpen(true)
  }, [])

  useEffect(() => {
    if (searchParams.get('signin') === '1') {
      openSignin()
      searchParams.delete('signin')
      setSearchParams(searchParams, { replace: true })
    }
  }, [openSignin, searchParams, setSearchParams])

  useEffect(() => {
    const mode = location.state?.openAuth
    if (mode === 'signup') {
      openSignup()
      navigate(location.pathname, { replace: true, state: {} })
    } else if (mode === 'signin') {
      openSignin()
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate, openSignup, openSignin])

  if (redirectIfAuthenticated && isAuthenticated) {
    return <Navigate to={getDefaultLanding()} replace />
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-bg text-ink antialiased">
      {/* One ambient ember glow — fixed, cheap to render, no JS */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(56rem 38rem at 50% -12%, rgba(255,107,44,0.07), transparent 70%)',
        }}
      />

      {/* Live stock-chart backdrop — drifts and parallaxes on scroll */}
      <MarketBackdrop />

      <WelcomeMarketingNav onSignIn={openSignin} onGetStarted={openSignup} />

      <WelcomeAuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onSwitchMode={(m) => setAuthMode(m)}
      />

      {/* Hero */}
      <section className="relative z-10 flex min-h-[calc(100dvh-4rem)] flex-col">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 pb-20 pt-14 text-center sm:px-6">
          <p className="eyebrow rise">Ember Finance · Market terminal</p>
          <h1 className="display rise rise-1 mt-4 max-w-4xl text-balance text-5xl sm:text-7xl">
            The market, read in one dark terminal.
          </h1>
          <div className="ember-rule rise rise-2 mt-7 w-40" aria-hidden />
          <p className="rise rise-3 mt-6 max-w-prose text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
            Live quotes, a factor screener, server-side alerts, and portfolio tracking —
            in one place, without a dozen tabs.
          </p>
          <div className="rise rise-4 mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <button type="button" onClick={openSignup} className="btn-primary h-12 w-full px-7 text-base sm:w-auto">
              Open the terminal
              <ArrowRight className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={openSignin} className="btn-ghost h-12 w-full px-7 text-base sm:w-auto">
              Sign in
            </button>
          </div>
          <p className="rise rise-5 mt-4 text-xs text-ink-3">Free account · No card, no brokerage link</p>

          <dl className="rise rise-6 mt-16 grid w-full max-w-3xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1.5">
                <dd className="num order-1 text-2xl font-semibold text-ink sm:text-3xl">{s.value}</dd>
                <dt className="eyebrow order-2 text-center normal-case tracking-normal text-[11px]">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* What the platform actually does */}
      <section id="details" className="relative z-10 scroll-mt-16 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <RevealOnScroll>
            <header className="max-w-2xl">
              <p className="eyebrow">Platform · What it does</p>
              <h2 className="display mt-3 text-2xl sm:text-3xl">Four tools, one screen</h2>
              <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-2">
                Everything runs on live U.S. market data. Nothing to install, nothing to link.
              </p>
              <div className="ember-rule mt-6" aria-hidden />
            </header>
          </RevealOnScroll>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((item, i) => {
              const Icon = item.icon
              return (
                <RevealOnScroll key={item.title} delayMs={i * 80}>
                  <article className="panel panel-hover panel-pad h-full">
                    <span className="flex size-10 items-center justify-center rounded-xl border border-ember/25 bg-ember/10 text-flame">
                      <Icon className="size-5" strokeWidth={2} aria-hidden />
                    </span>
                    <h3 className="font-display mt-4 text-base font-semibold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.detail}</p>
                  </article>
                </RevealOnScroll>
              )
            })}
          </div>

          <RevealOnScroll delayMs={120}>
            <div className="panel mt-14 overflow-hidden">
              <div className="ember-rule" aria-hidden />
              <div className="flex flex-col items-center justify-between gap-5 px-6 py-8 sm:flex-row sm:px-10">
                <div className="text-center sm:text-left">
                  <p className="font-display text-base font-semibold text-ink">Ready to open the terminal?</p>
                  <p className="mt-1 text-sm text-ink-2">Sign in or create an account — the full app unlocks immediately.</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <button type="button" onClick={openSignin} className="btn-ghost h-11 flex-1 px-5 sm:flex-initial">
                    Sign in
                  </button>
                  <button type="button" onClick={openSignup} className="btn-primary h-11 flex-1 px-5 sm:flex-initial">
                    Get started
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </RevealOnScroll>

          <RevealOnScroll className="mt-10 text-center">
            <Link
              to="/products"
              className="text-sm font-medium text-flame underline-offset-4 hover:underline"
            >
              See the full product overview →
            </Link>
          </RevealOnScroll>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <EmberMark size={36} />
                <span className="font-display text-base font-bold text-ink" style={{ fontStretch: '112%' }}>
                  Ember Finance
                </span>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-2">
                A terminal for reading the market, tracking positions, and testing trading
                ideas. Built for clarity, not clutter.
              </p>
              <a href="mailto:support@emberfinances.com" className="btn-ghost mt-5 h-11 px-4 text-[13px]">
                <Mail className="size-3.5 opacity-80" aria-hidden />
                support@emberfinances.com
              </a>
            </div>

            <div>
              <p className="eyebrow">Explore</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/products" className="group inline-flex items-center gap-2 py-1 text-ink-2 transition-colors duration-150 hover:text-flame">
                    <Package className="size-3.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
                    Products
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="group inline-flex items-center gap-2 py-1 text-ink-2 transition-colors duration-150 hover:text-flame">
                    <Layers className="size-3.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
                    Solutions
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="group inline-flex items-center gap-2 py-1 text-ink-2 transition-colors duration-150 hover:text-flame">
                    <HelpCircle className="size-3.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="eyebrow">Legal</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link to="/privacy" className="inline-block py-1 text-ink-2 transition-colors duration-150 hover:text-flame">Privacy Policy</Link></li>
                <li><Link to="/terms" className="inline-block py-1 text-ink-2 transition-colors duration-150 hover:text-flame">Terms of Service</Link></li>
                <li><Link to="/disclaimer" className="inline-block py-1 text-ink-2 transition-colors duration-150 hover:text-flame">Disclaimer</Link></li>
                <li><Link to="/cookies" className="inline-block py-1 text-ink-2 transition-colors duration-150 hover:text-flame">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-2 border-t border-line pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-xs text-ink-3">
              © {new Date().getFullYear()} Ember Finance · For informational purposes only — not investment advice.
            </p>
            <p className="text-[11px] text-ink-3">Market data by Financial Modeling Prep</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
