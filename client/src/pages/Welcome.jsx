import { ArrowRight, BarChart3, ChevronDown, FlaskConical, Grid3x3, LineChart, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { RevealOnScroll } from '../components/RevealOnScroll'
import { WelcomeAuthModal } from '../components/WelcomeAuthModal'
import { WelcomeMarketingNav } from '../components/WelcomeMarketingNav'
import { useAuth } from '../context/AuthContext'

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

function FlowingLinesBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="welcome-hero-glow" />
      <div className="welcome-sheen-layer" />
      <div className="welcome-line-layer" />
      <div className="welcome-line-layer welcome-line-layer--slow" />
      <div className="welcome-line-layer welcome-line-layer--reverse" />
      <div className="absolute inset-0 bg-gradient-to-b from-surface-0/30 via-surface-0/88 to-surface-0" />
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
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-dvh bg-surface-0 text-zinc-200 antialiased">
      <WelcomeMarketingNav onSignIn={openSignin} onGetStarted={openSignup} />

      <WelcomeAuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onSwitchMode={(m) => setAuthMode(m)}
      />

      {/* Hero — centered (dark band below Dropbox-style chrome) */}
      <section className="relative flex min-h-[calc(100dvh-7.5rem)] flex-col border-b border-white/[0.06]">
        <FlowingLinesBackdrop />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
          <div className="welcome-hero-fade flex max-w-lg flex-col items-center text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <Sparkles className="size-3.5 text-accent" aria-hidden />
              Markets workspace
            </p>
            <h1 className="text-balance text-2xl font-semibold leading-snug tracking-tight text-zinc-50 sm:text-3xl md:text-[1.85rem] md:leading-tight">
              A calmer way to read the tape, size risk, and stress-test ideas—before you trade.
            </h1>
            <p className="mt-5 max-w-md text-pretty text-sm leading-relaxed text-zinc-500 sm:text-[0.9375rem]">
              Breadth, sectors, charts, and backtests in one cohesive surface. Built for focus, speed, and clarity.
            </p>
            <button
              type="button"
              onClick={openSignup}
              className="mt-10 inline-flex items-center justify-center gap-2 rounded-full border border-border-subtle bg-surface-1/70 px-8 py-3 text-sm font-semibold text-zinc-100 shadow-lg shadow-black/30 transition hover:border-white/15 hover:bg-surface-1/90"
            >
              Create account
              <ArrowRight className="size-4 opacity-80" aria-hidden />
            </button>
            <p className="mt-3 text-center text-xs text-zinc-600">No card required · Local demo accounts</p>
          </div>

          <a
            href="#details"
            className="absolute bottom-6 flex flex-col items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
          >
            Learn more
            <ChevronDown className="size-4 motion-safe:animate-bounce" aria-hidden />
          </a>
        </div>
      </section>

      <section id="details" className="scroll-mt-16 border-b border-white/[0.06] bg-surface-0 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <RevealOnScroll repeat>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                Everything you need to decide
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-500 sm:text-base">
                Scroll up and down—sections ease in again each time they cross the viewport.
              </p>
            </div>
          </RevealOnScroll>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERINGS.map((item, i) => {
              const Icon = item.icon
              return (
                <RevealOnScroll key={item.label} delayMs={i * 90} repeat>
                  <article className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-neutral-950/50 p-5 shadow-[0_4px_28px_-10px_rgba(0,0,0,0.6)] transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)]">
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
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08] sm:flex-initial"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={openSignup}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent-muted px-5 py-2.5 text-sm font-semibold text-accent shadow-[inset_0_0_0_1px_oklch(0.72_0.17_165/0.25)] transition hover:brightness-110 sm:flex-initial"
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

      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} InvestAIV1 · For informational purposes only. Demo sign-in is stored in this
            browser only.
          </p>
        </div>
      </footer>
    </div>
  )
}
