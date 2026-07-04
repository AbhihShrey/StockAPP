import { Activity, AlertCircle, BarChart2, Bell, CalendarClock, ChevronDown, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { TableShell } from '../components/TableShell'
import { useAuth } from '../context/AuthContext'
import { useAlerts } from '../context/AlertContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

const CONDITIONS = [
  { id: 'vwap_above', label: 'Price crosses above VWAP' },
  { id: 'vwap_below', label: 'Price crosses below VWAP' },
  { id: 'price_above', label: 'Price goes above level ($)' },
  { id: 'price_below', label: 'Price goes below level ($)' },
  { id: 'orhl_above', label: 'Price crosses above Opening Range High' },
  { id: 'orhl_below', label: 'Price crosses below Opening Range Low' },
]

const SWING_CONDITIONS = [
  { id: 'price_above', label: 'Price crosses above level ($)' },
  { id: 'price_below', label: 'Price crosses below level ($)' },
]

function sessionLabel(s) {
  if (s === 'bmo') return 'BMO'
  if (s === 'amc') return 'AMC'
  return null
}

function fmtEarningsDate(iso) {
  if (!iso || typeof iso !== 'string') return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function todayEtIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

function daysUntilEarnings(iso) {
  if (!iso || typeof iso !== 'string') return null
  const target = new Date(`${iso}T00:00:00Z`)
  const today = new Date(`${todayEtIso()}T00:00:00Z`)
  if (Number.isNaN(target.getTime()) || Number.isNaN(today.getTime())) return null
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function EarningsCountdownBadge({ iso }) {
  const days = daysUntilEarnings(iso)
  if (days === null) return null
  const label =
    days < 0 ? `${Math.abs(days)}d ago`
    : days === 0 ? 'Today'
    : days === 1 ? 'Tomorrow'
    : `in ${days} days`
  const tone =
    days < 0 ? 'chip'
    : days === 0 ? 'chip chip-ember'
    : days <= 3 ? 'chip chip-warn'
    : 'chip'
  return <span className={`${tone} num`}>{label}</span>
}

const COOLDOWN_OPTIONS = [
  { value: 1, label: '1 min' },
  { value: 3, label: '3 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 0, label: 'One-shot (no repeat)' },
]

const SWING_COOLDOWN_OPTIONS = [
  { value: 1440, label: '24 hours (default)' },
  { value: 4320, label: '3 days' },
  { value: 10080, label: '1 week' },
  { value: 43200, label: '1 month' },
  { value: 0, label: 'One-shot (no repeat)' },
]

const ORHL_MINUTES = [
  { value: 1, label: '1-minute range' },
  { value: 3, label: '3-minute range' },
  { value: 5, label: '5-minute range' },
  { value: 15, label: '15-minute range' },
  { value: 30, label: '30-minute range' },
  { value: 60, label: '60-minute range' },
]

const VOLUME_OPTIONS = [
  { value: '', label: 'None (no filter)' },
  { value: '1.5', label: '≥ 1.5× avg bar vol' },
  { value: '2', label: '≥ 2× avg bar vol' },
  { value: '3', label: '≥ 3× avg bar vol' },
]

const TIME_WINDOW_OPTIONS = [
  { value: '', label: 'All day' },
  { value: '15', label: 'First 15 min (9:30–9:45)' },
  { value: '30', label: 'First 30 min (9:30–10:00)' },
  { value: '60', label: 'First hour (9:30–10:30)' },
  { value: '120', label: 'First 2 hours (9:30–11:30)' },
]

const BUFFER_OPTIONS = [
  { value: '', label: 'None' },
  { value: '0.1', label: '0.1% buffer' },
  { value: '0.25', label: '0.25% buffer' },
  { value: '0.5', label: '0.5% buffer' },
  { value: '1', label: '1% buffer' },
]

function orhlThresholdLabel(threshold) {
  const th = threshold != null && threshold !== '' ? Number(threshold) : NaN
  return Number.isFinite(th) ? `${th} min` : '—'
}

function conditionLabel(condition, threshold) {
  switch (condition) {
    case 'vwap_above': return 'Crosses above VWAP'
    case 'vwap_below': return 'Crosses below VWAP'
    case 'price_above': return `Above $${Number(threshold).toFixed(2)}`
    case 'price_below': return `Below $${Number(threshold).toFixed(2)}`
    case 'orhl_above': return `Crosses above OR High (${orhlThresholdLabel(threshold)})`
    case 'orhl_below': return `Crosses below OR Low (${orhlThresholdLabel(threshold)})`
    case 'earnings_report': return 'Earnings Report'
    case 'strategy_proximity': return 'Strategy proximity'
    default: return condition
  }
}

const STRATEGY_LABELS = {
  vwap_proximity: 'Approaching VWAP',
  ma_cross_approach: 'MA crossover imminent',
  rsi_extreme_approach: 'RSI nearing extreme',
  bollinger_approach: 'Approaching Bollinger band',
  near_52w_high: 'Approaching 52w high',
  near_52w_low: 'Approaching 52w low',
  near_50dma: 'Approaching 50-DMA',
  near_200dma: 'Approaching 200-DMA',
  near_round_number: 'Approaching round number',
  gap_fill: 'Approaching gap fill',
  orb_approach: 'Approaching OR break',
  gamma_levels: 'Approaching call wall / put support',
}

function describeStrategyAlert(alert) {
  const sp = alert.strategy_params ?? {}
  const label = STRATEGY_LABELS[alert.strategy_id] ?? alert.strategy_id ?? 'Strategy'
  const scope = sp.scope === 'screen' ? ` · screen (${sp.universe ?? 'universe'})` : ''
  return `${label}${scope}`
}

function formatCooldownMinutes(alert) {
  const raw = alert.cooldown_minutes ?? alert.cooldownMinutes
  const m = Number(raw)
  if (!Number.isFinite(m)) return '—'
  if (m === 0) return 'One-shot'
  if (m < 60) return `${m} min`
  if (m % 60 === 0) return `${m / 60} hr`
  return `${m} min`
}

function formatCooldownRemaining(alert, nowSec) {
  if (!alert.last_fired_at || !alert.cooldown_minutes || alert.cooldown_minutes === 0) return null
  const expiresAt = alert.last_fired_at + alert.cooldown_minutes * 60
  const remaining = expiresAt - nowSec
  if (remaining <= 0) return null
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function isCooling(alert, nowSec) {
  if (alert.is_active !== 1 || !alert.last_fired_at || !alert.cooldown_minutes) return false
  return (nowSec - alert.last_fired_at) < alert.cooldown_minutes * 60
}

function fmtTs(unixSec) {
  if (!unixSec) return '—'
  return new Date(unixSec * 1000).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ active, cooling }) {
  if (cooling) {
    return (
      <span className="chip chip-warn">
        <span className="size-1.5 rounded-full bg-warn" aria-hidden />
        Cooling
      </span>
    )
  }
  if (active) {
    return (
      <span className="chip chip-ember">
        <span className="size-1.5 rounded-full bg-ember" aria-hidden />
        Active
      </span>
    )
  }
  return (
    <span className="chip">
      <span className="size-1.5 rounded-full bg-ink-3" aria-hidden />
      Triggered
    </span>
  )
}

function EarningsStatusBadge({ active }) {
  if (active) {
    return (
      <span className="chip chip-ember">
        <span className="size-1.5 rounded-full bg-ember" aria-hidden />
        Watching
      </span>
    )
  }
  return (
    <span className="chip">
      <span className="size-1.5 rounded-full bg-ink-3" aria-hidden />
      Triggered
    </span>
  )
}

// ── Toggle switch (ember gradient when on) ────────────────────────────────────

function ToggleSwitch({ on, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ember/60',
        on ? 'bg-ember-grad border-transparent' : 'border-line-strong bg-surface-3',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block size-3.5 rounded-full bg-ink transition-transform duration-200',
          on ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
        ].join(' ')}
        aria-hidden
      />
    </button>
  )
}

// ── Shared chart panel (used by both VWAP and History popups) ─────────────────

function MiniChartPanel({ bars, loading, error, emptyMsg = 'No intraday data yet.' }) {
  const fmtTime = (str) => str?.split(' ')[1]?.slice(0, 5) ?? str
  // Chart palette per MASTER.md data-color rules
  const priceColor = '#c88738'
  const vwapColor = '#B5AB9F'

  const yDomain = bars && bars.length > 0
    ? (() => {
        const vals = bars.flatMap((b) => [b.price, b.vwap].filter((v) => v != null))
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        const pad = (max - min) * 0.2 || 0.5
        return [min - pad, max + pad]
      })()
    : ['auto', 'auto']

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="ember-spinner size-6" aria-label="Loading chart" /></div>
  if (error) return <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-down">{error}</div>
  if (!bars || bars.length === 0) return <div className="flex h-64 items-center justify-center text-sm text-ink-3">{emptyMsg}</div>

  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={bars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,232,216,0.06)" />
          <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ fontSize: 10, fill: '#8b7f6d' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={yDomain} tick={{ fontSize: 10, fill: '#8b7f6d' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
          <Tooltip
            contentStyle={{ background: '#14110E', border: '1px solid rgba(244,232,216,0.16)', borderRadius: 10, fontSize: 12, color: '#F4EFE9' }}
            labelFormatter={fmtTime}
            formatter={(val, key) => [`$${Number(val).toFixed(2)}`, key === 'price' ? 'Price' : 'VWAP']}
          />
          <Line type="monotone" dataKey="price" stroke={priceColor} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: priceColor, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="vwap" stroke={vwapColor} strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 3, fill: vwapColor, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-5">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <span className="inline-block h-px w-5 rounded" style={{ background: priceColor }} aria-hidden /> Price
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <svg width="20" height="4" viewBox="0 0 20 4" aria-hidden>
            <line x1="0" y1="2" x2="20" y2="2" stroke={vwapColor} strokeWidth="1.5" strokeDasharray="5 3" />
          </svg>
          VWAP
        </span>
      </div>
    </>
  )
}

// ── Chart popup shell (shared by VWAP and History) ────────────────────────────

function ChartPopup({ title, subtitle, onClose, onRefresh, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} chart`}
        className="glass w-[720px] max-w-full rounded-[14px] border border-line-strong shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="num text-sm font-semibold text-ink">{title}</p>
            <p className="text-xs text-ink-3">{subtitle}</p>
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh chart"
                title="Refresh chart"
                className="rounded-lg p-2 text-ink-3 outline-none transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
              >
                <RefreshCw className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chart"
              className="rounded-lg p-2 text-ink-3 outline-none transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="px-4 pb-4 pt-3">{children}</div>
      </div>
    </div>
  )
}

// ── VWAP Mini Chart Popup ────────────────────────────────────────────────────

function VwapMiniChart({ symbol, token, onClose }) {
  const [bars, setBars] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setBars(null)
    setLoading(true)
    setError(null)
    fetch(apiUrl(`/api/alerts/vwap-chart/${encodeURIComponent(symbol)}`), {
      headers: authHeaders(token),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.message || 'Failed to load chart data')
        setBars(json.bars)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [symbol, token, refreshKey])

  return (
    <ChartPopup
      title={symbol}
      subtitle="Price vs VWAP · last 30 min (1-min bars)"
      onClose={onClose}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    >
      <MiniChartPanel
        bars={bars}
        loading={loading}
        error={error}
        emptyMsg="No intraday data yet — market may not be open."
      />
    </ChartPopup>
  )
}

// ── History Chart Popup ───────────────────────────────────────────────────────

function HistoryChart({ symbol, triggeredAt, token, onClose }) {
  const [bars, setBars] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setBars(null)
    setLoading(true)
    setError(null)
    fetch(apiUrl(`/api/alerts/history-chart/${encodeURIComponent(symbol)}?at=${triggeredAt}`), {
      headers: authHeaders(token),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.message || 'Failed to load chart data')
        setBars(json.bars)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [symbol, triggeredAt, token, refreshKey])

  return (
    <ChartPopup
      title={symbol}
      subtitle={`Trigger context · ±30 min around ${fmtTs(triggeredAt)}`}
      onClose={onClose}
      onRefresh={() => setRefreshKey((k) => k + 1)}
    >
      <MiniChartPanel
        bars={bars}
        loading={loading}
        error={error}
        emptyMsg="No historical bar data found for this trigger."
      />
    </ChartPopup>
  )
}

// ── Create Alert Form ─────────────────────────────────────────────────────────

function CreateAlertForm({ token, onCreated, lockedType }) {
  const [alertType, setAlertType] = useState(lockedType === 'earnings' ? 'earnings' : (lockedType ?? 'intraday'))
  const [symbol, setSymbol] = useState('')
  const [condition, setCondition] = useState(lockedType === 'earnings' ? 'earnings_report' : 'vwap_above')
  const [threshold, setThreshold] = useState('')
  const [cooldown, setCooldown] = useState(60)
  const [volMult, setVolMult] = useState('')
  const [timeWin, setTimeWin] = useState('')
  const [bufPct, setBufPct] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // When switching tabs, force a valid condition and default cooldown
  const switchType = (type) => {
    setAlertType(type)
    setError(null)
    if (type === 'swing') {
      if (condition !== 'price_above' && condition !== 'price_below') setCondition('price_above')
      setCooldown(1440)
      setVolMult('')
      setTimeWin('')
    } else if (type === 'earnings') {
      setCondition('earnings_report')
      setThreshold('')
      setVolMult('')
      setTimeWin('')
      setBufPct('')
    } else {
      if (condition === 'earnings_report') setCondition('vwap_above')
      setCooldown(60)
    }
  }

  // Sync to page-level tab when it changes
  useEffect(() => {
    if (lockedType) switchType(lockedType)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedType])

  const isSwing = alertType === 'swing'
  const isEarnings = alertType === 'earnings' || condition === 'earnings_report'
  const activeConditions = isSwing ? SWING_CONDITIONS : CONDITIONS
  const activeCooldownOptions = isSwing ? SWING_COOLDOWN_OPTIONS : COOLDOWN_OPTIONS

  const needsPriceThreshold = condition === 'price_above' || condition === 'price_below'
  const isOrhl = condition === 'orhl_above' || condition === 'orhl_below'

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const sym = symbol.trim().toUpperCase()
      const createdFallback = Math.floor(Date.now() / 1000)
      const body = isEarnings
        ? {
            symbol: sym,
            condition: 'earnings_report',
          }
        : {
            symbol: sym,
            condition,
            cooldown_minutes: cooldown,
            alert_type: alertType,
            threshold: needsPriceThreshold ? Number(threshold) : isOrhl ? Number(threshold) : undefined,
            min_volume_mult: !isSwing && volMult !== '' ? Number(volMult) : undefined,
            time_window_minutes: !isSwing && timeWin !== '' ? Number(timeWin) : undefined,
            buffer_pct: needsPriceThreshold && bufPct !== '' ? Number(bufPct) : undefined,
          }
      const res = await fetch(apiUrl('/api/alerts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.message ?? 'Failed to create alert'); return }
      setSymbol('')
      setThreshold('')
      setVolMult('')
      setTimeWin('')
      setBufPct('')
      const a = json?.alert ?? {}
      onCreated({
        ...a,
        symbol: a.symbol ?? sym,
        condition: a.condition ?? condition,
        threshold: a.threshold ?? (isOrhl || needsPriceThreshold ? Number(threshold) : null),
        is_active: a.is_active ?? 1,
        alert_type: a.alert_type ?? (isEarnings ? 'earnings' : alertType),
        cooldown_minutes: a.cooldown_minutes ?? (isEarnings ? 0 : cooldown),
        min_volume_mult: a.min_volume_mult ?? (volMult !== '' ? Number(volMult) : null),
        time_window_minutes: a.time_window_minutes ?? (timeWin !== '' ? Number(timeWin) : null),
        buffer_pct: a.buffer_pct ?? (needsPriceThreshold && bufPct !== '' ? Number(bufPct) : null),
        earnings_date: a.earnings_date ?? null,
        earnings_session: a.earnings_session ?? null,
        earnings_eps_est: a.earnings_eps_est ?? null,
        earnings_prev_date: a.earnings_prev_date ?? null,
        created_at: a.created_at ?? createdFallback,
      })
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }, [symbol, condition, threshold, cooldown, volMult, timeWin, bufPct, alertType, isSwing, isEarnings, needsPriceThreshold, isOrhl, token, onCreated])

  const advancedBadgeLabels = [
    volMult !== '' && 'vol',
    timeWin !== '' && 'time',
    needsPriceThreshold && bufPct !== '' && 'buf',
  ].filter(Boolean)

  return (
    <section className="panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-ink-3" aria-hidden />
          <h2 className="eyebrow">Create alert</h2>
        </div>
        {/* Alert type tab switcher (hidden when page-level tab controls the type) */}
        {!lockedType && (
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Alert type">
            {[
              { id: 'intraday', label: 'Intraday' },
              { id: 'swing', label: 'Long-term' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={alertType === t.id}
                onClick={() => switchType(t.id)}
                className={[
                  'rounded-md px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ember/60',
                  alertType === t.id
                    ? 'bg-surface-3 text-flame'
                    : 'text-ink-3 hover:text-ink',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {isSwing && (
        <div className="border-b border-line bg-warn/5 px-4 py-2.5 sm:px-5">
          <p className="text-xs text-warn">
            Long-term alerts watch for price crossings over days or weeks. Checked every 5 min on weekdays during market hours. Only price above/below conditions are supported.
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5">

        {/* Symbol */}
        <label className="block">
          <span className="field-label">Symbol</span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL"
            maxLength={12}
            required
            className="input num"
          />
        </label>

        {/* Condition (hidden for earnings — only one option) */}
        {!isEarnings && (
          <label className="block">
            <span className="field-label">Condition</span>
            <select
              value={condition}
              onChange={(e) => {
                setCondition(e.target.value)
                setThreshold('')
                setBufPct('')
              }}
              className="select"
            >
              {activeConditions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
        )}

        {/* Threshold / Opening range (not shown for earnings) */}
        {!isEarnings && (
          isOrhl ? (
            <label className="block">
              <span className="field-label">Opening range</span>
              <select value={threshold} onChange={(e) => setThreshold(e.target.value)} required className="select">
                <option value="">Select range…</option>
                {ORHL_MINUTES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="field-label">
                Price level {needsPriceThreshold ? '($)' : '(VWAP — auto)'}
              </span>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder={needsPriceThreshold ? 'e.g. 182.50' : 'Calculated automatically'}
                disabled={!needsPriceThreshold}
                min={0}
                step="0.01"
                required={needsPriceThreshold}
                className="input num disabled:opacity-40"
              />
            </label>
          )
        )}

        {/* Cooldown — hidden for earnings (always one-shot) */}
        {!isEarnings && (
          <label className="block">
            <span className="field-label">Cooldown</span>
            <select value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className="select">
              {activeCooldownOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}

        {/* Submit */}
        <div className="flex flex-col justify-end">
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bell className="size-4" aria-hidden />}
            {busy ? 'Adding…' : 'Add alert'}
          </button>
        </div>

        {/* Earnings note */}
        {isEarnings && (
          <div className="sm:col-span-2 lg:col-span-5">
            <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-2">
              You'll be notified once at 8:00 AM ET on the day the company reports earnings. Date is auto-fetched and refreshed daily.
            </p>
          </div>
        )}

        {/* Advanced toggle (intraday only — hidden for swing & earnings) */}
        <div className={['sm:col-span-2 lg:col-span-5', isSwing || isEarnings ? 'hidden' : ''].join(' ')}>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="inline-flex items-center gap-1.5 rounded-md py-1.5 text-xs text-ink-3 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
          >
            <ChevronDown className={['size-3.5 transition-transform duration-200', showAdvanced ? 'rotate-180' : ''].join(' ')} aria-hidden />
            Advanced options
            {advancedBadgeLabels.length > 0 && (
              <span className="chip chip-ember ml-1">
                {advancedBadgeLabels.join(' + ')}
              </span>
            )}
          </button>
        </div>

        {/* Advanced options row (intraday only) */}
        {showAdvanced && !isSwing && !isEarnings && (
          <>
            {/* Volume filter */}
            <div>
              <label className="block">
                <span className="field-label">Volume filter</span>
                <select value={volMult} onChange={(e) => setVolMult(e.target.value)} className="select">
                  {VOLUME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <p className="mt-1.5 text-[11px] text-ink-3">Only fire when last bar's volume exceeds the session average by this multiple.</p>
            </div>

            {/* Time window */}
            <div>
              <label className="block">
                <span className="field-label">Time window</span>
                <select value={timeWin} onChange={(e) => setTimeWin(e.target.value)} className="select">
                  {TIME_WINDOW_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <p className="mt-1.5 text-[11px] text-ink-3">Restrict firing to within N minutes of the 9:30 ET open.</p>
            </div>

            {/* Buffer (price alerts only) */}
            {needsPriceThreshold && (
              <div>
                <label className="block">
                  <span className="field-label">Buffer zone</span>
                  <select value={bufPct} onChange={(e) => setBufPct(e.target.value)} className="select">
                    {BUFFER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <p className="mt-1.5 text-[11px] text-ink-3">Expand the trigger level by ±% to avoid false triggers on thin spikes.</p>
              </div>
            )}
          </>
        )}

        {error ? (
          <p className="text-sm text-down sm:col-span-2 lg:col-span-5">{error}</p>
        ) : null}
      </form>
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Alerts() {
  const { token } = useAuth()
  const { notifications } = useAlerts()
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartSymbol, setChartSymbol] = useState(null)
  const [historyChart, setHistoryChart] = useState(null)
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  const [reactivating, setReactivating] = useState(false)
  const [activeTab, setActiveTab] = useState('intraday')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [editingCooldown, setEditingCooldown] = useState(null) // alertId being edited
  const prevNotifCountRef = useRef(notifications.length)

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30_000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    try {
      const [aRes, hRes] = await Promise.all([
        fetch(apiUrl('/api/alerts'), { headers: authHeaders(token) }),
        fetch(apiUrl('/api/alerts/history'), { headers: authHeaders(token) }),
      ])
      const [aJson, hJson] = await Promise.all([aRes.json(), hRes.json()])
      if (aRes.ok) setAlerts(aJson.alerts ?? [])
      if (hRes.ok) setHistory(hJson.history ?? [])
    } catch {}
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  // When a new WS notification arrives, refresh the history table so fired alerts appear immediately
  useEffect(() => {
    if (notifications.length <= prevNotifCountRef.current) {
      prevNotifCountRef.current = notifications.length
      return
    }
    prevNotifCountRef.current = notifications.length
    fetch(apiUrl('/api/alerts/history'), { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((json) => { if (json.ok) setHistory(json.history ?? []) })
      .catch(() => {})
    // Also refresh alert list so cooldown/status updates appear
    fetch(apiUrl('/api/alerts'), { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((json) => { if (json.ok) setAlerts(json.alerts ?? []) })
      .catch(() => {})
  }, [notifications.length, token])

  const handleCreated = useCallback((alert) => {
    setAlerts((prev) => [alert, ...prev])
  }, [])

  const handleToggle = useCallback(async (alert) => {
    const newActive = !alert.is_active
    setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, is_active: newActive ? 1 : 0 } : a))
    await fetch(apiUrl(`/api/alerts/${alert.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ is_active: newActive }),
    })
  }, [token])

  const handleDelete = useCallback(async (alertId) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    await fetch(apiUrl(`/api/alerts/${alertId}`), { method: 'DELETE', headers: authHeaders(token) })
  }, [token])

  const handleReactivateAll = useCallback(async () => {
    setReactivating(true)
    try {
      const res = await fetch(apiUrl('/api/alerts/reactivate-all'), {
        method: 'POST',
        headers: authHeaders(token),
      })
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => a.is_active === 0 ? { ...a, is_active: 1, last_fired_at: null } : a))
      }
    } catch {}
    setReactivating(false)
  }, [token])

  const handleCooldownChange = useCallback(async (alert, newCooldown) => {
    setEditingCooldown(null)
    setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, cooldown_minutes: newCooldown } : a))
    await fetch(apiUrl(`/api/alerts/${alert.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ cooldown_minutes: newCooldown }),
    })
  }, [token])

  const handleDismissEarningsBadge = useCallback(async (alertId) => {
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, earnings_prev_date: null } : a))
    await fetch(apiUrl(`/api/alerts/${alertId}/dismiss-earnings-badge`), {
      method: 'POST',
      headers: authHeaders(token),
    })
  }, [token])

  const tabAlerts = alerts.filter((a) => {
    if (activeTab === 'swing') return a.alert_type === 'swing'
    if (activeTab === 'earnings') return a.alert_type === 'earnings' || a.condition === 'earnings_report'
    if (activeTab === 'strategy') return a.alert_type === 'strategy'
    return a.alert_type !== 'swing' && a.alert_type !== 'earnings' && a.alert_type !== 'strategy' && a.condition !== 'earnings_report'
  })
  const activeAlerts = tabAlerts.filter((a) => a.is_active === 1)
  const inactiveAlerts = tabAlerts.filter((a) => a.is_active === 0)

  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">Monitoring · Price &amp; event triggers</p>
        <h1 className="display mt-1 text-2xl sm:text-3xl">Alerts</h1>
        <div className="ember-rule mt-4" aria-hidden />
      </header>

      {/* Page-level tab switcher */}
      <div className="rise rise-1 max-w-full overflow-x-auto">
        <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface-1 p-1" role="tablist" aria-label="Alert category">
          {[
            { id: 'intraday', label: 'Intraday' },
            { id: 'swing', label: 'Long-term' },
            { id: 'earnings', label: 'Earnings' },
            { id: 'strategy', label: 'Strategy' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={[
                'rounded-lg px-4 py-2 text-xs font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ember/60',
                activeTab === t.id
                  ? 'bg-surface-3 text-flame'
                  : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'strategy' ? (
        <div className="panel panel-pad rise rise-2 text-sm text-ink-2">
          Strategy alerts are created from the{' '}
          <Link to="/screener" className="rounded font-medium text-ember outline-none transition-colors duration-150 hover:text-flame hover:underline focus-visible:ring-2 focus-visible:ring-ember/60">Screener</Link>
          {' '}— run a strategy scan, then use the{' '}
          <Bell className="inline size-3.5 align-[-2px] text-ink-3" aria-label="bell" />
          {' '}on a result to watch one symbol, or "Watch this screen" to be alerted when any name newly enters.
        </div>
      ) : (
        <div className="rise rise-2">
          <CreateAlertForm token={token} onCreated={handleCreated} lockedType={activeTab} />
        </div>
      )}

      {loading ? (
        <section className="panel panel-pad rise rise-3 space-y-3" aria-busy aria-label="Loading alerts">
          <div className="skeleton h-4 w-48" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-full" />
          ))}
        </section>
      ) : (
        <>
          <div className="rise rise-3">
          <TableShell
            title={`${activeTab === 'swing' ? 'Long-term' : activeTab === 'earnings' ? 'Earnings' : activeTab === 'strategy' ? 'Strategy' : 'Intraday'} alerts (${activeAlerts.length} active, ${inactiveAlerts.length} triggered)`}
            rightSlot={
              inactiveAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={handleReactivateAll}
                  disabled={reactivating}
                  className="btn-ghost h-8 px-3 text-xs"
                >
                  {reactivating ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <RotateCcw className="size-3" aria-hidden />}
                  Re-enable all
                </button>
              )
            }
          >
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Condition</th>
                  <th>Cooldown</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...activeAlerts, ...inactiveAlerts].map((alert) => {
                  const cooling = isCooling(alert, nowSec)
                  const remaining = cooling ? formatCooldownRemaining(alert, nowSec) : null
                  const isEarnings = alert.alert_type === 'earnings' || alert.condition === 'earnings_report'
                  const isStrategy = alert.alert_type === 'strategy'
                  const liveFuse = activeTab === 'intraday' && alert.is_active === 1 && !cooling
                  return (
                    <tr key={alert.id}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="num font-semibold text-ink">{alert.symbol}</span>
                          {liveFuse && (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-ember shadow-[0_0_8px_rgba(255,107,44,0.6)]"
                              title="Watching live"
                              aria-hidden
                            />
                          )}
                        </div>
                        {alert.alert_type === 'swing' && (
                          <span className="chip mt-1">Long-term</span>
                        )}
                        {isEarnings && (
                          <span className="chip mt-1">
                            <CalendarClock className="size-3" aria-hidden />
                            Earnings
                          </span>
                        )}
                        {isStrategy && (
                          <span className="chip chip-ember mt-1">
                            {alert.strategy_params?.scope === 'screen' ? 'Screen' : 'Strategy'}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEarnings ? (
                          <div className="flex flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span>
                                Earnings on <span className="font-medium text-ink">{fmtEarningsDate(alert.earnings_date)}</span>
                                {sessionLabel(alert.earnings_session) && (
                                  <> · <span className="text-ink-3">{sessionLabel(alert.earnings_session)}</span></>
                                )}
                              </span>
                              <EarningsCountdownBadge iso={alert.earnings_date} />
                            </span>
                            {alert.earnings_eps_est != null && (
                              <span className="num text-[11px] text-ink-3">
                                EPS est. ${Number(alert.earnings_eps_est).toFixed(2)}
                              </span>
                            )}
                            {alert.earnings_prev_date && (
                              <span className="chip chip-warn self-start">
                                <AlertCircle className="size-3" aria-hidden />
                                Date updated to {fmtEarningsDate(alert.earnings_date)}
                                <button
                                  type="button"
                                  onClick={() => handleDismissEarningsBadge(alert.id)}
                                  aria-label="Dismiss date-change notice"
                                  title="Dismiss"
                                  className="ml-0.5 rounded p-0.5 text-warn/70 outline-none transition-colors duration-150 hover:bg-warn/15 hover:text-warn focus-visible:ring-2 focus-visible:ring-ember/60"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            )}
                          </div>
                        ) : isStrategy ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-ink">{describeStrategyAlert(alert)}</span>
                            <span className="text-[11px] text-ink-3">
                              within {alert.strategy_params?.threshold ?? alert.threshold}
                              {alert.strategy_params?.intraday ? ' · intraday' : ''} · converging only
                            </span>
                          </div>
                        ) : (
                          <>{conditionLabel(alert.condition, alert.threshold)}</>
                        )}
                        {!isEarnings && (alert.min_volume_mult != null || alert.time_window_minutes != null || alert.buffer_pct != null) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {alert.min_volume_mult != null && (
                              <span className="chip num">≥ {alert.min_volume_mult}× vol</span>
                            )}
                            {alert.time_window_minutes != null && (
                              <span className="chip num">First {alert.time_window_minutes} min</span>
                            )}
                            {alert.buffer_pct != null && (
                              <span className="chip num">{alert.buffer_pct}% buf</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-xs">
                        {isEarnings ? (
                          <span className="text-ink-3">One-shot</span>
                        ) : editingCooldown === alert.id ? (
                          <select
                            autoFocus
                            value={alert.cooldown_minutes ?? 60}
                            onChange={(e) => handleCooldownChange(alert, Number(e.target.value))}
                            onBlur={() => setEditingCooldown(null)}
                            aria-label={`Cooldown for ${alert.symbol}`}
                            className="select h-8 w-auto px-2 text-xs"
                          >
                            {(alert.alert_type === 'swing' ? SWING_COOLDOWN_OPTIONS : COOLDOWN_OPTIONS).map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingCooldown(alert.id)}
                            aria-label={`Edit cooldown for ${alert.symbol}`}
                            title="Click to edit cooldown"
                            className="group -mx-1 flex flex-col items-start gap-0.5 rounded-md px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
                          >
                            <span className="num flex items-center gap-1 text-ink-2 transition-colors duration-150 group-hover:text-ink">
                              {formatCooldownMinutes(alert)}
                              <Pencil className="size-3 opacity-0 transition-opacity duration-150 group-hover:opacity-60" aria-hidden />
                            </span>
                            {remaining && (
                              <span className="num text-[10px] text-warn">resets in {remaining}</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td>
                        {isEarnings
                          ? <EarningsStatusBadge active={alert.is_active === 1} />
                          : <StatusBadge active={alert.is_active === 1} cooling={cooling} />
                        }
                      </td>
                      <td><span className="num text-xs text-ink-3">{fmtTs(alert.created_at)}</span></td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {(alert.condition === 'vwap_above' || alert.condition === 'vwap_below') && (
                            <button
                              type="button"
                              onClick={() => setChartSymbol(alert.symbol)}
                              aria-label={`View price vs VWAP chart for ${alert.symbol}`}
                              title="View price vs VWAP chart"
                              className="rounded-lg p-2 text-ink-3 outline-none transition-colors duration-150 hover:bg-surface-2 hover:text-ember focus-visible:ring-2 focus-visible:ring-ember/60"
                            >
                              <Activity className="size-4" />
                            </button>
                          )}
                          <ToggleSwitch
                            on={alert.is_active === 1}
                            onToggle={() => handleToggle(alert)}
                            label={alert.is_active ? `Disable alert for ${alert.symbol}` : `Re-enable alert for ${alert.symbol}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleDelete(alert.id)}
                            aria-label={`Delete alert for ${alert.symbol}`}
                            title="Delete alert"
                            className="rounded-lg p-2 text-ink-3 outline-none transition-colors duration-150 hover:bg-down/10 hover:text-down focus-visible:ring-2 focus-visible:ring-ember/60"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {tabAlerts.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <Bell className="size-8 text-ink-3" aria-hidden />
                        <p className="text-sm text-ink-3">
                          {activeTab === 'swing'
                            ? 'No long-term alerts yet. Use the form above to create one.'
                            : activeTab === 'earnings'
                              ? 'No earnings alerts yet. Enter a symbol above and we\'ll notify you on its next earnings day.'
                              : 'No intraday alerts yet. Use the form above to create your first alert.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableShell>
          </div>

          {history.length > 0 && (() => {
            const HISTORY_FILTERS = [
              { id: 'all', label: 'All' },
              { id: 'vwap_above', label: 'VWAP cross ↑' },
              { id: 'vwap_below', label: 'VWAP cross ↓' },
              { id: 'price_above', label: 'Price above' },
              { id: 'price_below', label: 'Price below' },
              { id: 'orhl_above', label: 'OR High' },
              { id: 'orhl_below', label: 'OR Low' },
              { id: 'earnings_report', label: 'Earnings' },
            ]
            const earningsSessionByAlertId = new Map(
              alerts.filter((a) => a.condition === 'earnings_report').map((a) => [a.id, a.earnings_session]),
            )
            const filteredHistory = historyFilter === 'all'
              ? history
              : history.filter((h) => h.condition === historyFilter)
            return (
            <div className="rise rise-4">
            <TableShell
              title="Alert history"
              subtitle={`Recently triggered alerts (last 50)${filteredHistory.length !== history.length ? ` · ${filteredHistory.length} shown` : ''}`}
              rightSlot={
                <div className="flex flex-wrap items-center gap-1.5">
                  {HISTORY_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setHistoryFilter(f.id)}
                      aria-pressed={historyFilter === f.id}
                      className={[
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ember/60',
                        historyFilter === f.id
                          ? 'border-ember/30 bg-ember/10 text-flame'
                          : 'border-line bg-surface-2 text-ink-3 hover:text-ink',
                      ].join(' ')}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              }
            >
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Condition</th>
                    <th className="num">Price</th>
                    <th className="num">VWAP</th>
                    <th>Triggered</th>
                    <th className="text-right">Chart</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="py-6 text-center text-sm text-ink-3">
                          No history for this condition type yet.
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredHistory.map((h) => {
                    const isEarningsRow = h.condition === 'earnings_report'
                    const earningsSession = earningsSessionByAlertId.get(h.alert_id)
                    return (
                    <tr key={h.id}>
                      <td><span className="num font-semibold text-ink">{h.symbol}</span></td>
                      <td>
                        {isEarningsRow
                          ? (sessionLabel(earningsSession) ? `Earnings Report (${sessionLabel(earningsSession)})` : 'Earnings Report')
                          : conditionLabel(h.condition, h.threshold)}
                      </td>
                      <td className="num text-ink">
                        {h.triggered_price != null ? `$${Number(h.triggered_price).toFixed(2)}` : '—'}
                      </td>
                      <td className="num text-ink-3">
                        {h.vwap_at_trigger != null ? `$${Number(h.vwap_at_trigger).toFixed(2)}` : '—'}
                      </td>
                      <td><span className="num text-xs text-ink-3">{fmtTs(h.triggered_at)}</span></td>
                      <td className="text-right">
                        {isEarningsRow ? (
                          <span className="text-ink-3">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setHistoryChart({ symbol: h.symbol, triggeredAt: h.triggered_at })}
                            aria-label={`View trigger context chart for ${h.symbol}`}
                            title="View trigger context chart"
                            className="rounded-lg p-2 text-ink-3 outline-none transition-colors duration-150 hover:bg-surface-2 hover:text-ember focus-visible:ring-2 focus-visible:ring-ember/60"
                          >
                            <BarChart2 className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableShell>
            </div>
          )
          })()}
        </>
      )}

      {chartSymbol && (
        <VwapMiniChart
          symbol={chartSymbol}
          token={token}
          onClose={() => setChartSymbol(null)}
        />
      )}

      {historyChart && (
        <HistoryChart
          symbol={historyChart.symbol}
          triggeredAt={historyChart.triggeredAt}
          token={token}
          onClose={() => setHistoryChart(null)}
        />
      )}
    </div>
  )
}
