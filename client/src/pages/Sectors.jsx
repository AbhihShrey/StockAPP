import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const QUAD = {
  leading: { label: 'Leading', color: '#34d399' },
  weakening: { label: 'Weakening', color: '#fbbf24' },
  lagging: { label: 'Lagging', color: '#f87171' },
  improving: { label: 'Improving', color: '#60a5fa' },
}

const TREND_STYLE = {
  Bullish: 'text-emerald-400',
  Bearish: 'text-rose-400',
  Neutral: 'text-zinc-400',
}

const DEFAULT_POLL_MS = 300_000

function QuadrantTooltip({ active, payload, lag }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const q = QUAD[p.quadrant] ?? QUAD.lagging
  return (
    <div className="rounded-lg border border-white/[0.12] bg-[#0c0e12] px-3 py-2 text-xs shadow-xl">
      <p className="font-mono font-semibold text-zinc-100">
        {p.symbol} <span className="font-sans font-normal text-zinc-500">({p.name})</span>
      </p>
      <p className="mt-1 tabular-nums text-zinc-400">
        RS-Ratio: <span className="text-zinc-200">{Number(p.rsRatio).toFixed(4)}</span>
      </p>
      <p className="tabular-nums text-zinc-400">
        RS-Momentum ({lag}d):{' '}
        <span className="text-zinc-200">{Number(p.rsMomentum).toFixed(2)}%</span>
      </p>
      <p className="mt-1 text-[11px]" style={{ color: q.color }}>
        {q.label}
      </p>
    </div>
  )
}

