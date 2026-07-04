import { FlaskConical, TrendingDown, TrendingUp } from 'lucide-react'
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
import { FlameSpinner } from '../components/FlameSpinner'
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

/* Chart palette — hex allowed only in chart JS config (see design system). */
const CHART_GRID = 'rgba(244,232,216,0.06)'
const CHART_AXIS = '#8b7f6d'
const CHART_EQUITY = '#c88738'
const CHART_BENCHMARK = '#8b7f6d'
const PNL_GREEN = '#48c78e'
const PNL_RED = '#d96c63'

const CHART_TOOLTIP_STYLE = {
  background: '#14110E',
  border: '1px solid rgba(244,232,216,0.16)',
  borderRadius: '10px',
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

function directionClass(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return 'text-ink'
  if (n > 0) return 'text-up'
  if (n < 0) return 'text-down'
  return 'text-ink'
}

function KpiStat({ label, value, valueClass = 'text-ink', icon = null }) {
  return (
    <div className="panel panel-pad">
      <p className="eyebrow">{label}</p>
      <p className={['num mt-2 flex items-baseline gap-1.5 text-2xl font-semibold', valueClass].join(' ')}>
        {icon}
        {value}
      </p>
    </div>
  )
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

  const totalReturnIcon =
    m.totalReturnPct > 0 ? (
      <TrendingUp className="size-4 shrink-0" aria-hidden />
    ) : m.totalReturnPct < 0 ? (
      <TrendingDown className="size-4 shrink-0" aria-hidden />
    ) : null

  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">Research · Backtesting</p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="display text-2xl sm:text-3xl">Strategies</h1>
          <FlaskConical className="size-6 shrink-0 text-ember" strokeWidth={2} aria-hidden />
        </div>
        <div className="ember-rule mt-4" />
      </header>

      {strategiesError ? (
        <section className="rise rise-1 panel panel-pad border-warn/25 bg-warn/5">
          <p className="text-sm font-medium text-warn">Strategy catalog unavailable</p>
          <p className="mt-1 text-sm text-ink-2">{strategiesError}</p>
          <button type="button" onClick={loadStrategies} className="btn-ghost mt-3">
            Retry
          </button>
        </section>
      ) : null}

      <section className="rise rise-2 panel panel-pad">
        <h2 className="font-display text-base font-semibold text-ink" style={{ fontStretch: '108%' }}>
          Run backtest
        </h2>
        <form onSubmit={onRun} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="field-label">Symbol</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="input num"
              maxLength={16}
              required
            />
          </label>
          <label className="block">
            <span className="field-label">Strategy</span>
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="select"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Start</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="input num"
            />
          </label>
          <label className="block">
            <span className="field-label">End</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="input num"
            />
          </label>
          {strategyId === 'opening_range_hl' ? (
            <>
              <label className="block">
                <span className="field-label">Opening range (minutes)</span>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={orOpeningMinutes}
                  onChange={(e) => setOrOpeningMinutes(Number(e.target.value))}
                  className="input num"
                />
              </label>
              <label className="block">
                <span className="field-label">Buffer (bps)</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={0.5}
                  value={orBufferBps}
                  onChange={(e) => setOrBufferBps(Number(e.target.value))}
                  className="input num"
                />
              </label>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 self-end text-sm text-ink-2 sm:col-span-2 lg:col-span-2">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer rounded border-line bg-surface-2"
                  checked={orOptimize}
                  onChange={(e) => setOrOptimize(e.target.checked)}
                />
                Optimize in-window (best total return)
              </label>
            </>
          ) : null}
          {strategyId === 'vwap_trend' ? (
            <>
              <label className="block">
                <span className="field-label">Rolling VWAP (days)</span>
                <input
                  type="number"
                  min={5}
                  max={252}
                  value={rollWindow}
                  onChange={(e) => setRollWindow(Number(e.target.value))}
                  className="input num"
                />
              </label>
              <label className="block">
                <span className="field-label">Trend SMA (0 = off)</span>
                <input
                  type="number"
                  min={0}
                  max={250}
                  value={trendSma}
                  onChange={(e) => setTrendSma(Number(e.target.value))}
                  className="input num"
                />
              </label>
            </>
          ) : null}
          {strategyId === 'sma_cross' ? (
            <>
              <label className="block">
                <span className="field-label">Fast SMA</span>
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={fastWindow}
                  onChange={(e) => setFastWindow(Number(e.target.value))}
                  className="input num"
                />
              </label>
              <label className="block">
                <span className="field-label">Slow SMA</span>
                <input
                  type="number"
                  min={3}
                  max={300}
                  value={slowWindow}
                  onChange={(e) => setSlowWindow(Number(e.target.value))}
                  className="input num"
                />
              </label>
            </>
          ) : null}
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <>
                  <FlameSpinner size={16} />
                  Running…
                </>
              ) : (
                'Run backtest'
              )}
            </button>
          </div>
        </form>
      </section>

      {runError ? (
        <section className="rise panel panel-pad border-down/25 bg-down/5">
          <p className="text-sm font-medium text-down">Backtest failed</p>
          <p className="mt-1 text-sm text-ink-2">{runError}</p>
          <p className="mt-1 text-xs text-ink-3">Adjust the parameters and run it again.</p>
        </section>
      ) : null}

      {result ? (
        <section className="rise space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-ink" style={{ fontStretch: '108%' }}>
              Results
            </h2>
            <p className="text-xs text-ink-3">
              <span className="num text-ink-2">{result.symbol}</span> · {result.strategyId} ·{' '}
              <span className="text-ink-2">{result.engine}</span> ·{' '}
              <span className="num">
                {result.start} → {result.end}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            <KpiStat
              label="Total return"
              value={formatPct(m.totalReturnPct)}
              valueClass={directionClass(m.totalReturnPct)}
              icon={totalReturnIcon}
            />
            <KpiStat
              label="Max drawdown"
              value={formatPct(m.maxDrawdownPct)}
              valueClass={m.maxDrawdownPct != null && !Number.isNaN(m.maxDrawdownPct) ? 'text-down' : 'text-ink'}
            />
            <KpiStat label="Sharpe" value={formatNum(m.sharpeRatio, 2)} />
            <KpiStat label="Win rate" value={formatPct(m.winRatePct)} />
            <KpiStat
              label="Closed trades"
              value={m.totalTrades != null ? String(m.totalTrades) : '—'}
            />
          </div>

          {meth.reportingNote || result.paramsUsed ? (
            <div className="panel panel-pad text-sm text-ink-2">
              {meth.reportingNote ? <p>{meth.reportingNote}</p> : null}
              {result.paramsUsed ? (
                <p className="num mt-2 text-xs text-ink-3">
                  Params: {JSON.stringify(result.paramsUsed)}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="panel panel-pad">
            <p className="eyebrow">Equity · Strategy vs {benchmarkLabel}</p>
            <div className="mt-4 h-72 w-full">
              {compareEquityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={compareEquityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID} vertical={false} />
                    <XAxis
                      dataKey="t"
                      tick={{ fill: CHART_AXIS, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: CHART_AXIS, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: CHART_AXIS, fontFamily: CHART_TOOLTIP_STYLE.fontFamily }}
                      formatter={(value, name) => [
                        typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value,
                        name,
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                      formatter={(value) => <span className="text-ink-2">{value}</span>}
                    />
                    <Line
                      type="monotone"
                      dataKey="strategy"
                      name={selectedMeta?.label ?? result.strategyId}
                      stroke={CHART_EQUITY}
                      strokeWidth={2}
                      dot={false}
                    />
                    {hasBenchmarkEquity ? (
                      <Line
                        type="monotone"
                        dataKey="benchmark"
                        name={benchmarkLabel}
                        stroke={CHART_BENCHMARK}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-ink-3">No equity samples.</p>
              )}
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-line px-4 py-3 sm:px-5">
              <p className="eyebrow">Risk-adjusted return · vs benchmark</p>
            </div>
            <div className="tbl rounded-none border-0">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col" className="num">
                      {selectedMeta?.label ?? result.strategyId}
                    </th>
                    <th scope="col" className="num">
                      {benchmarkLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {RISK_COMPARE_ROWS.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td className="num text-ink">{formatRiskCell(row.kind, m[row.key])}</td>
                      <td className="num">{formatRiskCell(row.kind, bmMetrics[row.key])}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Win rate</td>
                    <td className="num text-ink">{formatPct(m.winRatePct)}</td>
                    <td className="num">
                      {bmMetrics.winRatePct != null ? formatPct(bmMetrics.winRatePct) : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>Closed trades</td>
                    <td className="num text-ink">{m.totalTrades != null ? String(m.totalTrades) : '—'}</td>
                    <td className="num">
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

          <div className="panel panel-pad">
            <p className="eyebrow">Per-trade P&amp;L</p>
            <div className="mt-4 h-72 w-full">
              {tradePnLData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tradePnLData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid stroke={CHART_GRID} vertical={false} />
                    <XAxis
                      dataKey="id"
                      tick={{ fill: CHART_AXIS, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tick={{ fill: CHART_AXIS, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={{ color: CHART_AXIS, fontFamily: CHART_TOOLTIP_STYLE.fontFamily }}
                      cursor={{ fill: 'rgba(244,232,216,0.05)' }}
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
                <p className="flex h-full items-center justify-center text-sm text-ink-3">No closed trades.</p>
              )}
            </div>
          </div>

          {tradePnLData.length > 0 ? (
            <div className="panel overflow-hidden">
              <div className="border-b border-line px-4 py-3 sm:px-5">
                <p className="eyebrow">Trade log</p>
              </div>
              <div className="tbl rounded-none border-0">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Entry</th>
                      <th scope="col">Exit</th>
                      <th scope="col" className="num">Entry $</th>
                      <th scope="col" className="num">Exit $</th>
                      <th scope="col" className="num">P&amp;L</th>
                      <th scope="col" className="num">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.tradesForReportedPeriod?.length ? result.tradesForReportedPeriod : result.trades).map(
                      (t) => (
                        <tr key={t.tradeIndex}>
                          <td className="num text-ink">{t.tradeIndex}</td>
                          <td className="num">{t.entryDate ?? '—'}</td>
                          <td className="num">{t.exitDate ?? '—'}</td>
                          <td className="num">{formatNum(t.entryPrice, 2)}</td>
                          <td className="num">{formatNum(t.exitPrice, 2)}</td>
                          <td
                            className={[
                              'num',
                              (t.pnl ?? 0) > 0 ? 'text-up' : (t.pnl ?? 0) < 0 ? 'text-down' : '',
                            ].join(' ')}
                          >
                            {formatMoney(t.pnl)}
                          </td>
                          <td className={['num', directionClass(t.returnPct)].join(' ')}>
                            {formatPct(t.returnPct)}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {sortedAllStats.length > 0 ? (
            <details open className="panel panel-pad text-sm">
              <summary className="cursor-pointer rounded-md font-medium text-ink-2 outline-none transition-colors duration-150 select-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60">
                Full strategy statistics ({sortedAllStats.length} from vectorbt)
              </summary>
              <dl className="scroll-thin mt-3 grid max-h-[28rem] grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto text-xs sm:grid-cols-2 lg:grid-cols-3">
                {sortedAllStats.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
                    <dt className="shrink-0 text-ink-3">{k}</dt>
                    <dd className="num text-right font-medium text-ink-2">
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
