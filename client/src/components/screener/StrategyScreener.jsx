import { ArrowUpRight, Bell, BellRing, Check, Loader2, Radar, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TableShell } from '../TableShell'
import { apiUrl, authHeaders } from '../../lib/apiBase'

const UNIVERSES = [
  { id: 'watchlist', label: 'My watchlist' },
  { id: 'sp500', label: 'S&P 500' },
]

function fmtPrice(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

const DIRECTION_META = {
  from_below: { label: 'From below', Icon: TrendingUp, color: 'text-emerald-400' },
  from_above: { label: 'From above', Icon: TrendingDown, color: 'text-sky-400' },
  golden_cross_imminent: { label: 'Golden cross', Icon: TrendingUp, color: 'text-emerald-400' },
  death_cross_imminent: { label: 'Death cross', Icon: TrendingDown, color: 'text-rose-400' },
  approaching_overbought: { label: 'Overbought', Icon: TrendingUp, color: 'text-amber-400' },
  approaching_oversold: { label: 'Oversold', Icon: TrendingDown, color: 'text-sky-400' },
}

function DirectionCell({ direction }) {
  const meta = DIRECTION_META[direction]
  if (!meta) return <span className="text-zinc-500">—</span>
  const { label, Icon, color } = meta
  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <Icon className="size-3.5" aria-hidden /> {label}
    </span>
  )
}

function ReadinessBar({ value }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const color = v >= 70 ? 'bg-emerald-400' : v >= 45 ? 'bg-amber-400' : 'bg-zinc-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="tabular-nums text-xs text-zinc-400">{v}</span>
    </div>
  )
}

