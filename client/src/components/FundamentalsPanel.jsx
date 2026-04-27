import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_KEY_PREFIX = 'fundamentals:v2:'

function readCache(symbol) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${symbol}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed.value ?? null
  } catch {
    return null
  }
}

function writeCache(symbol, value) {
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${symbol}`,
      JSON.stringify({ at: Date.now(), value }),
    )
  } catch {
    // Quota / private mode — silently skip; in-memory state still works.
  }
}

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtRatio(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function fmtMoney(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  // FMP ratios-ttm returns decimals (0.42 = 42%); some endpoints already return as percent.
  // Heuristic: if |n| <= 1.5 we treat it as a decimal fraction; otherwise a percent.
  const pct = Math.abs(n) <= 1.5 ? n * 100 : n
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

// ── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, tone = 'neutral', hint = null }) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'bad'
        ? 'text-rose-300'
        : tone === 'warn'
          ? 'text-amber-300'
          : 'text-zinc-100'
  const ringClass =
    tone === 'good'
      ? 'ring-emerald-400/20'
      : tone === 'bad'
        ? 'ring-rose-400/20'
        : tone === 'warn'
          ? 'ring-amber-400/20'
          : 'ring-white/[0.06]'
  return (
    <div className={`rounded-lg bg-white/[0.02] px-3 py-2.5 ring-1 ${ringClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums tracking-tight ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p> : null}
    </div>
  )
}

// ── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{children}</div>
    </section>
  )
}

// ── Letter grade badge ──────────────────────────────────────────────────────

