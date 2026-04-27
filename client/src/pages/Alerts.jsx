import { Activity, AlertCircle, BarChart2, Bell, BellOff, CalendarClock, ChevronDown, Loader2, Plus, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
    days < 0 ? 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/20'
    : days === 0 ? 'bg-rose-500/15 text-rose-300 ring-rose-500/25'
    : days <= 3 ? 'bg-amber-500/15 text-amber-300 ring-amber-500/25'
    : days <= 7 ? 'bg-teal-500/15 text-teal-300 ring-teal-500/25'
    : 'bg-zinc-500/10 text-zinc-300 ring-zinc-500/20'
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${tone}`}>
      {label}
    </span>
  )
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
    default: return condition
  }
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
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-amber-500/10 text-amber-300 ring-amber-500/25">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Cooling
      </span>
    )
  }
  return (
    <span className={[
      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
      active
        ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25'
        : 'bg-zinc-500/10 text-zinc-500 ring-zinc-500/20',
    ].join(' ')}>
      <span className={['size-1.5 rounded-full', active ? 'bg-emerald-400' : 'bg-zinc-600'].join(' ')} />
      {active ? 'Active' : 'Triggered'}
    </span>
  )
}

function EarningsStatusBadge({ active }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-teal-500/10 text-teal-300 ring-teal-500/25">
        <span className="size-1.5 rounded-full bg-teal-400" />
        Watching
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-zinc-500/10 text-zinc-400 ring-zinc-500/20">
      <span className="size-1.5 rounded-full bg-zinc-500" />
      Triggered
    </span>
  )
}

// ── Shared chart panel (used by both VWAP and History popups) ─────────────────

function MiniChartPanel({ bars, loading, error, emptyMsg = 'No intraday data yet.' }) {
  const fmtTime = (str) => str?.split(' ')[1]?.slice(0, 5) ?? str
  const priceColor = '#e4e4e7'
  const vwapColor = '#00ff88'

  const yDomain = bars && bars.length > 0
    ? (() => {
        const vals = bars.flatMap((b) => [b.price, b.vwap].filter((v) => v != null))
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        const pad = (max - min) * 0.2 || 0.5
        return [min - pad, max + pad]
      })()
    : ['auto', 'auto']

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="size-5 animate-spin text-zinc-500" /></div>
  if (error) return <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-rose-400">{error}</div>
  if (!bars || bars.length === 0) return <div className="flex h-64 items-center justify-center text-sm text-zinc-500">{emptyMsg}</div>

  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={bars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={yDomain} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
          <Tooltip
            contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#e4e4e7' }}
            labelFormatter={fmtTime}
            formatter={(val, key) => [`$${Number(val).toFixed(2)}`, key === 'price' ? 'Price' : 'VWAP']}
          />
          <Line type="monotone" dataKey="price" stroke={priceColor} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: priceColor, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="vwap" stroke={vwapColor} strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 3, fill: vwapColor, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-5">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="inline-block h-px w-5 rounded" style={{ background: priceColor }} /> Price
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[720px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{title}</p>
            <p className="text-xs text-zinc-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-1">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh chart"
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
              >
                <RefreshCw className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
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

  const selectCls = 'rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 focus:border-accent/35 focus:ring-2'

  const advancedBadgeLabels = [
    volMult !== '' && 'vol',
    timeWin !== '' && 'time',
    needsPriceThreshold && bufPct !== '' && 'buf',
  ].filter(Boolean)

  return (
    <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Create alert</h2>
        </div>
        {/* Alert type tab switcher (hidden when page-level tab controls the type) */}
        {!lockedType && (
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
            {[
              { id: 'intraday', label: 'Intraday' },
              { id: 'swing', label: 'Long-term' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchType(t.id)}
                className={[
                  'rounded-md px-3 py-1 text-xs font-medium transition',
                  alertType === t.id
                    ? 'bg-accent text-zinc-950 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {isSwing && (
        <div className="border-b border-amber-500/15 bg-amber-500/5 px-5 py-2.5">
          <p className="text-[11px] text-amber-300/80">
            Long-term alerts watch for price crossings over days or weeks. Checked every 5 min on weekdays including extended hours. Only price above/below conditions are supported.
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">

        {/* Symbol */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Symbol</span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL"
            maxLength={12}
            required
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 placeholder:text-zinc-600 focus:border-accent/35 focus:ring-2"
          />
        </div>

        {/* Condition (hidden for earnings — only one option) */}
        {!isEarnings && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Condition</span>
            <select
              value={condition}
              onChange={(e) => {
                setCondition(e.target.value)
                setThreshold('')
                setBufPct('')
              }}
              className={selectCls}
            >
              {activeConditions.map((c) => (
                <option key={c.id} value={c.id} className="bg-neutral-900">{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Threshold / Opening range (not shown for earnings) */}
        {!isEarnings && (
        <div className="flex flex-col gap-1.5">
          {isOrhl ? (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Opening range</span>
              <select value={threshold} onChange={(e) => setThreshold(e.target.value)} required className={selectCls}>
                <option value="" className="bg-neutral-900">Select range…</option>
                {ORHL_MINUTES.map((o) => (
                  <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
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
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 placeholder:text-zinc-600 focus:border-accent/35 focus:ring-2 disabled:opacity-40"
              />
            </>
          )}
        </div>
        )}

        {/* Cooldown — hidden for earnings (always one-shot) */}
        {!isEarnings && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Cooldown</span>
            <select value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className={selectCls}>
              {activeCooldownOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col justify-end gap-1.5">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            {busy ? 'Adding…' : 'Add alert'}
          </button>
        </div>

        {/* Earnings note */}
        {isEarnings && (
          <div className="sm:col-span-2 lg:col-span-5">
            <p className="rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2 text-[11px] text-teal-300/90">
              You'll be notified once at 8:00 AM ET on the day the company reports earnings. Date is auto-fetched and refreshed daily.
            </p>
          </div>
        )}

        {/* Advanced toggle (intraday only — hidden for swing & earnings) */}
        <div className={['sm:col-span-2 lg:col-span-5', isSwing || isEarnings ? 'hidden' : ''].join(' ')}>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <ChevronDown className={['size-3.5 transition-transform duration-200', showAdvanced ? 'rotate-180' : ''].join(' ')} />
            Advanced options
            {advancedBadgeLabels.length > 0 && (
              <span className="ml-1 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                {advancedBadgeLabels.join(' + ')}
              </span>
            )}
          </button>
        </div>

        {/* Advanced options row (intraday only) */}
        {showAdvanced && !isSwing && !isEarnings && (
          <>
            {/* Volume filter */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Volume filter</span>
              <select value={volMult} onChange={(e) => setVolMult(e.target.value)} className={selectCls}>
                {VOLUME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-600">Only fire when last bar's volume exceeds the session average by this multiple.</p>
            </div>

            {/* Time window */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Time window</span>
              <select value={timeWin} onChange={(e) => setTimeWin(e.target.value)} className={selectCls}>
                {TIME_WINDOW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-600">Restrict firing to within N minutes of the 9:30 ET open.</p>
            </div>

            {/* Buffer (price alerts only) */}
            {needsPriceThreshold && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Buffer zone</span>
                <select value={bufPct} onChange={(e) => setBufPct(e.target.value)} className={selectCls}>
                  {BUFFER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-600">Expand the trigger level by ±% to avoid false triggers on thin spikes.</p>
              </div>
            )}
          </>
        )}

        {error ? (
          <p className="sm:col-span-2 lg:col-span-5 text-sm text-rose-400">{error}</p>
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
    return a.alert_type !== 'swing' && a.alert_type !== 'earnings' && a.condition !== 'earnings_report'
  })
  const activeAlerts = tabAlerts.filter((a) => a.is_active === 1)
  const inactiveAlerts = tabAlerts.filter((a) => a.is_active === 0)

  return (
    <div className="app-page-enter space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Alerts</h1>
      </header>

      {/* Page-level tab switcher */}
      <div className="flex items-center gap-2 self-start rounded-xl border border-border-subtle bg-surface-1/40 p-2">
        {[
          { id: 'intraday', label: 'Intraday' },
          { id: 'swing', label: 'Long-term' },
          { id: 'earnings', label: 'Earnings' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={[
              'rounded-lg px-4 py-2 text-xs font-medium transition',
              activeTab === t.id
                ? 'bg-accent-muted text-accent shadow-[inset_0_0_0_1px_oklch(0.72_0.17_165/0.25)]'
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CreateAlertForm token={token} onCreated={handleCreated} lockedType={activeTab} />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" />Loading…
        </div>
      ) : (
        <>
          <TableShell
            title={`${activeTab === 'swing' ? 'Long-term' : activeTab === 'earnings' ? 'Earnings' : 'Intraday'} alerts (${activeAlerts.length} active, ${inactiveAlerts.length} triggered)`}
            rightSlot={
              inactiveAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={handleReactivateAll}
                  disabled={reactivating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-200 disabled:opacity-50"
                >
                  {reactivating ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                  Re-enable all
                </button>
              )
            }
          >
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-1/80 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-2.5 font-medium">Symbol</th>
                  <th className="px-4 py-2.5 font-medium">Condition</th>
                  <th className="px-4 py-2.5 font-medium">Cooldown</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/70">
                {[...activeAlerts, ...inactiveAlerts].map((alert) => {
                  const cooling = isCooling(alert, nowSec)
                  const remaining = cooling ? formatCooldownRemaining(alert, nowSec) : null
                  const isEarnings = alert.alert_type === 'earnings' || alert.condition === 'earnings_report'
                  return (
                    <tr key={alert.id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-100">{alert.symbol}</div>
                        {alert.alert_type === 'swing' && (
                          <span className="mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20">
                            Long-term
                          </span>
                        )}
                        {isEarnings && (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/20">
                            <CalendarClock className="size-3" />
                            Earnings
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {isEarnings ? (
                          <div className="flex flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span>
                                Earnings on <span className="font-medium text-zinc-100">{fmtEarningsDate(alert.earnings_date)}</span>
                                {sessionLabel(alert.earnings_session) && (
                                  <> · <span className="text-zinc-400">{sessionLabel(alert.earnings_session)}</span></>
                                )}
                              </span>
                              <EarningsCountdownBadge iso={alert.earnings_date} />
                            </span>
                            {alert.earnings_eps_est != null && (
                              <span className="text-[11px] text-zinc-500">
                                EPS est. ${Number(alert.earnings_eps_est).toFixed(2)}
                              </span>
                            )}
                            {alert.earnings_prev_date && (
                              <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/25">
                                <AlertCircle className="size-3" />
                                Date updated to {fmtEarningsDate(alert.earnings_date)}
                                <button
                                  type="button"
                                  onClick={() => handleDismissEarningsBadge(alert.id)}
                                  title="Dismiss"
                                  className="ml-1 rounded p-0.5 text-amber-300/70 transition hover:bg-amber-500/15 hover:text-amber-200"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            )}
                          </div>
                        ) : (
                          <>{conditionLabel(alert.condition, alert.threshold)}</>
                        )}
                        {!isEarnings && (alert.min_volume_mult != null || alert.time_window_minutes != null || alert.buffer_pct != null) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {alert.min_volume_mult != null && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 ring-1 ring-white/5">
                                ≥ {alert.min_volume_mult}× vol
                              </span>
                            )}
                            {alert.time_window_minutes != null && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 ring-1 ring-white/5">
                                First {alert.time_window_minutes} min
                              </span>
                            )}
                            {alert.buffer_pct != null && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 ring-1 ring-white/5">
                                {alert.buffer_pct}% buf
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isEarnings ? (
                          <span className="text-zinc-500">One-shot</span>
                        ) : editingCooldown === alert.id ? (
                          <select
                            autoFocus
                            value={alert.cooldown_minutes ?? 60}
                            onChange={(e) => handleCooldownChange(alert, Number(e.target.value))}
                            onBlur={() => setEditingCooldown(null)}
                            className="rounded-lg border border-accent/40 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-accent/70"
                          >
                            {(alert.alert_type === 'swing' ? SWING_COOLDOWN_OPTIONS : COOLDOWN_OPTIONS).map((o) => (
                              <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingCooldown(alert.id)}
                            title="Click to edit cooldown"
                            className="group flex flex-col items-start gap-0.5 text-left"
                          >
                            <span className="flex items-center gap-1 text-zinc-400 group-hover:text-zinc-100">
                              {formatCooldownMinutes(alert)}
                              <svg className="size-3 opacity-0 transition group-hover:opacity-60" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M11 2l3 3-9 9H2v-3L11 2z" />
                              </svg>
                            </span>
                            {remaining && (
                              <span className="text-[10px] text-amber-400/80">resets in {remaining}</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEarnings
                          ? <EarningsStatusBadge active={alert.is_active === 1} />
                          : <StatusBadge active={alert.is_active === 1} cooling={cooling} />
                        }
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{fmtTs(alert.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {(alert.condition === 'vwap_above' || alert.condition === 'vwap_below') && (
                            <button
                              type="button"
                              onClick={() => setChartSymbol(alert.symbol)}
                              title="View price vs VWAP chart"
                              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-accent"
                            >
                              <Activity className="size-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggle(alert)}
                            title={alert.is_active ? 'Disable alert' : 'Re-enable alert'}
                            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                          >
                            {alert.is_active ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(alert.id)}
                            title="Delete alert"
                            className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {tabAlerts.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-zinc-500" colSpan={6}>
                      {activeTab === 'swing'
                        ? 'No long-term alerts yet. Use the form above to create one.'
                        : activeTab === 'earnings'
                          ? 'No earnings alerts yet. Enter a symbol above and we\'ll notify you on its next earnings day.'
                          : 'No intraday alerts yet. Use the form above to create your first alert.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableShell>

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
            <TableShell
              title="Alert history"
              subtitle={`Recently triggered alerts (last 50)${filteredHistory.length !== history.length ? ` · ${filteredHistory.length} shown` : ''}`}
              rightSlot={
                <div className="flex flex-wrap items-center gap-1">
                  {HISTORY_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setHistoryFilter(f.id)}
                      className={[
                        'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                        historyFilter === f.id
                          ? 'bg-accent-muted text-accent shadow-[inset_0_0_0_1px_oklch(0.72_0.17_165/0.25)]'
                          : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
                      ].join(' ')}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              }
            >
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface-1/80 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-2.5 font-medium">Symbol</th>
                    <th className="px-4 py-2.5 font-medium">Condition</th>
                    <th className="px-4 py-2.5 text-right font-medium">Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">VWAP</th>
                    <th className="px-4 py-2.5 font-medium">Triggered</th>
                    <th className="px-4 py-2.5 text-right font-medium">Chart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/70">
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={6}>
                        No history for this condition type yet.
                      </td>
                    </tr>
                  )}
                  {filteredHistory.map((h) => {
                    const isEarningsRow = h.condition === 'earnings_report'
                    const earningsSession = earningsSessionByAlertId.get(h.alert_id)
                    return (
                    <tr key={h.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-zinc-100">{h.symbol}</td>
                      <td className="px-4 py-3 text-zinc-300">
                        {isEarningsRow
                          ? (sessionLabel(earningsSession) ? `Earnings Report (${sessionLabel(earningsSession)})` : 'Earnings Report')
                          : conditionLabel(h.condition, h.threshold)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                        {h.triggered_price != null ? `$${Number(h.triggered_price).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                        {h.vwap_at_trigger != null ? `$${Number(h.vwap_at_trigger).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{fmtTs(h.triggered_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {isEarningsRow ? (
                          <span className="text-zinc-700">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setHistoryChart({ symbol: h.symbol, triggeredAt: h.triggered_at })}
                            title="View trigger context chart"
                            className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-white/5 hover:text-accent"
                          >
                            <BarChart2 className="size-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableShell>
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
