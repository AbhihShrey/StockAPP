import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  ChevronRight,
  Clock,
  DollarSign,
  FlaskConical,
  Globe,
  Grid3x3,
  Layers,
  LayoutDashboard,
  LineChart,
  Newspaper,
  PieChart,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { EmberLogo } from '../components/EmberLogo'

function PageShell({ children }) {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-bg text-ink antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(56rem 38rem at 50% -12%, rgba(255,107,44,0.07), transparent 70%)',
        }}
      />
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/welcome"
            className="flex min-w-0 shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
          >
            <EmberLogo size="xs" layout="horizontal" showTagline={false} />
          </Link>
          <Link to="/welcome" className="btn-ghost h-9 px-3.5">
            <ArrowLeft className="size-3.5 opacity-80" aria-hidden />
            Back
          </Link>
        </div>
      </header>
      <div className="relative z-10">{children}</div>
      <footer className="relative z-10 border-t border-line py-10 text-center">
        <p className="text-xs text-ink-3">© {new Date().getFullYear()} Ember Finance · For informational purposes only.</p>
      </footer>
    </div>
  )
}

// ── Products ──────────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    icon: LayoutDashboard,
    name: 'Dashboard',
    tagline: 'Your market pulse at a glance',
    desc: 'Live ticker tape, pulse cards for major indices, watchlist summary, today\'s earnings calendar, and high-impact economic events — all on one screen.',
  },
  {
    icon: BarChart3,
    name: 'Markets',
    tagline: 'Breadth, movers & macro in one view',
    desc: 'Top gainers and losers, market internals, breadth indicators (% above 200-day MA), global macro assets, and configurable stock scanners.',
  },
  {
    icon: LineChart,
    name: 'Charts & Analysis',
    tagline: 'TradingView-grade workspace',
    desc: 'Overlay VWAP studies, view multiple symbols side-by-side, and navigate instantly with the command bar (⌘K). Intraday and daily timeframes.',
  },
  {
    icon: Grid3x3,
    name: 'Sectors',
    tagline: 'Rotation and relative strength',
    desc: 'Strength grid, performance bar charts, technicals table with RSI and MACD, relative rotation graph (RRG) vs. SPY, and embedded heatmap.',
  },
  {
    icon: Bell,
    name: 'Alerts',
    tagline: 'Smart price and VWAP notifications',
    desc: 'Real-time WebSocket alerts for VWAP crosses, price levels, and opening-range breakouts. Intraday and long-term modes. Volume and time-window filters.',
  },
  {
    icon: BookOpen,
    name: 'Watchlist',
    tagline: 'Track your universe with live prices',
    desc: 'Add any symbol to a personal list. Live quotes refresh every 15 seconds with up/down price flash animations on change.',
  },
  {
    icon: PieChart,
    name: 'Portfolio',
    tagline: 'Cost basis, P&L, and allocation',
    desc: 'Enter positions with shares and average cost. See real-time market value, gain/loss, return %, daily move, and an allocation pie chart.',
  },
  {
    icon: Layers,
    name: 'Heatmap',
    tagline: 'Visual breadth across 11 sectors',
    desc: 'Color-coded treemap of all 11 SPDR sector ETFs sized by strength score. Embedded in the Sectors page for contextual analysis.',
  },
  {
    icon: FlaskConical,
    name: 'Strategies',
    tagline: 'Backtest before you commit capital',
    desc: 'Run SMA crossover, VWAP regime, and opening-range strategies against any symbol. Benchmarked vs buy-and-hold with trade-by-trade breakdown.',
  },
  {
    icon: Newspaper,
    name: 'News',
    tagline: 'Filtered market news & economic events',
    desc: 'General market news, symbol-specific news, and an economic calendar — all in one tabbed view with sentiment context.',
  },
]

function ProductsPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="rise mb-16 text-center">
          <p className="eyebrow inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-flame" aria-hidden />
            Platform overview
          </p>
          <h1 className="display mt-3 text-3xl sm:text-4xl">Everything in one workspace</h1>
          <div className="ember-rule mx-auto mt-5 w-40" aria-hidden />
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-2">
            Ember Finance gives you the tools to read the market, track positions, and stress-test ideas — without switching between a dozen tabs.
          </p>
        </header>

        <div className="rise rise-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => {
            const Icon = p.icon
            return (
              <article key={p.name} className="panel panel-hover panel-pad h-full">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-ember/25 bg-ember/10 text-flame">
                    <Icon className="size-5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-semibold text-ink">{p.name}</h3>
                    <p className="text-[11px] text-ink-3">{p.tagline}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{p.desc}</p>
              </article>
            )
          })}
        </div>

        <div className="panel rise rise-3 mt-14 overflow-hidden">
          <div className="ember-rule" aria-hidden />
          <div className="px-6 py-8 text-center">
            <p className="font-display text-base font-semibold text-ink">Ready to explore the workspace?</p>
            <p className="mt-1 text-sm text-ink-2">Create a free account and unlock everything in seconds.</p>
            <Link to="/welcome" className="btn-primary mt-6 h-11 px-6">
              Get started
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

