import { ArrowRight, BarChart3, FlaskConical, Grid3x3, HelpCircle, Layers, LineChart, Mail, Package, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { RevealOnScroll } from '../components/RevealOnScroll'
import { WelcomeAuthModal } from '../components/WelcomeAuthModal'
import { WelcomeMarketingNav } from '../components/WelcomeMarketingNav'
import { EmberParticles } from '../components/EmberParticles'
import { WelcomeFireSpiritQA } from '../components/WelcomeFireSpiritQA'
import { useAuth } from '../context/AuthContext'
import { useEmberBurst } from '../lib/useEmberBurst'
import { getDefaultLanding } from '../lib/prefs'

const OFFERINGS = [
  {
    metric: '3+',
    label: 'Backtest engines',
    detail: 'SMA, VWAP regime, and intraday opening-range logic—benchmarked vs buy & hold.',
    icon: FlaskConical,
  },
  {
    metric: '500',
    label: 'S&P breadth pulse',
    detail: 'Live % above the 200-day and regime context so you know when risk is stretched.',
    icon: BarChart3,
  },
  {
    metric: '11',
    label: 'Sector lenses',
    detail: 'SPDR strength, related movers, and predictive widgets for rotation.',
    icon: Grid3x3,
  },
  {
    metric: '∞',
    label: 'Chart workspace',
    detail: 'TradingView-grade charts, VWAP studies, and a command bar to jump anywhere fast.',
    icon: LineChart,
  },
]

function PersistentEmberBackdrop() {
  return (
    <div className="welcome-persistent-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="welcome-persistent-backdrop__glow" />
      <EmberParticles density={18} />
    </div>
  )
}

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
  const triggerBurst = useEmberBurst()

  const openSignup = useCallback((event) => {
    if (event) triggerBurst(event)
    setAuthMode('signup')
    setAuthOpen(true)
  }, [triggerBurst])

  const openSignin = useCallback((event) => {
    if (event) triggerBurst(event)
    setAuthMode('signin')
    setAuthOpen(true)
  }, [triggerBurst])

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
    <div className="relative min-h-dvh bg-surface-0 text-zinc-200 antialiased">
      <PersistentEmberBackdrop />
      <WelcomeMarketingNav onSignIn={openSignin} onGetStarted={openSignup} />

      <WelcomeAuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onSwitchMode={(m) => setAuthMode(m)}
      />

      {/* Hero — centered, flows directly into details below */}
      <section className="relative flex min-h-[calc(100dvh-7.5rem)] flex-col">
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
          <div className="welcome-hero-fade flex max-w-lg flex-col items-center text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <Sparkles className="size-3.5 text-accent" aria-hidden />
              Markets workspace
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-4xl md:text-5xl">
              The market, made clear.
            </h1>
            <p className="mt-5 max-w-md text-pretty text-sm leading-relaxed text-zinc-500 sm:text-base">
              Charts, alerts, and backtests in one calm workspace.
            </p>
            <button
              type="button"
              onClick={openSignup}
              className="glass-btn--accent ember-cta mt-10 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-semibold"
            >
              Create account
              <ArrowRight className="size-4 opacity-80" aria-hidden />
            </button>
            <p className="mt-3 text-center text-xs text-zinc-600">No card required · Free to sign up</p>
          </div>
        </div>
      </section>

      <section id="details" className="relative z-10 scroll-mt-16 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <RevealOnScroll repeat>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                Everything you need to decide
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-500 sm:text-base">
                A focused workspace for reading the market, tracking positions, and stress-testing ideas.
              </p>
            </div>
          </RevealOnScroll>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERINGS.map((item, i) => {
              const Icon = item.icon
              return (
                <RevealOnScroll key={item.label} delayMs={i * 90} repeat>
                  <article
                    className="heat-card group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-neutral-950/50 p-5 shadow-[0_4px_28px_-10px_rgba(0,0,0,0.6)] transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)]"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      e.currentTarget.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`)
                      e.currentTarget.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`)
                    }}
                  >
                    <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-accent/10 blur-2xl transition duration-500 group-hover:bg-accent/18" />
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-accent">
                        <Icon className="size-5" strokeWidth={2} aria-hidden />
                      </span>
                      <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-zinc-100 sm:text-3xl">
                        {item.metric}
                      </span>
                    </div>
                    <h3 className="mt-5 text-sm font-semibold tracking-tight text-zinc-100">{item.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500">{item.detail}</p>
                  </article>
                </RevealOnScroll>
              )
            })}
          </div>

          <RevealOnScroll delayMs={120} repeat>
            <div className="mt-16 flex flex-col items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-9 sm:flex-row sm:px-10">
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-zinc-200">Ready to open the workspace?</p>
                <p className="mt-1 text-sm text-zinc-500">Sign in or create an account—then the full app unlocks.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={openSignin}
                  className="glass-btn ember-cta inline-flex flex-1 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-200 sm:flex-initial"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={openSignup}
                  className="glass-btn--accent ember-cta inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold sm:flex-initial"
                >
                  Get started
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </RevealOnScroll>

          <RevealOnScroll repeat className="mt-12 text-center">
            <Link
              to="/products"
              className="text-sm font-medium text-accent/90 underline-offset-4 hover:text-accent hover:underline"
            >
              Explore product overview →
            </Link>
          </RevealOnScroll>
        </div>
      </section>

      <WelcomeFireSpiritQA />

      <footer className="relative z-10 overflow-hidden border-t border-white/[0.06]">
        <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/[0.06] text-accent shadow-[inset_0_0_18px_-4px_oklch(0.55_0.20_35_/0.45)]">
                  <Sparkles className="size-4" aria-hidden />
                </span>
                <span className="text-base font-semibold tracking-tight text-zinc-100">Ember Finances</span>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-500">
                A focused workspace for reading the market, tracking positions, and stress-testing trading
                ideas. Built for clarity, not clutter.
              </p>
              <a
                href="mailto:support@emberfinances.com"
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[13px] font-medium text-zinc-200 transition hover:border-accent/30 hover:bg-white/[0.06] hover:text-accent"
              >
                <Mail className="size-3.5 opacity-80" aria-hidden />
                support@emberfinances.com
              </a>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Explore</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/products" className="group inline-flex items-center gap-2 text-zinc-400 transition hover:text-accent">
                    <Package className="size-3.5 opacity-60 transition group-hover:opacity-100" aria-hidden />
                    Products
                  </Link>
                </li>
                <li>
                  <Link to="/solutions" className="group inline-flex items-center gap-2 text-zinc-400 transition hover:text-accent">
                    <Layers className="size-3.5 opacity-60 transition group-hover:opacity-100" aria-hidden />
                    Solutions
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="group inline-flex items-center gap-2 text-zinc-400 transition hover:text-accent">
                    <HelpCircle className="size-3.5 opacity-60 transition group-hover:opacity-100" aria-hidden />
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Legal</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><Link to="/privacy" className="text-zinc-400 transition hover:text-accent">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-zinc-400 transition hover:text-accent">Terms of Service</Link></li>
                <li><Link to="/disclaimer" className="text-zinc-400 transition hover:text-accent">Disclaimer</Link></li>
                <li><Link to="/cookies" className="text-zinc-400 transition hover:text-accent">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-2 border-t border-white/[0.05] pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} Ember Finances · For informational purposes only — not investment advice.
            </p>
            <p className="text-[11px] text-zinc-700">Market data by Financial Modeling Prep</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
