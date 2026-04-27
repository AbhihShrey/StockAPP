import {
  Activity,
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
import { StockLineLogo } from '../components/StockLineLogo'

function PageShell({ children }) {
  return (
    <div className="min-h-dvh bg-surface-0 text-zinc-200 antialiased">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-surface-0/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/welcome">
            <StockLineLogo size="xs" layout="horizontal" showTagline={false} />
          </Link>
          <Link
            to="/welcome"
            className="text-sm font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-200 hover:underline"
          >
            ← Back
          </Link>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/[0.06] py-8 text-center">
        <p className="text-xs text-zinc-600">© {new Date().getFullYear()} StockLine · For informational purposes only.</p>
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
    desc: 'Add any symbol to a personal list. Live quotes refresh every 15 seconds with green/red price flash animations on change.',
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
        <div className="mb-16 text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <Sparkles className="size-3.5 text-accent" />
            Platform overview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">Everything in one workspace</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-base">
            StockLine gives you the tools to read the market, track positions, and stress-test ideas — without switching between a dozen tabs.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => {
            const Icon = p.icon
            return (
              <article
                key={p.name}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-neutral-950/60 p-5 transition hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)]"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-accent/8 blur-2xl transition group-hover:bg-accent/15" />
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-accent">
                    <Icon className="size-4.5" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                    <p className="text-[11px] text-zinc-500">{p.tagline}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{p.desc}</p>
              </article>
            )
          })}
        </div>

        <div className="mt-14 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-8 text-center">
          <p className="text-base font-medium text-zinc-100">Ready to explore the workspace?</p>
          <p className="mt-1 text-sm text-zinc-500">Create a free account and unlock everything in seconds.</p>
          <Link
            to="/welcome"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-muted px-6 py-2.5 text-sm font-semibold text-accent shadow-[inset_0_0_0_1px_oklch(0.72_0.17_165/0.25)] transition hover:brightness-110"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
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
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.05]',
    desc: 'You need speed. The ticker tape, intraday VWAP alerts, and opening-range breakout notifications keep you ahead of the move, not chasing it.',
    features: ['Real-time VWAP cross alerts', 'Opening range breakout detection', 'Volume-filtered alert triggers', 'Intraday price vs. VWAP charts'],
  },
  {
    icon: Activity,
    title: 'Swing traders',
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/[0.05]',
    desc: 'You hold for days to weeks. Long-term price alerts, sector rotation signals, and the backtest engine let you plan entries with conviction.',
    features: ['Long-term price level alerts', 'Sector rotation via RRG', 'SMA & VWAP regime backtests', 'Watchlist with daily P&L tracking'],
  },
  {
    icon: DollarSign,
    title: 'Long-term investors',
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.05]',
    desc: 'You care about the big picture. The portfolio tracker, sector strength grid, and economic calendar keep your thesis grounded in macro reality.',
    features: ['Portfolio P&L & allocation pie', 'Sector strength heatmap', 'Economic calendar (high-impact)', 'Earnings calendar by date'],
  },
  {
    icon: Shield,
    title: 'Risk-focused analysts',
    color: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/[0.05]',
    desc: 'You quantify before you size. Market breadth (% above 200d MA), regime context, and backtest drawdown metrics give you the risk picture first.',
    features: ['S&P 500 breadth pulse', 'Predictive volatility heatmap', 'Backtest drawdown analysis', 'Market internals dashboard'],
  },
]

function SolutionsPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-16 text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <Users className="size-3.5 text-accent" />
            Built for every style
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">One platform, every trader</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-base">
            Whether you trade intraday or hold for years, StockLine surfaces the signals you care about and hides the noise you don't.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {PERSONAS.map((p) => {
            const Icon = p.icon
            return (
              <article
                key={p.title}
                className={`rounded-2xl border ${p.border} ${p.bg} p-6 transition hover:-translate-y-0.5`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex size-10 items-center justify-center rounded-xl border ${p.border} bg-white/[0.03] ${p.color}`}>
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <h3 className="text-base font-semibold text-zinc-100">{p.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{p.desc}</p>
                <ul className="mt-4 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-zinc-400">
                      <ChevronRight className={`size-3.5 shrink-0 ${p.color}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Clock, label: 'No learning curve', desc: 'The command bar (⌘K) navigates the full app by keyboard. Everything is where you expect it.' },
            { icon: Globe, label: 'Market hours aware', desc: 'Session labels, extended hours alert support, and market-open status shown in real time.' },
            { icon: Briefcase, label: 'No brokerage required', desc: 'StockLine is a research and planning tool. There is nothing to link — sign up and start immediately.' },
          ].map((c) => {
            const Icon = c.icon
            return (
              <div key={c.label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                <Icon className="mb-3 size-5 text-accent" />
                <p className="text-sm font-medium text-zinc-100">{c.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{c.desc}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-8 text-center">
          <p className="text-base font-medium text-zinc-100">Find your edge, whatever your style.</p>
          <Link
            to="/welcome"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-muted px-6 py-2.5 text-sm font-semibold text-accent shadow-[inset_0_0_0_1px_oklch(0.72_0.17_165/0.25)] transition hover:brightness-110"
          >
            Start free <ArrowRight className="size-4" />
          </Link>
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
