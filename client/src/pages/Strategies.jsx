import { FlaskConical } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Legend,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PriceVwapChart } from '../components/PriceVwapChart'
import { apiUrl } from '../lib/apiBase'

function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${Number(n).toFixed(2)}%`
}

function formatNum(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(d)
}

function formatMoney(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

const PNL_GREEN = '#34d399'
const PNL_RED = '#f87171'

/** Match headline cards: system sans, readable tooltips (not monospace). */
const CHART_TOOLTIP_STYLE = {
  background: '#0c0e12',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '0.5rem',
  fontSize: '12px',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

function tradeRangeLabel(payload) {
  if (!payload) return ''
  const a = String(payload.entry ?? '').trim()
  const b = String(payload.exit ?? '').trim()
  if (a && b) return `${a} → ${b}`
  if (a || b) return `${a || '—'} → ${b || '—'}`
  return String(payload.id ?? '')
}

const RISK_COMPARE_ROWS = [
  { key: 'totalReturnPct', label: 'Total return', kind: 'pct' },
  { key: 'sharpeRatio', label: 'Sharpe', kind: 'num' },
  { key: 'sortinoRatio', label: 'Sortino', kind: 'num' },
  { key: 'calmarRatio', label: 'Calmar', kind: 'num' },
  { key: 'maxDrawdownPct', label: 'Max drawdown', kind: 'pct' },
]

function formatRiskCell(kind, val) {
  if (val === null || val === undefined || Number.isNaN(val)) return '—'
  return kind === 'pct' ? formatPct(val) : formatNum(val, 2)
}

/** Compact display for vectorbt `allStats` (many long floats). */
function formatAllStatDisplay(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 4,
      minimumFractionDigits: 0,
    }).format(value)
  }
  if (typeof value === 'string') {
    const t = value.trim()
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
      const n = Number(t)
      if (Number.isFinite(n)) {
        return new Intl.NumberFormat(undefined, {
          maximumFractionDigits: 4,
          minimumFractionDigits: 0,
        }).format(n)
      }
    }
    return t.length > 96 ? `${t.slice(0, 93)}…` : value
  }
  const s = String(value)
  return s.length > 96 ? `${s.slice(0, 93)}…` : s
}

export function Strategies() {
  const [strategies, setStrategies] = useState([])
  const [strategiesError, setStrategiesError] = useState(null)
  const [symbol, setSymbol] = useState('AAPL')
  const [strategyId, setStrategyId] = useState('sma_cross')
  const [start, setStart] = useState('2020-01-01')
  const [end, setEnd] = useState(todayISODate)
  const [fastWindow, setFastWindow] = useState(20)
  const [slowWindow, setSlowWindow] = useState(50)
  const [trendSma, setTrendSma] = useState(0)
  const [rollWindow, setRollWindow] = useState(20)
  const [orOpeningMinutes, setOrOpeningMinutes] = useState(30)
  const [orBufferBps, setOrBufferBps] = useState(0)
  const [orOptimize, setOrOptimize] = useState(true)
  const [loading, setLoading] = useState(false)
  const [runError, setRunError] = useState(null)
  const [result, setResult] = useState(null)

  const loadStrategies = useCallback(async () => {
    setStrategiesError(null)
    try {
      const res = await fetch(apiUrl('/api/backtest/strategies'))
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.message ?? `Could not load strategies (${res.status})`)
      }
      const list = Array.isArray(json.strategies) ? json.strategies : []
      setStrategies(list)
      setStrategyId((prev) => (list.some((s) => s.id === prev) ? prev : list[0]?.id ?? prev))
    } catch (e) {
      setStrategiesError(e instanceof Error ? e.message : 'Failed to load strategies')
    }
  }, [])

  useEffect(() => {
    loadStrategies()
  }, [loadStrategies])

  const selectedMeta = useMemo(
    () => strategies.find((s) => s.id === strategyId),
    [strategies, strategyId],
  )

  const onRun = useCallback(
    async (e) => {
      e.preventDefault()
      setLoading(true)
      setRunError(null)
      setResult(null)
      try {
        let params
        if (strategyId === 'sma_cross') {
          params = {
            fastWindow: Number(fastWindow) || 20,
            slowWindow: Number(slowWindow) || 50,
          }
        } else if (strategyId === 'vwap_trend') {
          const ts = Number(trendSma)
          const rw = Number(rollWindow)
          params = {
            trendSma: Number.isFinite(ts) ? Math.max(0, Math.floor(ts)) : 0,
            rollWindow: Number.isFinite(rw) ? Math.max(5, Math.min(252, Math.floor(rw))) : 20,
          }
        } else if (strategyId === 'opening_range_hl') {
          const om = Number(orOpeningMinutes)
          const bb = Number(orBufferBps)
          params = {
            interval: '5m',
            openingMinutes: Number.isFinite(om) ? Math.max(5, Math.min(180, Math.floor(om))) : 30,
            bufferBps: Number.isFinite(bb) ? Math.max(0, Math.min(200, bb)) : 0,
            forceFlatEod: true,
            optimize: Boolean(orOptimize),
          }
        }
        const res = await fetch(apiUrl('/api/backtest/run'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: symbol.trim().toUpperCase(),
            strategyId,
            start: start || undefined,
            end: end || undefined,
            params,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(json?.message ?? `Backtest failed (${res.status})`)
        }
        setResult(json)
      } catch (err) {
        setRunError(err instanceof Error ? err.message : 'Backtest failed')
      } finally {
        setLoading(false)
      }
    },
    [
      symbol,
      strategyId,
      start,
      end,
      fastWindow,
      slowWindow,
      trendSma,
      rollWindow,
      orOpeningMinutes,
      orBufferBps,
      orOptimize,
    ],
  )

  const compareEquityData = useMemo(() => {
    const cmp = result?.equityCompare
    if (Array.isArray(cmp) && cmp.length > 0) {
      return cmp.map((p) => ({
        t: String(p.t).slice(0, 10),
        strategy: p.strategy,
        benchmark: p.benchmark,
      }))
    }
    const pts = Array.isArray(result?.equity) ? result.equity : []
    return pts.map((p) => ({
      t: String(p.t).slice(0, 10),
      strategy: p.v,
      benchmark: null,
    }))
  }, [result])

  const hasBenchmarkEquity = useMemo(
    () => compareEquityData.some((d) => d.benchmark != null && !Number.isNaN(Number(d.benchmark))),
    [compareEquityData],
  )

  const tradePnLData = useMemo(() => {
    const src =
      Array.isArray(result?.tradesForReportedPeriod) && result.tradesForReportedPeriod.length > 0
        ? result.tradesForReportedPeriod
        : Array.isArray(result?.trades)
          ? result.trades
          : []
    return src.map((t) => ({
      id: `#${t.tradeIndex}`,
      pnl: t.pnl ?? 0,
      entry: t.entryDate ?? '',
      exit: t.exitDate ?? '',
    }))
  }, [result])

  const sortedAllStats = useMemo(() => {
    const entries = Object.entries(result?.allStats ?? {})
    entries.sort(([a], [b]) => a.localeCompare(b))
    return entries
  }, [result])

  const m = result?.metrics ?? {}
  const bmMetrics = result?.benchmark?.metrics ?? {}
  const benchmarkLabel = result?.benchmark?.label ?? 'Buy & hold'
  const meth = result?.methodology ?? {}

  return (
    <div className="app-page-enter space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Strategies</h1>
        <FlaskConical
          className={['size-6 shrink-0 text-accent/70', loading ? 'backtest-flask-spin' : ''].join(' ')}
          strokeWidth={2}
          aria-hidden
        />
      </header>

      {strategiesError ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200">
          <p className="font-medium">Strategy catalog unavailable</p>
          <p className="mt-1 text-amber-200/85">{strategiesError}</p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border-subtle bg-surface-1/60 p-5 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-6">
        <h2 className="text-base font-semibold text-zinc-100">Run backtest</h2>
        {/* subtitle removed for cleaner UI */}
        <form onSubmit={onRun} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Symbol</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/15"
              maxLength={16}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Strategy</span>
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/15"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Start</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/15"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">End</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/15"
            />
          </label>
          {strategyId === 'opening_range_hl' ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Opening range (minutes)
                </span>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={orOpeningMinutes}
                  onChange={(e) => setOrOpeningMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/15"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Buffer (bps)</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={0.5}
                  value={orBufferBps}
                  onChange={(e) => setOrBufferBps(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/15"
                />
              </label>
              <label className="flex cursor-pointer items-end gap-2 text-xs text-zinc-400 sm:col-span-2 lg:col-span-2">
                <input
                  type="checkbox"
                  className="rounded border-border-subtle bg-surface-0/40"
                  checked={orOptimize}
                  onChange={(e) => setOrOptimize(e.target.checked)}
                />
                Optimize in-window (best total return)
              </label>
            </>
          ) : null}
          {strategyId === 'vwap_trend' ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Rolling VWAP (days)
                </span>
                <input
                  type="number"
                  min={5}
                  max={252}
                  value={rollWindow}
                  onChange={(e) => setRollWindow(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/15"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Trend SMA (0 = off)
                </span>
                <input
                  type="number"
                  min={0}
                  max={250}
                  value={trendSma}
                  onChange={(e) => setTrendSma(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/15"
                />
              </label>
            </>
          ) : null}
          {strategyId === 'sma_cross' ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Fast SMA</span>
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={fastWindow}
                  onChange={(e) => setFastWindow(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/15"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Slow SMA</span>
                <input
                  type="number"
                  min={3}
                  max={300}
                  value={slowWindow}
                  onChange={(e) => setSlowWindow(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-subtle bg-surface-0/40 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-white/15"
                />
              </label>
            </>
          ) : null}
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="glass-btn--accent rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Running…' : 'Run backtest'}
            </button>
          </div>
        </form>
      </section>

      {runError ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-200">
          <p className="font-medium">Backtest error</p>
          <p className="mt-1 text-rose-200/85">{runError}</p>
        </div>
      ) : null}

      {result ? (
        <section className="dash-module-enter space-y-6" style={{ '--dash-stagger': '0ms' }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">Results</h2>
            <p className="text-xs text-zinc-500">
              <span className="font-mono text-zinc-400">{result.symbol}</span> · {result.strategyId} ·{' '}
              <span className="text-zinc-400">{result.engine}</span> · {result.start} → {result.end}
            </p>
          </div>

          {meth.reportingNote || result.paramsUsed ? (
            <div className="rounded-xl border border-border-subtle bg-surface-1/40 p-4 text-sm text-zinc-400">
              {meth.reportingNote ? <p>{meth.reportingNote}</p> : null}
              {result.paramsUsed ? (
                <p className="mt-2 font-mono text-xs text-zinc-500">
                  Params: {JSON.stringify(result.paramsUsed)}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border-subtle bg-surface-1/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-5">
            <h3 className="text-sm font-semibold text-zinc-200">Equity: strategy vs buy &amp; hold</h3>
            <div className="mt-4 h-72 w-full">
              {compareEquityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={compareEquityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="oklch(0.26 0.01 255 / 0.35)" vertical={false} />
                    <XAxis dataKey="t" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: '#a1a1aa', fontFamily: CHART_TOOLTIP_STYLE.fontFamily }}
                      formatter={(value, name) => [
                        typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value,
                        name,
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                      formatter={(value) => <span className="text-zinc-400">{value}</span>}
                    />
                    <Line
                      type="monotone"
                      dataKey="strategy"
                      name={selectedMeta?.label ?? result.strategyId}
                      stroke="oklch(0.72 0.17 165)"
                      strokeWidth={2}
                      dot={false}
                    />
                    {hasBenchmarkEquity ? (
                      <Line
                        type="monotone"
                        dataKey="benchmark"
                        name={benchmarkLabel}
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-zinc-500">No equity samples.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-1/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-5">
            <h3 className="text-sm font-semibold text-zinc-200">Risk-adjusted return (vs benchmark)</h3>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-surface-1/40">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-2 font-medium">Metric</th>
                    <th className="px-4 py-2 font-medium tabular-nums">{selectedMeta?.label ?? result.strategyId}</th>
                    <th className="px-4 py-2 font-medium tabular-nums">{benchmarkLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/70">
                  {RISK_COMPARE_ROWS.map((row) => (
                    <tr key={row.key} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 text-zinc-400">{row.label}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-100">
                        {formatRiskCell(row.kind, m[row.key])}
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-300">
                        {formatRiskCell(row.kind, bmMetrics[row.key])}
                      </td>
                    </tr>
                  ))}
                  <tr className="hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-zinc-400">Win rate</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-100">{formatPct(m.winRatePct)}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-300">
                      {bmMetrics.winRatePct != null ? formatPct(bmMetrics.winRatePct) : '—'}
                    </td>
                  </tr>
                  <tr className="hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-zinc-400">Closed trades</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-100">
                      {m.totalTrades != null ? String(m.totalTrades) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-300">
                      {bmMetrics.totalTrades != null ? String(bmMetrics.totalTrades) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <PriceVwapChart
            symbol={result.symbol}
            start={result.start}
            end={result.end}
            enabled={Boolean(result.symbol && result.start && result.end)}
            title={`${result.symbol} — price vs VWAP (same window)`}
            subtitle="Compare the backtest window to cumulative daily VWAP from FMP OHLCV (cached on the API)."
          />

          <div className="rounded-2xl border border-border-subtle bg-surface-1/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-5">
            <h3 className="text-sm font-semibold text-zinc-200">Per-trade P&amp;L</h3>
            <div className="mt-4 h-72 w-full">
              {tradePnLData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tradePnLData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid stroke="oklch(0.26 0.01 255 / 0.35)" vertical={false} />
                    <XAxis
                      dataKey="id"
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ fontFamily: CHART_TOOLTIP_STYLE.fontFamily }}
                      formatter={(value) => [formatMoney(value), 'P&L']}
                      labelFormatter={(_, payload) => tradeRangeLabel(payload?.[0]?.payload)}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {tradePnLData.map((entry) => (
                        <Cell key={entry.id} fill={entry.pnl >= 0 ? PNL_GREEN : PNL_RED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-zinc-500">No closed trades.</p>
              )}
            </div>
          </div>

          {tradePnLData.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-1/40">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Entry</th>
                    <th className="px-4 py-2 font-medium">Exit</th>
                    <th className="px-4 py-2 font-medium">Entry $</th>
                    <th className="px-4 py-2 font-medium">Exit $</th>
                    <th className="px-4 py-2 font-medium">P&amp;L</th>
                    <th className="px-4 py-2 font-medium">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/70">
                  {(result.tradesForReportedPeriod?.length ? result.tradesForReportedPeriod : result.trades).map(
                    (t) => (
                      <tr key={t.tradeIndex} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-2 font-mono text-zinc-300">{t.tradeIndex}</td>
                        <td className="px-4 py-2 font-mono text-zinc-400">{t.entryDate ?? '—'}</td>
                        <td className="px-4 py-2 font-mono text-zinc-400">{t.exitDate ?? '—'}</td>
                        <td className="px-4 py-2 font-mono tabular-nums text-zinc-400">{formatNum(t.entryPrice, 2)}</td>
                        <td className="px-4 py-2 font-mono tabular-nums text-zinc-400">{formatNum(t.exitPrice, 2)}</td>
                        <td
                          className={[
                            'px-4 py-2 font-mono tabular-nums',
                            (t.pnl ?? 0) > 0 ? 'text-emerald-400' : (t.pnl ?? 0) < 0 ? 'text-rose-400' : 'text-zinc-400',
                          ].join(' ')}
                        >
                          {formatMoney(t.pnl)}
                        </td>
                        <td className="px-4 py-2 font-mono tabular-nums text-zinc-400">{formatPct(t.returnPct)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {sortedAllStats.length > 0 ? (
            <details open className="rounded-xl border border-border-subtle bg-surface-1/40 p-4 text-sm">
              <summary className="cursor-pointer font-medium text-zinc-300">
                Full strategy statistics ({sortedAllStats.length} from vectorbt)
              </summary>
              <dl className="mt-3 grid max-h-[28rem] grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto text-xs sm:grid-cols-2 lg:grid-cols-3">
                {sortedAllStats.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-white/[0.04] py-1.5">
                    <dt className="shrink-0 font-sans text-zinc-500">{k}</dt>
                    <dd className="text-right font-sans font-medium tabular-nums text-zinc-200">
                      {formatAllStatDisplay(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
