import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox } from 'lucide-react'
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

// ── Chart-layer palette (hex is allowed only in chart JS config) ─────────────

const CHART = {
  up: '#3DDC97',
  upSoft: 'rgba(61,220,151,0.72)',
  down: '#FF6161',
  downSoft: 'rgba(255,97,97,0.72)',
  grid: 'rgba(244,232,216,0.06)',
  axis: '#837A6F',
  axisLine: 'rgba(244,232,216,0.16)',
  canvas: '#0A0807',
  surface: '#14110E',
  inkOnHeat: '#F4EFE9',
  inkOnHeatSoft: 'rgba(244,232,216,0.72)',
}

const QUAD = {
  leading:   { label: 'Leading',   color: '#3DDC97', chip: 'chip chip-up' },
  weakening: { label: 'Weakening', color: '#FFC24B', chip: 'chip chip-warn' },
  lagging:   { label: 'Lagging',   color: '#FF6161', chip: 'chip chip-down' },
  improving: { label: 'Improving', color: '#FF6B2C', chip: 'chip chip-ember' },
}

const TREND_STYLE = {
  Bullish: 'text-up',
  Bearish: 'text-down',
  Neutral: 'text-ink-3',
}

function pctFmt(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function numFmt(n, d = 4) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Number(n).toFixed(d)
}

// ── Directional value (triangle glyph so color is never the only signal) ─────

function Delta({ value, format = pctFmt }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-ink-3">—</span>
  const up = value >= 0
  return (
    <span className={['num inline-flex items-center gap-1', up ? 'text-up' : 'text-down'].join(' ')}>
      <svg viewBox="0 0 8 8" className="size-2 shrink-0" aria-hidden>
        <path d={up ? 'M4 1 7.5 7h-7z' : 'M4 7 .5 1h7z'} fill="currentColor" />
      </svg>
      {format(value)}
    </span>
  )
}

// ── Bar chart tooltip ─────────────────────────────────────────────────────────

function PerfTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line-strong bg-surface-1 px-3 py-2 text-xs shadow-xl shadow-black/40">
      <p className="font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="num" style={{ color: p.color }}>
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
    <div className="rounded-lg border border-line-strong bg-surface-1 px-3 py-2 text-xs shadow-xl shadow-black/40">
      <p className="font-semibold text-ink">
        {p.symbol} <span className="font-normal text-ink-3">({p.name})</span>
      </p>
      <p className="num mt-1 text-ink-2">
        RS-Ratio: <span className="text-ink">{Number(p.rsRatio).toFixed(4)}</span>
      </p>
      <p className="num text-ink-2">
        Momentum ({lag}d): <span className="text-ink">{Number(p.rsMomentum).toFixed(2)}%</span>
      </p>
      <p className="mt-1 text-[11px]" style={{ color: q.color }}>{q.label}</p>
    </div>
  )
}

// ── Quadrant legend pill ──────────────────────────────────────────────────────

function QuadPill({ quadrant }) {
  const q = QUAD[quadrant] ?? QUAD.lagging
  return <span className={q.chip}>{q.label}</span>
}

// ── Heatmap helpers ───────────────────────────────────────────────────────────
// Graded up/down tint over the panel surface — never a saturated pure fill.

function heatColor(pct) {
  if (pct == null || !Number.isFinite(pct)) return 'rgba(244,232,216,0.04)'
  const a = Math.abs(pct)
  const alpha = a >= 3 ? 0.5 : a >= 1.5 ? 0.36 : a >= 0.5 ? 0.24 : 0.12
  return pct >= 0 ? `rgba(61,220,151,${alpha})` : `rgba(255,97,97,${alpha})`
}

