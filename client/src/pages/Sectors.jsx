import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts'
import { DashboardCard } from '../components/DashboardCard'
import { SectorStrengthGrid } from '../components/SectorStrengthGrid'
import { TableShell } from '../components/TableShell'
import { apiUrl } from '../lib/apiBase'

// ── Color helpers ─────────────────────────────────────────────────────────────

const QUAD = {
  leading:   { label: 'Leading',   color: '#34d399', bg: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' },
  weakening: { label: 'Weakening', color: '#fbbf24', bg: 'bg-amber-500/10 text-amber-300 ring-amber-500/20' },
  lagging:   { label: 'Lagging',   color: '#f87171', bg: 'bg-rose-500/10 text-rose-300 ring-rose-500/20' },
  improving: { label: 'Improving', color: '#60a5fa', bg: 'bg-blue-500/10 text-blue-300 ring-blue-500/20' },
}

const TREND_STYLE = {
  Bullish: 'text-emerald-400',
  Bearish: 'text-rose-400',
  Neutral: 'text-zinc-400',
}

const TOOLTIP_STYLE = {
  background: '#0c0e12',
  border: '1px solid oklch(0.24 0 0 / 0.62)',
  borderRadius: '0.5rem',
  fontSize: '12px',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
}

function pctFmt(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function numFmt(n, d = 4) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Number(n).toFixed(d)
}

// ── Bar chart tooltip ─────────────────────────────────────────────────────────

function PerfTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-xl">
      <p className="font-semibold text-zinc-200">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? pctFmt(p.value) : '—'}
        </p>
      ))}
    </div>
  )
}

// ── RRG tooltip ───────────────────────────────────────────────────────────────

function QuadrantTooltip({ active, payload, lag }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const q = QUAD[p.quadrant] ?? QUAD.lagging
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-xl">
      <p className="font-semibold text-zinc-100">
        {p.symbol} <span className="font-normal text-zinc-500">({p.name})</span>
      </p>
      <p className="mt-1 tabular-nums text-zinc-400">
        RS-Ratio: <span className="text-zinc-200">{Number(p.rsRatio).toFixed(4)}</span>
      </p>
      <p className="tabular-nums text-zinc-400">
        Momentum ({lag}d): <span className="text-zinc-200">{Number(p.rsMomentum).toFixed(2)}%</span>
      </p>
      <p className="mt-1 text-[11px]" style={{ color: q.color }}>{q.label}</p>
    </div>
  )
}

// ── Quadrant legend pill ──────────────────────────────────────────────────────