function GradeBadge({ letter, score }) {
  if (!letter && score == null) {
    return <span className="text-zinc-600">—</span>
  }
  const head = String(letter ?? '').trim().charAt(0).toUpperCase()
  const tone =
    head === 'A'
      ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30'
      : head === 'B'
        ? 'bg-teal-500/15 text-teal-300 ring-teal-400/30'
        : head === 'C'
          ? 'bg-amber-500/15 text-amber-300 ring-amber-400/30'
          : head === 'D' || head === 'F'
            ? 'bg-rose-500/15 text-rose-300 ring-rose-400/30'
            : 'bg-white/[0.04] text-zinc-300 ring-white/10'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex size-7 items-center justify-center rounded-md text-sm font-bold ring-1 ${tone}`}
        title={`FMP rating: ${letter ?? '—'}${score != null ? ` (${score}/5)` : ''}`}
      >
        {letter ?? '?'}
      </span>
      {score != null ? (
        <span className="text-[11px] tabular-nums text-zinc-400">{score}/5</span>
      ) : null}
    </span>
  )
}

// ── P/E tone helper ─────────────────────────────────────────────────────────

function peToneFor(pe) {
  if (pe == null || !Number.isFinite(pe)) return 'neutral'
  if (pe < 15) return 'good'
  if (pe > 40) return 'warn'
  return 'neutral'
}

function negativeTone(n) {
  if (n == null || !Number.isFinite(n)) return 'neutral'
  return n < 0 ? 'bad' : 'neutral'
}

// ── Description with show-more ──────────────────────────────────────────────

function Description({ text }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">About</h3>
      <p
        className={[
          'text-xs leading-relaxed text-zinc-400',
          expanded ? '' : 'line-clamp-3',
        ].join(' ')}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-[11px] font-medium text-accent transition hover:text-accent/80"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </section>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return <div className="h-[58px] animate-pulse rounded-lg bg-white/[0.03] ring-1 ring-white/[0.04]" />
}

function SkeletonSection({ title, count = 6 }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </section>
  )
}

// ── Main panel ──────────────────────────────────────────────────────────────

export function FundamentalsPanel({ symbol }) {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  const load = useCallback(async () => {
    if (!symbol) return
    const cached = readCache(symbol)
    if (cached) {
      setData(cached)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl(`/api/fundamentals/${encodeURIComponent(symbol)}`), {
        headers: authHeaders(token),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load fundamentals')
      setData(json)
      writeCache(symbol, json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [symbol, token])

  useEffect(() => {
    setData(null)
    setError(null)
    load()
  }, [load])

  const profile = data?.profile ?? null
  const m = data?.metrics ?? {}
  const rating = data?.rating ?? null

  const headerSubtitle = useMemo(() => {
    if (!profile) return null
    const bits = [profile.sector, profile.industry].filter(Boolean)
    return bits.join(' · ') || null
  }, [profile])

  if (!symbol) return null

  return (
    <aside className="rounded-xl border border-white/10 bg-neutral-900/50 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.55)]">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Fundamentals</p>
          <h2 className="mt-0.5 truncate text-sm font-semibold tracking-tight text-zinc-100">
            {profile?.name ?? symbol}
          </h2>
          {headerSubtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{headerSubtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
          aria-label={collapsed ? 'Expand fundamentals' : 'Collapse fundamentals'}
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </header>

      {collapsed ? null : (
        <div className="space-y-5 px-4 py-4">
          {error ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">
              <p className="font-medium">Couldn’t load fundamentals</p>
              <p className="mt-0.5 text-rose-200/80">{error}</p>
            </div>
          ) : loading && !data ? (
            <>
              <SkeletonSection title="Valuation" />
              <SkeletonSection title="Financials TTM" />
              <SkeletonSection title="Quality" count={6} />
            </>
          ) : (
            <>
              <Section title="Valuation">
                <StatCard label="P/E" value={fmtRatio(m.peRatio)} tone={peToneFor(m.peRatio)} />
                <StatCard label="Forward P/E" value={fmtRatio(m.forwardPe)} />
                <StatCard label="EV / EBITDA" value={fmtRatio(m.evToEbitda)} />
                <StatCard label="Price / Sales" value={fmtRatio(m.priceToSales)} />
                <StatCard label="Price / Book" value={fmtRatio(m.priceToBook)} />
                <StatCard label="EV / Revenue" value={fmtRatio(m.evToRevenue)} />
              </Section>

              <Section title="Financials TTM">
                <StatCard label="Revenue" value={fmtMoney(m.revenue)} tone={negativeTone(m.revenue)} />
                <StatCard label="Net Income" value={fmtMoney(m.netIncome)} tone={negativeTone(m.netIncome)} />
                <StatCard label="Gross Margin" value={fmtPct(m.grossMargin)} tone={negativeTone(m.grossMargin)} />
                <StatCard label="Net Margin" value={fmtPct(m.netMargin)} tone={negativeTone(m.netMargin)} />
                <StatCard label="Operating Margin" value={fmtPct(m.operatingMargin)} tone={negativeTone(m.operatingMargin)} />
                <StatCard label="Revenue Growth YoY" value={fmtPct(m.revenueGrowth)} tone={negativeTone(m.revenueGrowth)} />
              </Section>

              <Section title="Quality">
                <StatCard label="Debt / Equity" value={fmtRatio(m.debtToEquity)} />
                <StatCard label="Current Ratio" value={fmtRatio(m.currentRatio)} />
                <StatCard label="ROE" value={fmtPct(m.roe)} tone={negativeTone(m.roe)} />
                <StatCard label="ROA" value={fmtPct(m.roa)} tone={negativeTone(m.roa)} />
                <StatCard label="Free Cash Flow" value={fmtMoney(m.freeCashFlow)} tone={negativeTone(m.freeCashFlow)} />
                <div className="rounded-lg bg-white/[0.02] px-3 py-2.5 ring-1 ring-white/[0.06]">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">FMP Rating</p>
                  <div className="mt-1">
                    <GradeBadge letter={rating?.letter} score={rating?.score} />
                  </div>
                </div>
              </Section>

              <Description text={profile?.description} />
            </>
          )}
        </div>
      )}
    </aside>
  )
}