// ── Solutions ─────────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    icon: Zap,
    title: 'Active day traders',
    desc: 'You need speed. The ticker tape, intraday VWAP alerts, and opening-range breakout notifications keep you ahead of the move, not chasing it.',
    features: ['Real-time VWAP cross alerts', 'Opening range breakout detection', 'Volume-filtered alert triggers', 'Intraday price vs. VWAP charts'],
  },
  {
    icon: Activity,
    title: 'Swing traders',
    desc: 'You hold for days to weeks. Long-term price alerts, sector rotation signals, and the backtest engine let you plan entries with conviction.',
    features: ['Long-term price level alerts', 'Sector rotation via RRG', 'SMA & VWAP regime backtests', 'Watchlist with daily P&L tracking'],
  },
  {
    icon: DollarSign,
    title: 'Long-term investors',
    desc: 'You care about the big picture. The portfolio tracker, sector strength grid, and economic calendar keep your thesis grounded in macro reality.',
    features: ['Portfolio P&L & allocation pie', 'Sector strength heatmap', 'Economic calendar (high-impact)', 'Earnings calendar by date'],
  },
  {
    icon: Shield,
    title: 'Risk-focused analysts',
    desc: 'You quantify before you size. Market breadth (% above 200d MA), regime context, and backtest drawdown metrics give you the risk picture first.',
    features: ['S&P 500 breadth pulse', 'Predictive volatility heatmap', 'Backtest drawdown analysis', 'Market internals dashboard'],
  },
]

function SolutionsPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="rise mb-16 text-center">
          <p className="eyebrow inline-flex items-center gap-1.5">
            <Users className="size-3.5 text-flame" aria-hidden />
            Built for every style
          </p>
          <h1 className="display mt-3 text-3xl sm:text-4xl">One platform, every trader</h1>
          <div className="ember-rule mx-auto mt-5 w-40" aria-hidden />
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-2">
            Whether you trade intraday or hold for years, Ember Finance surfaces the signals you care about and hides the noise you don't.
          </p>
        </header>

        <div className="rise rise-2 grid gap-5 sm:grid-cols-2">
          {PERSONAS.map((p) => {
            const Icon = p.icon
            return (
              <article key={p.title} className="panel panel-hover panel-pad">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-ember/25 bg-ember/10 text-flame">
                    <Icon className="size-5" strokeWidth={2} aria-hidden />
                  </span>
                  <h3 className="font-display text-base font-semibold text-ink">{p.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">{p.desc}</p>
                <ul className="mt-4 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-ink-2">
                      <ChevronRight className="size-3.5 shrink-0 text-flame" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>

        <div className="rise rise-3 mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Clock, label: 'No learning curve', desc: 'The command bar (⌘K) navigates the full app by keyboard. Everything is where you expect it.' },
            { icon: Globe, label: 'Market hours aware', desc: 'Session labels, extended hours alert support, and market-open status shown in real time.' },
            { icon: Briefcase, label: 'No brokerage required', desc: 'Ember Finance is a research and planning tool. There is nothing to link — sign up and start immediately.' },
          ].map((c) => {
            const Icon = c.icon
            return (
              <div key={c.label} className="panel panel-pad">
                <Icon className="mb-3 size-5 text-flame" aria-hidden />
                <p className="text-sm font-medium text-ink">{c.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{c.desc}</p>
              </div>
            )
          })}
        </div>

        <div className="panel rise rise-4 mt-10 overflow-hidden">
          <div className="ember-rule" aria-hidden />
          <div className="px-6 py-8 text-center">
            <p className="font-display text-base font-semibold text-ink">Find your edge, whatever your style.</p>
            <Link to="/welcome" className="btn-primary mt-6 h-11 px-6">
              Start free
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

export function PlaceholderPage() {
  const { pathname } = useLocation()
  if (pathname === '/products') return <ProductsPage />
  if (pathname === '/solutions') return <SolutionsPage />
  return <Navigate to="/welcome" replace />
}