/** Strategy-proximity screener: surfaces stocks approaching (and converging on) a target level. */
export function StrategyScreener({ token }) {
  const navigate = useNavigate()
  const [strategies, setStrategies] = useState([])
  const [strategyId, setStrategyId] = useState('')
  const [params, setParams] = useState({})
  const [threshold, setThreshold] = useState(0.5)
  const [universe, setUniverse] = useState('watchlist')
  const [intraday, setIntraday] = useState(false)

  const [loadingStrategies, setLoadingStrategies] = useState(true)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)
  const [run, setRun] = useState(null)

  const [alertState, setAlertState] = useState({}) // symbol -> 'saving'|'done'|'error'
  const [screenAlert, setScreenAlert] = useState('idle') // 'idle'|'saving'|'done'|'error'

  const strategy = useMemo(() => strategies.find((s) => s.id === strategyId) ?? null, [strategies, strategyId])

  // Load strategy metadata once.
  useEffect(() => {
    let cancelled = false
    async function loadStrategies() {
      try {
        const res = await fetch(apiUrl('/api/screener/strategies'), { headers: authHeaders(token) })
        const json = await res.json()
        if (cancelled) return
        const list = json.strategies ?? []
        setStrategies(list)
        const firstEnabled = list.find((s) => !s.disabled)
        if (firstEnabled) setStrategyId(firstEnabled.id)
      } catch {
        if (!cancelled) setStrategies([])
      } finally {
        if (!cancelled) setLoadingStrategies(false)
      }
    }
    loadStrategies()
    return () => { cancelled = true }
  }, [token])

  // When the strategy changes, reset params + threshold to that strategy's defaults.
  useEffect(() => {
    if (!strategy) return
    const p = {}
    for (const param of strategy.params ?? []) p[param.key] = param.default
    setParams(p)
    setThreshold(strategy.threshold?.default ?? 0.5)
    if (!strategy.supportsIntraday) setIntraday(false)
  }, [strategy])

  const setParam = (key) => (val) => setParams((prev) => ({ ...prev, [key]: val }))

  const handleRun = useCallback(async () => {
    if (!strategy || strategy.disabled) return
    setRunning(true)
    setRunError(null)
    setRun(null)
    setAlertState({})
    try {
      const res = await fetch(apiUrl('/api/screener/strategy/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ strategyId, universe, params, threshold, intraday }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Screener failed')
      setRun(json)
    } catch (e) {
      setRunError(e.message)
    } finally {
      setRunning(false)
    }
  }, [strategy, strategyId, universe, params, threshold, intraday, token])

  const createSymbolAlert = useCallback(async (symbol) => {
    setAlertState((prev) => ({ ...prev, [symbol]: 'saving' }))
    try {
      const res = await fetch(apiUrl('/api/alerts/strategy'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ scope: 'symbol', symbol, strategyId, params, threshold, intraday }),
      })
      setAlertState((prev) => ({ ...prev, [symbol]: res.ok ? 'done' : 'error' }))
    } catch {
      setAlertState((prev) => ({ ...prev, [symbol]: 'error' }))
    }
  }, [strategyId, params, threshold, intraday, token])

  const createScreenAlert = useCallback(async () => {
    setScreenAlert('saving')
    try {
      const res = await fetch(apiUrl('/api/alerts/strategy'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ scope: 'screen', universe, strategyId, params, threshold, intraday }),
      })
      setScreenAlert(res.ok ? 'done' : 'error')
      if (res.ok) setTimeout(() => setScreenAlert('idle'), 4000)
    } catch {
      setScreenAlert('error')
    }
  }, [universe, strategyId, params, threshold, intraday, token])

  if (loadingStrategies) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading strategies…
      </div>
    )
  }

  const thresholdUnit = strategy?.threshold?.unit ?? '%'
  const results = run?.results ?? []

  return (
    <div className="space-y-4">
      {/* Config card */}
      <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
        <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3.5">
          <Radar className="size-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Strategy setup</h2>
        </div>

        <div className="space-y-5 p-5">
          {/* Strategy picker */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Strategy</span>
              <select
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 focus:border-accent/35 focus:ring-2"
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.disabled} className="bg-neutral-900">
                    {s.label}{s.disabled ? ' (coming soon)' : ''}
                  </option>
                ))}
              </select>
              {strategy ? <p className="text-xs leading-relaxed text-zinc-500">{strategy.description}</p> : null}
            </div>

            {/* Universe */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Universe to scan</span>
              <div className="flex flex-wrap gap-1.5">
                {UNIVERSES.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUniverse(u.id)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                      universe === u.id
                        ? 'bg-accent-muted text-accent ring-1 ring-accent/30'
                        : 'border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200',
                    ].join(' ')}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              {strategy?.supportsIntraday ? (
                <label className="mt-1 inline-flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={intraday}
                    onChange={(e) => setIntraday(e.target.checked)}
                    className="size-3.5 accent-[color:var(--accent,#c0431f)]"
                  />
                  Use intraday session VWAP
                  {intraday && universe === 'sp500' ? (
                    <span className="text-amber-400/80">(capped to the most liquid names)</span>
                  ) : null}
                </label>
              ) : null}
            </div>
          </div>

          {/* Threshold + params */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {strategy?.threshold ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  {strategy.threshold.label} ≤ <span className="text-zinc-300">{threshold}{thresholdUnit}</span>
                </span>
                <input
                  type="range"
                  min={strategy.threshold.min}
                  max={strategy.threshold.max}
                  step={strategy.threshold.step}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-[color:var(--accent,#c0431f)]"
                />
              </div>
            ) : null}

            {(strategy?.params ?? []).map((p) => (
              <div key={p.key} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{p.label}</span>
                <input
                  type="number"
                  min={p.min}
                  max={p.max}
                  step={p.step ?? 1}
                  value={params[p.key] ?? p.default}
                  onChange={(e) => setParam(p.key)(e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleRun}
              disabled={running || !strategy || strategy.disabled}
              className="glass-btn--accent inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
              {running ? 'Scanning…' : 'Run scan'}
            </button>
            <button
              type="button"
              onClick={createScreenAlert}
              disabled={screenAlert === 'saving' || !strategy || strategy.disabled}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-zinc-100 disabled:opacity-50"
              title="Alert me when any name newly enters this screen"
            >
              {screenAlert === 'saving' ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
              {screenAlert === 'done' ? 'Watching screen ✓' : 'Watch this screen'}
            </button>
            {screenAlert === 'error' ? <span className="text-xs text-rose-400">Could not create screen alert.</span> : null}
          </div>
        </div>
      </section>

      {runError ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">{runError}</div>
      ) : null}

      {/* Results */}
      {run ? (
        results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <p className="text-sm font-medium text-zinc-400">Nothing is converging on this target right now</p>
            <p className="text-xs text-zinc-600">
              {run.nearButStalled > 0
                ? `${run.nearButStalled} name${run.nearButStalled === 1 ? ' is' : 's are'} near the level but not moving toward it.`
                : 'Try widening the threshold or picking another universe.'}
            </p>
          </div>
        ) : (
          <TableShell
            title={`${strategy?.label ?? 'Setups'} — ${results.length} converging`}
            subtitle={[
              `Scanned ${run.scanned} of ${run.universeSize}`,
              run.nearButStalled > 0 ? `${run.nearButStalled} near but stalled (hidden)` : null,
              run.truncated ? `capped at ${run.cap} most-liquid` : null,
            ].filter(Boolean).join(' · ')}
          >
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-1/80 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 font-medium">Target</th>
                  <th className="px-4 py-2.5 text-right font-medium">Distance</th>
                  <th className="px-4 py-2.5 font-medium">Direction</th>
                  <th className="px-4 py-2.5 text-right font-medium">ETA</th>
                  <th className="px-4 py-2.5 font-medium">Readiness</th>
                  <th className="px-4 py-2.5 text-center font-medium">Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/70">
                {results.map((r) => {
                  const st = alertState[r.symbol]
                  return (
                    <tr key={r.symbol} className="group transition-colors hover:bg-white/5">
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/analysis/${r.symbol}`)}
                          className="inline-flex items-center gap-2 font-semibold text-zinc-100 hover:text-accent"
                        >
                          {r.symbol}
                          <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-60" aria-hidden />
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">{fmtPrice(r.price)}</td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        <span className="text-zinc-300">{r.levelLabel}</span>
                        <span className="ml-1 tabular-nums text-zinc-500">
                          {r.levelValue != null ? (thresholdUnit === 'pts' ? r.levelValue : fmtPrice(r.levelValue)) : ''}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                        {r.distancePct != null ? `${r.distancePct.toFixed(2)}${thresholdUnit === 'pts' ? '' : '%'}` : '—'}
                      </td>
                      <td className="px-4 py-2.5"><DirectionCell direction={r.direction} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">
                        {r.etaBars != null ? `~${r.etaBars} bar${r.etaBars === 1 ? '' : 's'}` : '—'}
                      </td>
                      <td className="px-4 py-2.5"><ReadinessBar value={r.readiness} /></td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => createSymbolAlert(r.symbol)}
                          disabled={st === 'saving' || st === 'done'}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-500 transition hover:bg-accent/10 hover:text-accent disabled:opacity-100"
                          title={st === 'done' ? 'Alert created' : 'Alert me when this enters the setup'}
                          aria-label={`Set alert for ${r.symbol}`}
                        >
                          {st === 'saving' ? <Loader2 className="size-4 animate-spin" />
                            : st === 'done' ? <Check className="size-4 text-emerald-400" />
                            : <Bell className="size-4" />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableShell>
        )
      ) : null}
    </div>
  )
}
