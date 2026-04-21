import { Bell, BellOff, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

const COOLDOWN_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 0, label: 'One-shot (no repeat)' },
]

const ORHL_MINUTES = [
  { value: 15, label: '15-minute range' },
  { value: 30, label: '30-minute range' },
  { value: 60, label: '60-minute range' },
]

function conditionLabel(condition, threshold) {
  switch (condition) {
    case 'vwap_above': return 'Crosses above VWAP'
    case 'vwap_below': return 'Crosses below VWAP'
    case 'price_above': return `Above $${Number(threshold).toFixed(2)}`
    case 'price_below': return `Below $${Number(threshold).toFixed(2)}`
    case 'orhl_above': return `Crosses above OR High (${threshold}min)`
    case 'orhl_below': return `Crosses below OR Low (${threshold}min)`
    default: return condition
  }
}

function fmtTs(unixSec) {
  if (!unixSec) return '—'
  return new Date(unixSec * 1000).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ active }) {
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

// ── Create Alert Form ─────────────────────────────────────────────────────────

function CreateAlertForm({ token, onCreated }) {
  const [symbol, setSymbol] = useState('')
  const [condition, setCondition] = useState('vwap_above')
  const [threshold, setThreshold] = useState('')
  const [cooldown, setCooldown] = useState(60)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const needsPriceThreshold = condition === 'price_above' || condition === 'price_below'
  const isOrhl = condition === 'orhl_above' || condition === 'orhl_below'

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = {
        symbol,
        condition,
        cooldown_minutes: cooldown,
        threshold: needsPriceThreshold ? Number(threshold) : isOrhl ? Number(threshold) : undefined,
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
      onCreated(json.alert)
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }, [symbol, condition, threshold, cooldown, needsPriceThreshold, isOrhl, token, onCreated])

  return (
    <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3.5">
        <Plus className="size-4 text-zinc-400" />
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Create alert</h2>
      </div>
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

        {/* Condition */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Condition</span>
          <select
            value={condition}
            onChange={(e) => { setCondition(e.target.value); setThreshold('') }}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 focus:border-accent/35 focus:ring-2"
          >
            {CONDITIONS.map((c) => (
              <option key={c.id} value={c.id} className="bg-neutral-900">{c.label}</option>
            ))}
          </select>
        </div>

        {/* Threshold / Opening range */}
        <div className="flex flex-col gap-1.5">
          {isOrhl ? (
            <>
              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Opening range</span>
              <select
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                required
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 focus:border-accent/35 focus:ring-2"
              >
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

        {/* Cooldown */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Cooldown</span>
          <select
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 focus:border-accent/35 focus:ring-2"
          >
            {COOLDOWN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-neutral-900">{o.label}</option>
            ))}
          </select>
        </div>

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

        {error ? (
          <p className="sm:col-span-2 lg:col-span-5 text-sm text-rose-400">{error}</p>
        ) : null}
      </form>
    </section>
  )
}

// ── Notification Settings ─────────────────────────────────────────────────────

function NotificationSettings({ token }) {
  const { notifPermission, requestPermission } = useAlerts()
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [alertEmail, setAlertEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/api/notifications/settings'), { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setEmailEnabled(j.settings.email_alerts_enabled)
          setAlertEmail(j.settings.alert_email ?? '')
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [token])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSavedMsg(null)
    try {
      const res = await fetch(apiUrl('/api/notifications/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ email_alerts_enabled: emailEnabled, alert_email: alertEmail }),
      })
      if (res.ok) {
        setSavedMsg('Settings saved.')
        setTimeout(() => setSavedMsg(null), 2500)
      }
    } catch {}
    setSaving(false)
  }, [emailEnabled, alertEmail, token])

  const permissionLabel = {
    granted: 'Enabled',
    denied: 'Blocked by browser',
    default: 'Not yet requested',
    unsupported: 'Not supported in this browser',
  }[notifPermission] ?? notifPermission

  return (
    <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2 border-b border-border-subtle px-5 py-3.5">
        <Bell className="size-4 text-zinc-400" />
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Notification settings</h2>
      </div>
      <div className="space-y-5 p-5">
        {/* Browser / OS notifications */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-200">Desktop notifications</p>
            <p className="mt-0.5 text-xs text-zinc-500">Native OS banners even when the tab is in the background. Status: <span className="text-zinc-300">{permissionLabel}</span></p>
          </div>
          {notifPermission === 'default' && (
            <button
              type="button"
              onClick={requestPermission}
              className="shrink-0 rounded-xl border border-accent/30 bg-accent-muted px-4 py-2 text-xs font-semibold text-accent transition hover:brightness-110"
            >
              Enable notifications
            </button>
          )}
          {notifPermission === 'denied' && (
            <span className="shrink-0 rounded-xl border border-rose-500/20 px-3 py-1.5 text-xs text-rose-400">
              Unblock in browser settings
            </span>
          )}
          {notifPermission === 'granted' && (
            <span className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400">
              Enabled
            </span>
          )}
        </div>

        <div className="h-px bg-white/[0.06]" />

        {/* Email alerts */}
        {!loaded ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" />Loading…</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">Email alerts</p>
                <p className="mt-0.5 text-xs text-zinc-500">Sends an email when an alert fires and you have no active browser tab.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailEnabled}
                onClick={() => setEmailEnabled((v) => !v)}
                className={[
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  emailEnabled ? 'bg-accent' : 'bg-white/10',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block size-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
                    emailEnabled ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>
            {emailEnabled && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Alert email address</span>
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="max-w-sm rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none ring-accent/25 placeholder:text-zinc-600 focus:border-accent/35 focus:ring-2"
                />
              </div>
            )}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {savedMsg && <span className="text-xs text-emerald-400">{savedMsg}</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Alerts() {
  const { token } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

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

  const activeAlerts = alerts.filter((a) => a.is_active === 1)
  const inactiveAlerts = alerts.filter((a) => a.is_active === 0)

  return (
    <div className="app-page-enter space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Alerts</h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Set strategy conditions on any symbol. The engine checks every minute during market hours and notifies you in-app.
        </p>
      </header>

      <CreateAlertForm token={token} onCreated={handleCreated} />

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" />Loading…
        </div>
      ) : (
        <>
          <TableShell
            title={`Alerts (${activeAlerts.length} active, ${inactiveAlerts.length} triggered)`}
            subtitle="Checked every minute during market hours (9:30–16:00 ET). Active alerts re-fire after the cooldown period."
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
                {[...activeAlerts, ...inactiveAlerts].map((alert) => (
                  <tr key={alert.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-zinc-100">{alert.symbol}</td>
                    <td className="px-4 py-3 text-zinc-300">{conditionLabel(alert.condition, alert.threshold)}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {alert.cooldown_minutes === 0 ? 'One-shot' : `${alert.cooldown_minutes}min`}
                    </td>
                    <td className="px-4 py-3"><StatusBadge active={alert.is_active === 1} /></td>
                    <td className="px-4 py-3 text-zinc-500">{fmtTs(alert.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
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
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-zinc-500" colSpan={6}>
                      No alerts yet. Use the form above to create your first alert.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableShell>

          {history.length > 0 && (
            <TableShell title="Alert history" subtitle="Recently triggered alerts (last 50)">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface-1/80 text-[11px] uppercase tracking-wide text-zinc-500 backdrop-blur">
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-2.5 font-medium">Symbol</th>
                    <th className="px-4 py-2.5 font-medium">Condition</th>
                    <th className="px-4 py-2.5 text-right font-medium">Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">VWAP</th>
                    <th className="px-4 py-2.5 font-medium">Triggered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/70">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-zinc-100">{h.symbol}</td>
                      <td className="px-4 py-3 text-zinc-300">{conditionLabel(h.condition, h.threshold)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                        {h.triggered_price != null ? `$${Number(h.triggered_price).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                        {h.vwap_at_trigger != null ? `$${Number(h.vwap_at_trigger).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{fmtTs(h.triggered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </>
      )}

      <NotificationSettings token={token} />
    </div>
  )
}