function HeatCell({ x, y, width, height, name, changePercent1d }) {
  const tooSmall = width < 48 || height < 30
  const compact = width < 78 || height < 46
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={CHART.surface} stroke={CHART.canvas} strokeWidth={2} rx={6} />
      <rect x={x} y={y} width={width} height={height} fill={heatColor(changePercent1d)} stroke={CHART.canvas} strokeWidth={2} rx={6} />
      {!tooSmall && (
        <>
          <text x={x + width / 2} y={y + height / 2 + (compact ? 0 : -8)} textAnchor="middle" dominantBaseline="middle"
            fill={CHART.inkOnHeat} fontSize={compact ? 10 : 12} fontWeight="700" fontFamily="'IBM Plex Mono', ui-monospace, monospace">
            {name}
          </text>
          {!compact && (
            <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" dominantBaseline="middle"
              fill={CHART.inkOnHeatSoft} fontSize={10} fontFamily="'IBM Plex Mono', ui-monospace, monospace">
              {changePercent1d != null ? `${changePercent1d >= 0 ? '+' : ''}${changePercent1d.toFixed(2)}%` : '—'}
            </text>
          )}
        </>
      )}
    </g>
  )
}

const HEAT_LEGEND = [
  { label: '< −3%', pct: -4 },
  { label: '−3 to −1.5%', pct: -2 },
  { label: '−1.5 to −0.5%', pct: -1 },
  { label: '−0.5 to 0%', pct: -0.2 },
  { label: '0 to 0.5%', pct: 0.2 },
  { label: '0.5 to 1.5%', pct: 1 },
  { label: '1.5 to 3%', pct: 2 },
  { label: '> 3%', pct: 4 },
]

// ── Horizontal mini bars (1W / 1M ranking) ────────────────────────────────────