function QuadPill({ quadrant }) {
  const q = QUAD[quadrant] ?? QUAD.lagging
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${q.bg}`}>
      {q.label}
    </span>
  )
}

// ── Heatmap helpers ───────────────────────────────────────────────────────────

function heatColor(pct) {
  if (pct == null) return 'oklch(0.22 0.01 240)'
  if (pct >= 3)   return 'oklch(0.55 0.17 165)'
  if (pct >= 1.5) return 'oklch(0.63 0.15 165)'
  if (pct >= 0.5) return 'oklch(0.68 0.11 165)'
  if (pct >= 0)   return 'oklch(0.45 0.05 165)'
  if (pct > -0.5) return 'oklch(0.42 0.06 25)'
  if (pct > -1.5) return 'oklch(0.50 0.13 25)'
  if (pct > -3)   return 'oklch(0.55 0.18 25)'
  return 'oklch(0.48 0.22 25)'
}

function HeatCell({ x, y, width, height, name, changePercent1d }) {
  const fill = heatColor(changePercent1d)
  const tooSmall = width < 48 || height < 30
  const compact = width < 78 || height < 46
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="oklch(0.10 0.01 240)" strokeWidth={2} rx={5} />
      {!tooSmall && (
        <>
          <text x={x + width / 2} y={y + height / 2 + (compact ? 0 : -8)} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.93)" fontSize={compact ? 10 : 12} fontWeight="700" fontFamily="ui-monospace, monospace">
            {name}
          </text>
          {!compact && (
            <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,255,255,0.78)" fontSize={10} fontFamily="ui-monospace, monospace">
              {changePercent1d != null ? `${changePercent1d >= 0 ? '+' : ''}${changePercent1d.toFixed(2)}%` : '—'}
            </text>
          )}
        </>
      )}
    </g>
  )
}

const HEAT_LEGEND = [
  { label: '< −3%',          color: 'oklch(0.48 0.22 25)' },
  { label: '−3 to −1.5%',    color: 'oklch(0.55 0.18 25)' },
  { label: '−1.5 to −0.5%',  color: 'oklch(0.50 0.13 25)' },
  { label: '−0.5 to 0%',     color: 'oklch(0.42 0.06 25)' },
  { label: '0 to 0.5%',      color: 'oklch(0.45 0.05 165)' },
  { label: '0.5 to 1.5%',    color: 'oklch(0.68 0.11 165)' },
  { label: '1.5 to 3%',      color: 'oklch(0.63 0.15 165)' },
  { label: '> 3%',           color: 'oklch(0.55 0.17 165)' },
]

// ── Main component ────────────────────────────────────────────────────────────

export function Sectors() {
  const navigate = useNavigate()
  const [rrg, setRrg] = useState(null)
  const [strength, setStrength] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [strengthError, setStrengthError] = useState(null)
  const [pollMs, setPollMs] = useState(300_000)
  const [selectedSymbol, setSelectedSymbol] = useState(null)

  const load = useCallback(async (opts) => {
    const silent = Boolean(opts?.silent)
    if (!silent) { setLoading(true); setError(null) }
    try {
      const [rrgRes, strRes] = await Promise.all([
        fetch(apiUrl('/api/sectors')),
        fetch(apiUrl('/api/dashboard-sectors')),
      ])
      const rrgJson = await rrgRes.json().catch(() => ({}))
      const strJson = await strRes.json().catch(() => ({}))

      if (!rrgRes.ok) throw new Error(rrgJson?.message ?? `Sectors failed (${rrgRes.status})`)
      setRrg(rrgJson)

      if (strRes.ok) { setStrength(strJson); if (!silent) setStrengthError(null) }
      else if (!silent) setStrengthError(strJson?.message ?? 'Strength data unavailable')

      const ri = Number(rrgJson?.refreshIntervalMs)
      if (Number.isFinite(ri) && ri >= 30_000) setPollMs(ri)
    } catch (e) {
      if (!silent) { setError(e instanceof Error ? e.message : 'Failed to load sector data'); setRrg(null) }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = window.setInterval(() => load({ silent: true }), pollMs)
    return () => window.clearInterval(id)
  }, [load, pollMs])

  const points = rrg?.points ?? []
  const barChart = rrg?.barChart ?? []
  const medians = rrg?.medians
  const lag = rrg?.momentumLagDays ?? 20

  // Sort bar chart by 1d change for visual impact
  const sortedBar = [...barChart].sort((a, b) => (b.day ?? 0) - (a.day ?? 0))

  // Selected row for the detail sidebar
  const selectedPoint = selectedSymbol ? points.find((p) => p.symbol === selectedSymbol) : null

  return (
    <div className="app-page-enter space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Sectors</h1>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm">
          <p className="font-medium text-rose-200">Failed to load sector data</p>
          <p className="mt-1 text-rose-200/70">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="glass-btn mt-3 rounded-lg px-4 py-2 text-xs"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border-subtle bg-white/[0.03]" style={{ animationDelay: `${i * 30}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 1. Strength grid */}
          <section className="dash-module-enter space-y-3" style={{ '--dash-stagger': '0ms' }}>
            <h2 className="text-sm font-semibold text-zinc-300">Sector strength</h2>
            <SectorStrengthGrid
              data={strength}
              loading={!strength && !strengthError}
              error={strengthError}
              onSelect={(row) => setSelectedSymbol((prev) => prev === row?.symbol ? null : row?.symbol)}
            />
          </section>

          {/* 2. Performance bar + selected detail */}
          <div className="dash-module-enter grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start" style={{ '--dash-stagger': '80ms' }}>
            {/* Bar chart */}
            <div className="lg:col-span-8">
              <DashboardCard title="Performance comparison">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedBar} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="oklch(0.24 0 0 / 0.35)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="symbol" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                      <Tooltip content={<PerfTooltip />} />
                      <Bar dataKey="day" name="1D" radius={[4, 4, 0, 0]}>
                        {sortedBar.map((entry) => (
                          <Cell
                            key={entry.symbol}
                            fill={(entry.day ?? 0) >= 0 ? 'rgba(52,211,153,0.75)' : 'rgba(248,113,133,0.75)'}
                          />
                        ))}
                        <LabelList dataKey="day" position="top" formatter={(v) => typeof v === 'number' ? pctFmt(v) : ''} style={{ fill: '#a1a1aa', fontSize: 9 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Weekly/monthly mini bars */}
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle/50 pt-4">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">1-Week</p>
                    <div className="space-y-1.5">
                      {[...barChart].sort((a, b) => (b.week ?? 0) - (a.week ?? 0)).map((row) => {
                        const v = row.week ?? 0
                        const up = v >= 0
                        const w = Math.min(100, Math.abs(v) * 5)
                        return (
                          <div key={row.symbol} className="flex items-center gap-2">
                            <span className="w-8 shrink-0 text-[10px] font-mono text-zinc-400">{row.symbol}</span>
                            <div className="flex-1 rounded-full bg-white/5 overflow-hidden h-1.5">
                              <div
                                className={`h-full rounded-full transition-all ${up ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`}
                                style={{ width: `${w}%` }}
                              />
                            </div>
                            <span className={`w-12 text-right text-[10px] tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pctFmt(v)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">1-Month</p>
                    <div className="space-y-1.5">
                      {[...barChart].sort((a, b) => (b.month ?? 0) - (a.month ?? 0)).map((row) => {
                        const v = row.month ?? 0
                        const up = v >= 0
                        const w = Math.min(100, Math.abs(v) * 2.5)
                        return (
                          <div key={row.symbol} className="flex items-center gap-2">
                            <span className="w-8 shrink-0 text-[10px] font-mono text-zinc-400">{row.symbol}</span>
                            <div className="flex-1 rounded-full bg-white/5 overflow-hidden h-1.5">
                              <div
                                className={`h-full rounded-full transition-all ${up ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`}
                                style={{ width: `${w}%` }}
                              />
                            </div>
                            <span className={`w-12 text-right text-[10px] tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pctFmt(v)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </DashboardCard>
            </div>

            {/* Selected sector detail or top/bottom movers */}
            <div className="lg:col-span-4">
              <DashboardCard title={selectedPoint ? `${selectedPoint.symbol} — detail` : 'Top & bottom movers'}>
                {selectedPoint ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-zinc-500">{selectedPoint.name ?? selectedPoint.symbol}</p>
                      <QuadPill quadrant={selectedPoint.quadrant} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: '1D', value: pctFmt(selectedPoint.change1d) },
                        { label: '5D', value: pctFmt(selectedPoint.change5d) },
                        { label: '1M', value: pctFmt(selectedPoint.change22d) },
                        { label: 'RSI', value: selectedPoint.rsi14 != null ? selectedPoint.rsi14.toFixed(1) : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg border border-border-subtle bg-white/[0.02] p-2.5">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{label}</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-border-subtle bg-white/[0.02] p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-2">MACD</p>
                      <div className="space-y-1 text-xs tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Line</span>
                          <span className="text-zinc-200">{numFmt(selectedPoint.macd?.line)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Signal</span>
                          <span className="text-zinc-200">{numFmt(selectedPoint.macd?.signal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Histogram</span>
                          <span className={selectedPoint.macd?.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {numFmt(selectedPoint.macd?.histogram)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/analysis/${selectedPoint.symbol}`)}
                        className="flex-1 rounded-xl bg-accent-muted px-3 py-2 text-xs font-semibold text-accent ring-1 ring-accent/20 transition hover:brightness-110"
                      >
                        Open chart →
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSymbol(null)}
                        className="rounded-xl border border-border-subtle px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80">Top performers</p>
                      {[...barChart].sort((a, b) => (b.day ?? 0) - (a.day ?? 0)).slice(0, 3).map((row) => (
                        <button
                          key={row.symbol}
                          type="button"
                          onClick={() => setSelectedSymbol(row.symbol)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-white/5"
                        >
                          <span className="font-mono font-semibold text-zinc-200">{row.symbol}</span>
                          <span className="tabular-nums text-emerald-400">{pctFmt(row.day)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-border-subtle/50 pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-rose-500/80">Weakest</p>
                      {[...barChart].sort((a, b) => (a.day ?? 0) - (b.day ?? 0)).slice(0, 3).map((row) => (
                        <button
                          key={row.symbol}
                          type="button"
                          onClick={() => setSelectedSymbol(row.symbol)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-white/5"
                        >
                          <span className="font-mono font-semibold text-zinc-200">{row.symbol}</span>
                          <span className="tabular-nums text-rose-400">{pctFmt(row.day)}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-600 pt-1">Click a sector card above to see details.</p>
                  </div>
                )}
              </DashboardCard>
            </div>
          </div>

          {/* 3. Metrics table */}
          <div className="dash-module-enter" style={{ '--dash-stagger': '140ms' }}>
            <TableShell title="Sector technicals">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface-1/80 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
                    <tr className="border-b border-border-subtle">
                      <th className="px-4 py-2.5 font-medium">Symbol</th>
                      <th className="px-4 py-2.5 font-medium">Quadrant</th>
                      <th className="px-4 py-2.5 font-medium">Trend</th>
                      <th className="px-4 py-2.5 text-right font-medium">RSI</th>
                      <th className="px-4 py-2.5 text-right font-medium">MACD</th>
                      <th className="px-4 py-2.5 text-right font-medium">Signal</th>
                      <th className="px-4 py-2.5 text-right font-medium">1D</th>
                      <th className="px-4 py-2.5 text-right font-medium">5D</th>
                      <th className="px-4 py-2.5 text-right font-medium">1M</th>
                      <th className="px-4 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/70">
                    {points.map((p) => {
                      const isSelected = selectedSymbol === p.symbol
                      return (
                        <tr
                          key={p.symbol}
                          className={[
                            'cursor-pointer transition-colors hover:bg-white/5',
                            isSelected ? 'bg-accent/5' : '',
                          ].join(' ')}
                          onClick={() => setSelectedSymbol((prev) => prev === p.symbol ? null : p.symbol)}
                        >
                          <td className="px-4 py-2.5 font-mono font-semibold text-zinc-100">{p.symbol}</td>
                          <td className="px-4 py-2.5">
                            <QuadPill quadrant={p.quadrant} />
                          </td>
                          <td className={`px-4 py-2.5 text-xs font-medium ${TREND_STYLE[p.trend] ?? TREND_STYLE.Neutral}`}>
                            {p.trend ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                            {p.rsi14 != null ? (
                              <span className={p.rsi14 > 70 ? 'text-amber-400' : p.rsi14 < 30 ? 'text-blue-400' : 'text-zinc-300'}>
                                {p.rsi14.toFixed(1)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{numFmt(p.macd?.line)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{numFmt(p.macd?.signal)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums text-xs font-medium ${(p.change1d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pctFmt(p.change1d)}
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums text-xs font-medium ${(p.change5d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pctFmt(p.change5d)}
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums text-xs font-medium ${(p.change22d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pctFmt(p.change22d)}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${p.symbol}`) }}
                              className="rounded-lg border border-border-subtle px-2 py-1 text-[10px] text-zinc-500 transition hover:border-white/20 hover:text-zinc-200"
                            >
                              Chart
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {points.length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={10}>
                          No data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TableShell>
          </div>

          {/* 4. Sector heatmap treemap */}
          {strength?.rows?.length > 0 && (
            <div className="dash-module-enter" style={{ '--dash-stagger': '160ms' }}>
              <DashboardCard title="Sector heatmap · 1-day performance">
                <ResponsiveContainer width="100%" height={320}>
                  <Treemap
                    data={strength.rows.map((r) => ({ name: r.symbol, value: 100, changePercent1d: r.changePercent1d, changePercent5d: r.changePercent5d }))}
                    dataKey="value"
                    aspectRatio={4 / 3}
                    content={<HeatCell />}
                  >
                    {strength.rows.map((r) => (
                      <Cell key={r.symbol} fill={heatColor(r.changePercent1d)} />
                    ))}
                  </Treemap>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {HEAT_LEGEND.map((s) => (
                    <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  ))}
                </div>
              </DashboardCard>
            </div>
          )}

          {/* 5. RRG scatter chart */}
          {points.length > 0 && (
            <div className="dash-module-enter" style={{ '--dash-stagger': '200ms' }}>
              <DashboardCard title={`Relative rotation graph (vs. ${rrg?.benchmark ?? 'SPY'})`}>
                {/* Quadrant legend */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {Object.entries(QUAD).map(([key, { label, color }]) => (
                    <span key={key} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <span className="size-2 rounded-full" style={{ background: color }} />
                      {label}
                    </span>
                  ))}
                  <span className="ml-auto text-[10px] text-zinc-600">Momentum lag: {lag}d</span>
                </div>
                <div className="h-[440px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 12, right: 24, bottom: 24, left: 12 }}>
                      <CartesianGrid stroke="oklch(0.24 0 0 / 0.35)" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="rsRatio"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: '#3f3f46' }}
                        label={{ value: 'RS-Ratio (vs benchmark)', position: 'bottom', offset: 8, fill: '#52525b', fontSize: 11 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="rsMomentum"
                        tick={{ fill: '#71717a', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: '#3f3f46' }}
                        tickFormatter={(v) => `${v.toFixed(1)}%`}
                        label={{ value: `RS-Momentum (${lag}d)`, angle: -90, position: 'insideLeft', fill: '#52525b', fontSize: 11 }}
                      />
                      {medians && (
                        <>
                          <ReferenceLine x={medians.rsRatio} stroke="#3f3f46" strokeDasharray="4 4" />
                          <ReferenceLine y={medians.rsMomentum} stroke="#3f3f46" strokeDasharray="4 4" />
                        </>
                      )}
                      <Tooltip content={(props) => <QuadrantTooltip {...props} lag={lag} />} cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter data={points}>
                        {points.map((entry, i) => (
                          <Cell
                            key={`${entry.symbol}-${i}`}
                            fill={QUAD[entry.quadrant]?.color ?? '#71717a'}
                          />
                        ))}
                      </Scatter>
                      {/* Symbol labels rendered via custom dot isn't supported; label list on scatter */}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-600">
                  Click a row in the technicals table to highlight a sector · {rrg?.benchmark ?? 'SPY'} median splits define quadrant boundaries
                </p>
              </DashboardCard>
            </div>
          )}
        </>
      )}
    </div>
  )
}
