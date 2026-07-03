import { ArrowUpRight, Bell, BellRing, CalendarClock, Check, Loader2, Radar, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TableShell } from '../TableShell'
import { apiUrl, authHeaders } from '../../lib/apiBase'

const UNIVERSES = [
  { id: 'watchlist', label: 'My watchlist' },
  { id: 'sp500', label: 'S&P 500' },
]

const EMBER_ACCENT = { accentColor: 'var(--color-ember)' }

function fmtPrice(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

const DIRECTION_META = {
  from_below: { label: 'From below', Icon: TrendingUp, color: 'text-up' },
  from_above: { label: 'From above', Icon: TrendingDown, color: 'text-ink-2' },
  golden_cross_imminent: { label: 'Golden cross', Icon: TrendingUp, color: 'text-up' },
  death_cross_imminent: { label: 'Death cross', Icon: TrendingDown, color: 'text-down' },
  approaching_overbought: { label: 'Overbought', Icon: TrendingUp, color: 'text-warn' },
  approaching_oversold: { label: 'Oversold', Icon: TrendingDown, color: 'text-ink-2' },
}

function DirectionCell({ direction }) {
  const meta = DIRECTION_META[direction]
  if (!meta) return <span className="text-ink-3">—</span>
  const { label, Icon, color } = meta
  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <Icon className="size-3.5" aria-hidden /> {label}
    </span>
  )
}