function MiniBars({ title, rows, valueKey, scale }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const v = row[valueKey] ?? 0
          const up = v >= 0
          const w = Math.min(100, Math.abs(v) * scale)
          return (
            <div key={row.symbol} className="flex items-center gap-2">
              <span className="num w-8 shrink-0 text-[10px] text-ink-2">{row.symbol}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={['h-full rounded-full transition-all', up ? 'bg-up/60' : 'bg-down/60'].join(' ')}
                  style={{ width: `${w}%` }}
                />
              </div>
              <span className={['num w-12 text-right text-[10px]', up ? 'text-up' : 'text-down'].join(' ')}>
                {pctFmt(v)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">Markets · Sector rotation</p>
        <h1 className="display text-2xl sm:text-3xl">Sectors</h1>
        <div className="ember-rule mt-4" />
      </header>

      {error ? (
        <div className="panel panel-pad rise rise-1 border-down/25 bg-down/5">
          <p className="text-sm font-medium text-down">Sector data failed to load</p>
          <p className="mt-1 text-sm text-ink-2">{error}</p>
          <button type="button" onClick={() => load()} className="btn-ghost mt-4">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="rise rise-1 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy aria-label="Loading sectors">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* 1. Strength grid */}
          <section className="rise rise-1 space-y-3">
            <h2 className="eyebrow">Sector strength</h2>
            <SectorStrengthGrid
              data={strength}
              loading={!strength && !strengthError}
              error={strengthError}
              onSelect={(row) => setSelectedSymbol((prev) => prev === row?.symbol ? null : row?.symbol)}
            />
          </section>

          {/* 2. Performance bar + selected detail */}
          <div className="rise rise-2 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
            {/* Bar chart */}
            <div className="lg:col-span-8">
              <DashboardCard title="Performance comparison">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedBar} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="symbol" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                      <Tooltip content={<PerfTooltip />} cursor={{ fill: 'rgba(244,232,216,0.04)' }} />
                      <Bar dataKey="day" name="1D" radius={[4, 4, 0, 0]}>
                        {sortedBar.map((entry) => (
                          <Cell
                            key={entry.symbol}
                            fill={(entry.day ?? 0) >= 0 ? CHART.upSoft : CHART.downSoft}
                          />
                        ))}
                        <LabelList dataKey="day" position="top" formatter={(v) => typeof v === 'number' ? pctFmt(v) : ''} style={{ fill: CHART.axis, fontSize: 9 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Weekly/monthly mini bars */}
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2 sm:gap-3">
                  <MiniBars
                    title="1-Week"
                    rows={[...barChart].sort((a, b) => (b.week ?? 0) - (a.week ?? 0))}
                    valueKey="week"
                    scale={5}
                  />
                  <MiniBars
                    title="1-Month"
                    rows={[...barChart].sort((a, b) => (b.month ?? 0) - (a.month ?? 0))}
                    valueKey="month"
                    scale={2.5}
                  />
                </div>
              </DashboardCard>
            </div>

            {/* Selected sector detail or top/bottom movers */}
            <div className="lg:col-span-4">
              <DashboardCard title={selectedPoint ? `${selectedPoint.symbol} — detail` : 'Top & bottom movers'}>
                {selectedPoint ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-ink-3">{selectedPoint.name ?? selectedPoint.symbol}</p>
                      <QuadPill quadrant={selectedPoint.quadrant} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: '1D', v: selectedPoint.change1d, delta: true },
                        { label: '5D', v: selectedPoint.change5d, delta: true },
                        { label: '1M', v: selectedPoint.change22d, delta: true },
                        { label: 'RSI', v: selectedPoint.rsi14, delta: false },
                      ].map(({ label, v, delta }) => (
                        <div key={label} className="rounded-lg border border-line bg-surface-2 p-2.5">
                          <p className="text-[10px] font-medium tracking-wider text-ink-3 uppercase">{label}</p>
                          <p className="mt-1 text-sm font-semibold">
                            {delta
                              ? <Delta value={v} />
                              : <span className="num text-ink">{v != null && Number.isFinite(v) ? v.toFixed(1) : '—'}</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-line bg-surface-2 p-3">
                      <p className="mb-2 text-[10px] font-medium tracking-wider text-ink-3 uppercase">MACD</p>
                      <div className="num space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-ink-3">Line</span>
                          <span className="text-ink">{numFmt(selectedPoint.macd?.line)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-3">Signal</span>
                          <span className="text-ink">{numFmt(selectedPoint.macd?.signal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-3">Histogram</span>
                          <Delta value={selectedPoint.macd?.histogram} format={(n) => numFmt(n)} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/analysis/${selectedPoint.symbol}`)}
                        className="btn-primary flex-1 text-xs"
                      >
                        Open chart
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSymbol(null)}
                        className="btn-ghost text-xs"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="eyebrow mb-2 text-up">Top performers</p>
                      {[...barChart].sort((a, b) => (b.day ?? 0) - (a.day ?? 0)).slice(0, 3).map((row) => (
                        <button
                          key={row.symbol}
                          type="button"
                          onClick={() => setSelectedSymbol(row.symbol)}
                          className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-xs transition-colors hover:bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
                        >
                          <span className="num font-semibold text-ink">{row.symbol}</span>
                          <Delta value={row.day} />
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-line pt-3">
                      <p className="eyebrow mb-2 text-down">Weakest</p>
                      {[...barChart].sort((a, b) => (a.day ?? 0) - (b.day ?? 0)).slice(0, 3).map((row) => (
                        <button
                          key={row.symbol}
                          type="button"
                          onClick={() => setSelectedSymbol(row.symbol)}
                          className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-xs transition-colors hover:bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
                        >
                          <span className="num font-semibold text-ink">{row.symbol}</span>
                          <Delta value={row.day} />
                        </button>
                      ))}
                    </div>
                    <p className="pt-1 text-[10px] text-ink-3">Click a sector card above to see details.</p>
                  </div>
                )}
              </DashboardCard>
            </div>
          </div>

          {/* 3. Metrics table */}
          <div className="rise rise-3">
            <TableShell title="Sector technicals" subtitle="Click a row to inspect a sector">
              <table className="min-w-[880px]">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Quadrant</th>
                    <th>Trend</th>
                    <th className="num">RSI</th>
                    <th className="num">MACD</th>
                    <th className="num">Signal</th>
                    <th className="num">1D</th>
                    <th className="num">5D</th>
                    <th className="num">1M</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => {
                    const isSelected = selectedSymbol === p.symbol
                    return (
                      <tr
                        key={p.symbol}
                        className={['cursor-pointer', isSelected ? 'bg-ember/5' : ''].join(' ')}
                        onClick={() => setSelectedSymbol((prev) => prev === p.symbol ? null : p.symbol)}
                      >
                        <td className="num font-semibold text-ink">{p.symbol}</td>
                        <td><QuadPill quadrant={p.quadrant} /></td>
                        <td className={['text-xs font-medium', TREND_STYLE[p.trend] ?? TREND_STYLE.Neutral].join(' ')}>
                          {p.trend ?? '—'}
                        </td>
                        <td className="num">
                          {p.rsi14 != null ? (
                            <span className={p.rsi14 > 70 ? 'text-warn' : p.rsi14 < 30 ? 'text-flame' : 'text-ink-2'}>
                              {p.rsi14.toFixed(1)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="num text-ink-3">{numFmt(p.macd?.line)}</td>
                        <td className="num text-ink-3">{numFmt(p.macd?.signal)}</td>
                        <td className="num text-xs"><Delta value={p.change1d} /></td>
                        <td className="num text-xs"><Delta value={p.change5d} /></td>
                        <td className="num text-xs"><Delta value={p.change22d} /></td>
                        <td>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${p.symbol}`) }}
                            className="btn-ghost h-7 px-2 text-[11px]"
                          >
                            Chart
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {points.length === 0 && (
                    <tr>
                      <td className="px-4 py-10 text-center" colSpan={10}>
                        <Inbox className="mx-auto size-8 text-ink-3" aria-hidden />
                        <p className="mt-2 text-sm text-ink-2">No sector data yet.</p>
                        <button type="button" onClick={() => load()} className="btn-ghost mt-3">
                          Refresh
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableShell>
          </div>

          {/* 4. Sector heatmap treemap */}
          {strength?.rows?.length > 0 && (
            <div className="rise rise-4">
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
                    <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-ink-3">
                      <span
                        className="inline-block size-2.5 rounded-sm border border-line"
                        style={{ backgroundColor: heatColor(s.pct) }}
                      />
                      {s.label}
                    </span>
                  ))}
                </div>
              </DashboardCard>
            </div>
          )}

          {/* 5. RRG scatter chart */}
          {points.length > 0 && (
            <div className="rise rise-5">
              <DashboardCard title={`Relative rotation graph (vs. ${rrg?.benchmark ?? 'SPY'})`}>
                {/* Quadrant legend */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {Object.entries(QUAD).map(([key, { label, color }]) => (
                    <span key={key} className="flex items-center gap-1.5 text-[11px] text-ink-2">
                      <span className="size-2 rounded-full" style={{ background: color }} />
                      {label}
                    </span>
                  ))}
                  <span className="num ml-auto text-[10px] text-ink-3">Momentum lag: {lag}d</span>
                </div>
                <div className="h-[440px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 12, right: 24, bottom: 24, left: 12 }}>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="rsRatio"
                        tick={{ fill: CHART.axis, fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: CHART.axisLine }}
                        label={{ value: 'RS-Ratio (vs benchmark)', position: 'bottom', offset: 8, fill: CHART.axis, fontSize: 11 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="rsMomentum"
                        tick={{ fill: CHART.axis, fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: CHART.axisLine }}
                        tickFormatter={(v) => `${v.toFixed(1)}%`}
                        label={{ value: `RS-Momentum (${lag}d)`, angle: -90, position: 'insideLeft', fill: CHART.axis, fontSize: 11 }}
                      />
                      {medians && (
                        <>
                          <ReferenceLine x={medians.rsRatio} stroke={CHART.axisLine} strokeDasharray="4 4" />
                          <ReferenceLine y={medians.rsMomentum} stroke={CHART.axisLine} strokeDasharray="4 4" />
                        </>
                      )}
                      <Tooltip content={(props) => <QuadrantTooltip {...props} lag={lag} />} cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter data={points}>
                        {points.map((entry, i) => (
                          <Cell
                            key={`${entry.symbol}-${i}`}
                            fill={QUAD[entry.quadrant]?.color ?? CHART.axis}
                          />
                        ))}
                      </Scatter>
                      {/* Symbol labels rendered via custom dot isn't supported; label list on scatter */}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-center text-[11px] text-ink-3">
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