export function Sectors() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pollMs, setPollMs] = useState(DEFAULT_POLL_MS)

  const load = useCallback(async (opts) => {
    const silent = Boolean(opts?.silent)
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(apiUrl('/api/sectors'))
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            'API 404: start the Express server on port 3001 (e.g. `npm run dev` from the project root).',
          )
        }
        const msg =
          typeof json.message === 'string' ? json.message : `Request failed (${res.status})`
        throw new Error(msg)
      }
      setData(json)
      const ri = Number(json?.refreshIntervalMs)
      if (Number.isFinite(ri) && ri >= 30_000) setPollMs(ri)
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Failed to load sector data')
      if (!silent) setData(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => load({ silent: true }), pollMs)
    return () => window.clearInterval(id)
  }, [load, pollMs])

  const points = data?.points ?? []
  const barChart = data?.barChart ?? []
  const medians = data?.medians
  const lag = data?.momentumLagDays ?? 20

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Sectors</h1>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-surface-1/60 p-4 shadow-xl shadow-black/30 backdrop-blur-sm sm:p-6">
        {loading ? (
          <p className="py-16 text-center text-sm text-zinc-500">Loading sector data…</p>
        ) : error ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-red-400/90">{error}</p>
            <button
              type="button"
              onClick={() => load()}
              className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.08]"
            >
              Retry
            </button>
          </div>
        ) : points.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">No sector points to display.</p>
        ) : (
          <>
            <section className="mb-10 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200">Sector % change (1 day · 1 week · 1 month)</h2>
              <p className="text-xs text-zinc-500">
                Approx. 1 week = 5 trading days; ~1 month = 22 trading days (each sector ETF).
              </p>
              <div className="h-[320px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" opacity={0.55} />
                    <XAxis dataKey="symbol" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
                    <YAxis
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                      axisLine={{ stroke: '#3f3f46' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0c0e12',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(v) => [`${Number(v).toFixed(2)}%`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#71717a' }} />
                    <Bar dataKey="day" name="1 day %" fill="#60a5fa" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="week" name="1 week %" fill="#34d399" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="month" name="1 month %" fill="#fbbf24" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="mb-10 overflow-x-auto">
              <h2 className="mb-3 text-sm font-semibold text-zinc-200">Sector metrics</h2>
              <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
                <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Symbol</th>
                    <th className="py-2 pr-3 font-medium">Quadrant</th>
                    <th className="py-2 pr-3 font-medium">Trend</th>
                    <th className="py-2 pr-3 font-medium text-right">RSI</th>
                    <th className="py-2 pr-3 font-medium text-right">MACD</th>
                    <th className="py-2 pr-3 font-medium text-right">Signal</th>
                    <th className="py-2 pr-3 font-medium text-right">Hist</th>
                    <th className="py-2 pr-3 font-medium text-right">1D %</th>
                    <th className="py-2 pr-3 font-medium text-right">1W %</th>
                    <th className="py-2 font-medium text-right">1M %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {points.map((p) => (
                    <tr key={p.symbol} className="text-zinc-300">
                      <td className="py-2.5 pr-3 font-mono font-semibold text-zinc-100">{p.symbol}</td>
                      <td className="py-2.5 pr-3">
                        <span style={{ color: QUAD[p.quadrant]?.color ?? '#a1a1aa' }}>
                          {QUAD[p.quadrant]?.label ?? p.quadrant}
                        </span>
                      </td>
                      <td className={`py-2.5 pr-3 font-medium ${TREND_STYLE[p.trend] ?? TREND_STYLE.Neutral}`}>
                        {p.trend ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {p.rsi14 != null ? p.rsi14.toFixed(1) : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {p.macd?.line != null ? p.macd.line.toFixed(4) : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {p.macd?.signal != null ? p.macd.signal.toFixed(4) : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {p.macd?.histogram != null ? p.macd.histogram.toFixed(4) : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {p.change1d != null ? `${p.change1d > 0 ? '+' : ''}${p.change1d.toFixed(2)}%` : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {p.change5d != null ? `${p.change5d > 0 ? '+' : ''}${p.change5d.toFixed(2)}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {p.change22d != null ? `${p.change22d > 0 ? '+' : ''}${p.change22d.toFixed(2)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200">
                Relative strength quadrant <span className="font-normal text-zinc-500">(vs. SPY)</span>
              </h2>
              <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
                {Object.entries(QUAD).map(([key, { label, color }]) => (
                  <span key={key} className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>

              <div className="h-[420px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" opacity={0.6} />
                    <XAxis
                      type="number"
                      dataKey="rsRatio"
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      tickLine={{ stroke: '#3f3f46' }}
                      axisLine={{ stroke: '#3f3f46' }}
                      label={{
                        value: 'RS-Ratio (sector ÷ SPY)',
                        position: 'bottom',
                        offset: 0,
                        fill: '#71717a',
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="rsMomentum"
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      tickLine={{ stroke: '#3f3f46' }}
                      axisLine={{ stroke: '#3f3f46' }}
                      tickFormatter={(v) => `${v.toFixed(1)}%`}
                      label={{
                        value: `RS-Momentum (${lag}d % chg.)`,
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#71717a',
                        fontSize: 11,
                      }}
                    />
                    {medians ? (
                      <>
                        <ReferenceLine x={medians.rsRatio} stroke="#52525b" strokeDasharray="4 4" />
                        <ReferenceLine y={medians.rsMomentum} stroke="#52525b" strokeDasharray="4 4" />
                      </>
                    ) : null}
                    <Tooltip
                      content={(props) => <QuadrantTooltip {...props} lag={lag} />}
                      cursor={{ strokeDasharray: '3 3' }}
                    />
                    <Scatter data={points} fill="#8884d8">
                      {points.map((entry, i) => (
                        <Cell key={`${entry.symbol}-${i}`} fill={QUAD[entry.quadrant]?.color ?? '#a1a1aa'} />
                      ))}
                      <LabelList dataKey="symbol" position="top" offset={8} fill="#d4d4d8" fontSize={11} fontWeight={600} />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </section>

            <p className="mt-4 text-center text-[11px] text-zinc-600">
              Benchmark: {data?.benchmark ?? 'SPY'} · Median splits define quadrants (RRG-style).
            </p>
          </>
        )}
      </div>
    </div>
  )
}