function ReadinessBar({ value }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const fill = v >= 70 ? 'bg-ember-grad' : v >= 45 ? 'bg-ember/50' : 'bg-ink-3/50'
  return (
    <div className="flex items-center gap-2" aria-label={`Readiness ${v} of 100`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${v}%` }} />
      </div>
      <span className={['num text-xs', v >= 70 ? 'font-semibold text-flame' : 'text-ink-2'].join(' ')}>{v}</span>
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
  const [liquidityFilter, setLiquidityFilter] = useState(true)

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
        body: JSON.stringify({ strategyId, universe, params, threshold, intraday, liquidityFilter }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Screener failed')
      setRun(json)
    } catch (e) {
      setRunError(e.message)
    } finally {
      setRunning(false)
    }
  }, [strategy, strategyId, universe, params, threshold, intraday, liquidityFilter, token])

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
      <div className="flex items-center justify-center py-16 text-sm text-ink-3">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Loading strategies…
      </div>
    )
  }

  const thresholdUnit = strategy?.threshold?.unit ?? '%'
  const results = run?.results ?? []

  return (
    <div className="space-y-4">
      {/* Config card */}
      <section className="panel">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
          <Radar className="size-4 text-ink-3" aria-hidden />
          <h2 className="eyebrow">Strategy setup</h2>
        </div>

        <div className="space-y-5 panel-pad">
          {/* Strategy picker */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className="block">
                <span className="field-label">Strategy</span>
                <select
                  value={strategyId}
                  onChange={(e) => setStrategyId(e.target.value)}
                  className="select"
                >
                  {strategies.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.disabled} className="bg-surface-2 text-ink">
                      {s.label}{s.disabled ? ' (coming soon)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {strategy ? <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{strategy.description}</p> : null}
            </div>

            {/* Universe */}
            <div>
              <span className="field-label" id="strategy-universe-label">Universe to scan</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="strategy-universe-label">
                {UNIVERSES.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUniverse(u.id)}
                    aria-pressed={universe === u.id}
                    className={[
                      'rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
                      universe === u.id
                        ? 'border-ember/30 bg-ember/10 text-flame'
                        : 'border-line bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink',
                    ].join(' ')}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              {strategy?.supportsIntraday ? (
                <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs text-ink-2">
                  <input
                    type="checkbox"
                    checked={intraday}
                    onChange={(e) => setIntraday(e.target.checked)}
                    className="size-3.5 cursor-pointer"
                    style={EMBER_ACCENT}
                  />
                  Use intraday session VWAP
                  {intraday && universe === 'sp500' ? (
                    <span className="text-warn">(capped to the most liquid names)</span>
                  ) : null}
                </label>
              ) : null}
              <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs text-ink-2">
                <input
                  type="checkbox"
                  checked={liquidityFilter}
                  onChange={(e) => setLiquidityFilter(e.target.checked)}
                  className="size-3.5 cursor-pointer"
                  style={EMBER_ACCENT}
                />
                Liquid names only
                <span className="text-ink-3">(skip penny / thin volume)</span>
              </label>
            </div>
          </div>

          {/* Threshold + params */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {strategy?.threshold ? (
              <label className="block">
                <span className="field-label">
                  {strategy.threshold.label} ≤ <span className="num text-ink">{threshold}{thresholdUnit}</span>
                </span>
                <input
                  type="range"
                  min={strategy.threshold.min}
                  max={strategy.threshold.max}
                  step={strategy.threshold.step}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="h-9 w-full cursor-pointer"
                  style={EMBER_ACCENT}
                />
              </label>
            ) : null}

            {(strategy?.params ?? []).map((p) => (
              <label key={p.key} className="block">
                <span className="field-label">{p.label}</span>
                <input
                  type="number"
                  min={p.min}
                  max={p.max}
                  step={p.step ?? 1}
                  value={params[p.key] ?? p.default}
                  onChange={(e) => setParam(p.key)(e.target.value)}
                  className="input"
                />
              </label>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleRun}
              disabled={running || !strategy || strategy.disabled}
              className="btn-primary"
            >
              {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Radar className="size-4" aria-hidden />}
              {running ? 'Scanning…' : 'Run scan'}
            </button>
            <button
              type="button"
              onClick={createScreenAlert}
              disabled={screenAlert === 'saving' || !strategy || strategy.disabled}
              className="btn-ghost"
              title="Alert me when any name newly enters this screen"
            >
              {screenAlert === 'saving'
                ? <Loader2 className="size-4 animate-spin" aria-hidden />
                : screenAlert === 'done'
                  ? <Check className="size-4 text-up" aria-hidden />
                  : <BellRing className="size-4" aria-hidden />}
              {screenAlert === 'done' ? 'Watching screen' : 'Watch this screen'}
            </button>
            {screenAlert === 'error' ? (
              <span className="text-xs text-down" role="alert">Could not create screen alert. Try again.</span>
            ) : null}
          </div>
        </div>
      </section>

      {runError ? (
        <div className="rounded-[14px] border border-down/30 bg-down/10 p-4 text-sm text-down" role="alert">
          {runError} — adjust the setup and run again.
        </div>
      ) : null}

      {/* Results */}
      {run ? (
        results.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 py-16 text-center">
            <Radar className="size-8 text-ink-3" aria-hidden />
            <p className="text-sm text-ink-2">
              {run.nearButStalled > 0
                ? `Nothing is converging right now — ${run.nearButStalled} name${run.nearButStalled === 1 ? ' is' : 's are'} near the level but not moving toward it.`
                : 'Nothing is converging on this target right now — widen the threshold or pick another universe.'}
            </p>
            <button type="button" onClick={handleRun} className="btn-ghost">
              Scan again
            </button>
          </div>
        ) : (
          <div className="rise">
            <TableShell
              title={`${strategy?.label ?? 'Setups'} — ${results.length} converging`}
              subtitle={[
                `Scanned ${run.scanned} of ${run.universeSize}`,
                run.nearButStalled > 0 ? `${run.nearButStalled} near but stalled (hidden)` : null,
                run.illiquidFiltered > 0 ? `${run.illiquidFiltered} illiquid filtered` : null,
                run.truncated ? `capped at ${run.cap} most-liquid` : null,
              ].filter(Boolean).join(' · ')}
            >
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="num">Price</th>
                    <th>Target</th>
                    <th className="num">Distance</th>
                    <th>Direction</th>
                    <th className="num">ETA</th>
                    <th>Readiness</th>
                    <th className="text-center">Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const st = alertState[r.symbol]
                    return (
                      <tr key={r.symbol} className="group">
                        <td>
                          <div className="flex flex-col items-start gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/analysis/${r.symbol}`)}
                              className="num inline-flex items-center gap-2 rounded font-semibold text-ink transition-colors duration-150 hover:text-flame outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
                            >
                              {r.symbol}
                              <ArrowUpRight className="size-3.5 text-ink-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
                            </button>
                            {r.earningsInDays != null ? (
                              <span
                                className={['chip text-[10px]', r.earningsFlag ? 'chip-warn' : ''].join(' ')}
                                title={`Reports earnings ${r.earningsDate}${r.earningsSession && r.earningsSession !== 'any' ? ` (${r.earningsSession.toUpperCase()})` : ''}`}
                              >
                                <CalendarClock className="size-3" aria-hidden />
                                {r.earningsInDays === 0 ? 'Earnings today' : `Earnings in ${r.earningsInDays}d`}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="num text-ink">{fmtPrice(r.price)}</td>
                        <td>
                          <span className="text-ink">{r.levelLabel}</span>
                          <span className="num ml-1 text-ink-3">
                            {r.levelValue != null ? (thresholdUnit === 'pts' ? r.levelValue : fmtPrice(r.levelValue)) : ''}
                          </span>
                        </td>
                        <td className="num font-medium text-flame">
                          {r.distancePct != null ? `${r.distancePct.toFixed(2)}${thresholdUnit === 'pts' ? '' : '%'}` : '—'}
                        </td>
                        <td><DirectionCell direction={r.direction} /></td>
                        <td className="num">
                          {r.etaBars != null ? `~${r.etaBars} bar${r.etaBars === 1 ? '' : 's'}` : '—'}
                        </td>
                        <td><ReadinessBar value={r.readiness} /></td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => createSymbolAlert(r.symbol)}
                            disabled={st === 'saving' || st === 'done'}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-ink-3 transition-colors duration-150 hover:bg-ember/10 hover:text-ember disabled:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
                            title={st === 'done' ? 'Alert created' : 'Alert me when this enters the setup'}
                            aria-label={`Set alert for ${r.symbol}`}
                          >
                            {st === 'saving' ? <Loader2 className="size-4 animate-spin" aria-hidden />
                              : st === 'done' ? <Check className="size-4 text-up" aria-hidden />
                              : <Bell className="size-4" aria-hidden />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableShell>
          </div>
        )
      ) : null}
    </div>
  )
}
