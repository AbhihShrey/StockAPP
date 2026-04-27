import {
  AlertCircle,
  Bell,
  Check,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Moon,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash2,
  User,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'
import { getChartStyle, getDefaultLanding, getLocale, getQuietHours, saveChartStyle, saveDefaultLanding, saveLocale, saveQuietHours } from '../lib/prefs'
import { getDensity, getTheme, saveDensity, saveTheme } from '../lib/theme'

// ── Helpers ───────────────────────────────────────────────────────────────────

const LANDING_PAGES = [
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/markets', label: 'Markets' },
  { value: '/watchlist', label: 'Watchlist' },
  { value: '/portfolio', label: 'Portfolio' },
  { value: '/charts', label: 'Charts' },
  { value: '/sectors', label: 'Sectors' },
  { value: '/alerts', label: 'Alerts' },
  { value: '/news', label: 'News' },
  ...(import.meta.env.VITE_FEATURE_BACKTEST === '1'
    ? [{ value: '/strategies', label: 'Strategies' }]
    : []),
]


// ── Section shell ─────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2.5 border-b border-border-subtle px-5 py-3.5">
        <Icon className="size-4 text-zinc-400" />
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h2>
        {description && <span className="ml-auto text-xs text-zinc-600">{description}</span>}
      </div>
      <div className="divide-y divide-border-subtle/50 p-5">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-zinc-200">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SavedBadge() {
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <Check className="size-3.5" /> Saved
    </span>
  )
}

function ErrorBadge({ message = 'Save failed' }) {
  return (
    <span className="flex items-center gap-1 text-xs text-rose-400" title={message}>
      <AlertCircle className="size-3.5" /> {message}
    </span>
  )
}

// ── Change Password form ──────────────────────────────────────────────────────

function ChangePasswordForm({ token }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const reset = () => {
    setCurrent(''); setNext(''); setConfirm('')
    setError(null); setSuccess(false); setShowCurrent(false); setShowNext(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('New password must be at least 8 characters.')
    if (next !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/auth/password'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!data.ok) return setError(data.message ?? 'Failed to update password.')
      setSuccess(true)
      reset()
      setTimeout(() => { setOpen(false); setSuccess(false) }, 1800)
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { reset(); setOpen(true) }}
        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100"
      >
        Change password
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 w-full space-y-3">
      {[
        { label: 'Current password', value: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent((v) => !v) },
        { label: 'New password', value: next, set: setNext, show: showNext, toggle: () => setShowNext((v) => !v) },
        { label: 'Confirm new password', value: confirm, set: setConfirm, show: showNext, toggle: null },
      ].map(({ label, value, set, show, toggle }) => (
        <div key={label} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(e) => set(e.target.value)}
              required
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 pr-9 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/[0.06] transition"
            />
            {toggle && (
              <button
                type="button"
                onClick={toggle}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {success && <p className="flex items-center gap-1 text-xs text-emerald-400"><Check className="size-3.5" /> Password updated successfully.</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
          {busy ? 'Saving…' : 'Update password'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); reset() }}
          className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-zinc-500 transition hover:border-white/15 hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Default landing page selector ─────────────────────────────────────────────

function LandingPagePicker() {
  const [value, setValue] = useState(getDefaultLanding)
  const [saved, setSaved] = useState(false)

  const handleChange = (e) => {
    setValue(e.target.value)
    saveDefaultLanding(e.target.value)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={value}
        onChange={handleChange}
        className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/20 transition"
      >
        {LANDING_PAGES.map((p) => (
          <option key={p.value} value={p.value} className="bg-neutral-900">{p.label}</option>
        ))}
      </select>
      {saved && <SavedBadge />}
    </div>
  )
}

// ── Theme picker ──────────────────────────────────────────────────────────────

const THEMES = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: null },
]

function ThemePicker() {
  const [value, setValue] = useState(getTheme)
  const [saved, setSaved] = useState(false)

  const handleChange = (t) => {
    setValue(t)
    saveTheme(t)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 gap-1">
        {THEMES.map(({ value: t, label, icon: Icon }) => (
          <button
            key={t}
            type="button"
            onClick={() => handleChange(t)}
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
              value === t
                ? 'bg-accent text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
            ].join(' ')}
          >
            {Icon && <Icon className="size-3.5" />}
            {label}
          </button>
        ))}
      </div>
      {saved && <SavedBadge />}
    </div>
  )
}

// ── Table density picker ───────────────────────────────────────────────────────

const DENSITIES = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'comfortable', label: 'Comfortable' },
]

function DensityPicker() {
  const [value, setValue] = useState(getDensity)
  const [saved, setSaved] = useState(false)

  const handleChange = (d) => {
    setValue(d)
    saveDensity(d)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 gap-1">
        {DENSITIES.map(({ value: d, label }) => (
          <button
            key={d}
            type="button"
            onClick={() => handleChange(d)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition',
              value === d
                ? 'bg-accent text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
      {saved && <SavedBadge />}
    </div>
  )
}

// ── Number locale picker ──────────────────────────────────────────────────────

const LOCALES = [
  { value: 'en-US', label: 'US (1,234.56)' },
  { value: 'de-DE', label: 'European (1.234,56)' },
]

function LocalePicker() {
  const [value, setValue] = useState(getLocale)
  const [saved, setSaved] = useState(false)
  const handleChange = (l) => {
    setValue(l)
    saveLocale(l)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 gap-1">
        {LOCALES.map(({ value: l, label }) => (
          <button key={l} type="button" onClick={() => handleChange(l)}
            className={['rounded-lg px-3 py-1.5 text-xs font-medium transition',
              value === l ? 'bg-accent text-zinc-950 shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'].join(' ')}>
            {label}
          </button>
        ))}
      </div>
      {saved && <SavedBadge />}
    </div>
  )
}

// ── Chart style picker ────────────────────────────────────────────────────────

const CHART_STYLES = [
  { value: 'area', label: 'Area' },
  { value: 'line', label: 'Line' },
]

function ChartStylePicker() {
  const [value, setValue] = useState(getChartStyle)
  const [saved, setSaved] = useState(false)
  const handleChange = (s) => {
    setValue(s)
    saveChartStyle(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 gap-1">
        {CHART_STYLES.map(({ value: s, label }) => (
          <button key={s} type="button" onClick={() => handleChange(s)}
            className={['rounded-lg px-3 py-1.5 text-xs font-medium transition',
              value === s ? 'bg-accent text-zinc-950 shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'].join(' ')}>
            {label}
          </button>
        ))}
      </div>
      {saved && <SavedBadge />}
    </div>
  )
}

// ── Quiet hours picker ────────────────────────────────────────────────────────

function QuietHoursPicker() {
  const [prefs, setPrefs] = useState(getQuietHours)
  const [saved, setSaved] = useState(false)
  const update = (changes) => {
    const next = { ...prefs, ...changes }
    setPrefs(next)
    saveQuietHours(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => update({ enabled: !prefs.enabled })}
          className={['relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
            prefs.enabled ? 'bg-accent' : 'bg-zinc-700'].join(' ')}
          role="switch" aria-checked={prefs.enabled}>
          <span className={['inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200',
            prefs.enabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
        </button>
        <span className="text-xs text-zinc-500">{prefs.enabled ? 'On' : 'Off'}</span>
        {saved && <SavedBadge />}
      </div>
      {prefs.enabled && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>From</span>
          <input type="time" value={prefs.start} onChange={(e) => update({ start: e.target.value })}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-white/20 transition" />
          <span>to</span>
          <input type="time" value={prefs.end} onChange={(e) => update({ end: e.target.value })}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-white/20 transition" />
          <span className="text-zinc-600">ET</span>
        </div>
      )}
    </div>
  )
}

// ── Email notification settings ──────────────────────────────────────────────

function EmailNotificationSettings({ token, userEmail }) {
  const [settings, setSettings] = useState(null)
  const [alertEmail, setAlertEmail] = useState('')
  const [saving, setSaving] = useState(null)
  const [saved, setSaved] = useState(null)
  const [errorKey, setErrorKey] = useState(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    fetch(apiUrl('/api/user/settings'), { headers: authHeaders(token) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        if (cancelled) return
        if (d.ok) {
          setSettings(d.settings)
          setAlertEmail(d.settings.alert_email ?? '')
        } else {
          setLoadError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const patch = useCallback(async (body) => {
    const key = Object.keys(body)[0]
    setSaving(key)
    setErrorKey((v) => (v === key ? null : v))
    try {
      const r = await fetch(apiUrl('/api/user/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.ok) {
        setSettings(d.settings)
        setSaved(key)
        setTimeout(() => setSaved((v) => (v === key ? null : v)), 2000)
      } else {
        setErrorKey(key)
        setTimeout(() => setErrorKey((v) => (v === key ? null : v)), 4000)
      }
    } catch {
      setErrorKey(key)
      setTimeout(() => setErrorKey((v) => (v === key ? null : v)), 4000)
    } finally {
      setSaving(null)
    }
  }, [token])

  const saveEmail = useCallback(async () => {
    await patch({ alert_email: alertEmail.trim() || null })
  }, [patch, alertEmail])


  if (loadError) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-rose-400">
        <AlertCircle className="size-3.5" /> Couldn't load email settings — try refreshing the page.
      </p>
    )
  }

  if (!settings) return <div className="h-8 animate-pulse rounded-lg bg-white/[0.04]" />

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-zinc-200">Alert fire emails</p>
          <p className="mt-0.5 text-xs text-zinc-500">Receive an email each time a price alert triggers</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => patch({ email_alerts_enabled: !settings.email_alerts_enabled })}
            disabled={saving === 'email_alerts_enabled'}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60',
              settings.email_alerts_enabled ? 'bg-accent' : 'bg-zinc-700',
            ].join(' ')}
            role="switch"
            aria-checked={settings.email_alerts_enabled}
          >
            <span className={['inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200', settings.email_alerts_enabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
          </button>
          <span className="text-xs text-zinc-500">{settings.email_alerts_enabled ? 'On' : 'Off'}</span>
          {saved === 'email_alerts_enabled' && <SavedBadge />}
          {errorKey === 'email_alerts_enabled' && <ErrorBadge />}
        </div>
      </div>

      <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-zinc-200">Daily close digest</p>
          <p className="mt-0.5 text-xs text-zinc-500">End-of-day market summary with watchlist movers and alerts — sent at 4:30 PM ET</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => patch({ email_digest_enabled: !settings.email_digest_enabled })}
            disabled={saving === 'email_digest_enabled'}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60',
              settings.email_digest_enabled ? 'bg-accent' : 'bg-zinc-700',
            ].join(' ')}
            role="switch"
            aria-checked={settings.email_digest_enabled}
          >
            <span className={['inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200', settings.email_digest_enabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
          </button>
          <span className="text-xs text-zinc-500">{settings.email_digest_enabled ? 'On' : 'Off'}</span>
          {saved === 'email_digest_enabled' && <SavedBadge />}
          {errorKey === 'email_digest_enabled' && <ErrorBadge />}
        </div>
      </div>

      {(settings.email_alerts_enabled || settings.email_digest_enabled) && (
        <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-zinc-200">Delivery email</p>
            <p className="mt-0.5 text-xs text-zinc-500">Leave blank to use your account email ({userEmail})</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              placeholder={userEmail}
              className="w-52 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/20 transition"
            />
            <button
              type="button"
              onClick={saveEmail}
              disabled={saving === 'alert_email'}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100 disabled:opacity-50"
            >
              Save
            </button>
            {saved === 'alert_email' && <SavedBadge />}
            {errorKey === 'alert_email' && <ErrorBadge />}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Extended hours toggle ─────────────────────────────────────────────────────

function ExtendedHoursToggle({ token }) {
  const [enabled, setEnabled] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    fetch(apiUrl('/api/user/settings'), { headers: authHeaders(token) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        if (cancelled) return
        if (d.ok) setEnabled(Boolean(d.settings.extended_hours_enabled))
        else setLoadError(true)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const toggle = async () => {
    if (enabled === null) return
    const next = !enabled
    setSaving(true)
    setError(false)
    try {
      const r = await fetch(apiUrl('/api/user/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ extended_hours_enabled: next }),
      })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.ok) {
        setEnabled(Boolean(d.settings.extended_hours_enabled))
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
      } else {
        setError(true)
        setTimeout(() => setError(false), 4000)
      }
    } catch {
      setError(true)
      setTimeout(() => setError(false), 4000)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <ErrorBadge message="Couldn't load" />
  if (enabled === null) return <div className="h-6 w-11 animate-pulse rounded-full bg-white/[0.04]" />

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60',
          enabled ? 'bg-accent' : 'bg-zinc-700',
        ].join(' ')}
        role="switch"
        aria-checked={enabled}
      >
        <span className={['inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200', enabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </button>
      <span className="text-xs text-zinc-500">{enabled ? 'On' : 'Off'}</span>
      {saved && <SavedBadge />}
      {error && <ErrorBadge />}
    </div>
  )
}

// ── Alert sound toggle ────────────────────────────────────────────────────────

const SOUND_KEY = 'stockline_alert_sound'

function FeedbackActions() {
  const email = 'stockline000@gmail.com'
  const subject = 'StockLine feedback'
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}`
  const mailtoHref = `mailto:${email}?subject=${encodeURIComponent(subject)}`
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = email
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
      ta.remove()
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="me-3 select-all font-mono text-xs text-zinc-400">{email}</span>
      <button
        type="button"
        onClick={copy}
        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <a
        href={gmailHref}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100"
      >
        Gmail
      </a>
      <a
        href={mailtoHref}
        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100"
      >
        Mail app
      </a>
    </div>
  )
}

function AlertSoundToggle() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(SOUND_KEY) !== 'off')
  const [saved, setSaved] = useState(false)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none',
          enabled ? 'bg-accent' : 'bg-zinc-700',
        ].join(' ')}
        role="switch"
        aria-checked={enabled}
      >
        <span className={['inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200', enabled ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </button>
      <span className="text-xs text-zinc-500">{enabled ? 'On' : 'Muted'}</span>
      {saved && <SavedBadge />}
    </div>
  )
}

// ── Two-factor authentication ─────────────────────────────────────────────────

function TwoFactorSection({ token }) {
  const [enabled, setEnabled] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [mode, setMode] = useState('idle') // 'idle' | 'setup' | 'disable'
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [backupCodes, setBackupCodes] = useState([])
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    fetch(apiUrl('/api/auth/2fa'), { headers: authHeaders(token) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        if (cancelled) return
        if (d.ok) setEnabled(Boolean(d.enabled))
        else setLoadError(true)
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [token])

  const startSetup = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/setup'), {
        method: 'POST',
        headers: authHeaders(token),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Failed to start setup.')
        return
      }
      setOtpauthUri(data.otpauthUri)
      setBackupCodes(data.backupCodes ?? [])
      const url = await QRCode.toDataURL(data.otpauthUri, { margin: 1, width: 220 })
      setQrDataUrl(url)
      setMode('setup')
      setCode('')
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }, [token])

  const verifyAndEnable = useCallback(async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/enable'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Verification failed.')
        return
      }
      setEnabled(true)
      setSuccess(true)
      setMode('idle')
      setQrDataUrl('')
      setOtpauthUri('')
      setBackupCodes([])
      setCode('')
      setTimeout(() => setSuccess(false), 2500)
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }, [token, code])

  const disable = useCallback(async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/auth/2fa'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Failed to disable 2FA.')
        return
      }
      setEnabled(false)
      setMode('idle')
      setPassword('')
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }, [token, password])

  if (loadError) return <ErrorBadge message="Couldn't load" />
  if (enabled === null) return <div className="h-6 w-24 animate-pulse rounded-full bg-white/[0.04]" />

  if (mode === 'setup') {
    return (
      <form onSubmit={verifyAndEnable} className="mt-3 w-full space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="2FA QR code" className="size-[180px] shrink-0 rounded-lg bg-white p-2" />
          ) : null}
          <div className="min-w-0 space-y-2 text-xs text-zinc-400">
            <p className="text-sm text-zinc-200">Scan with your authenticator</p>
            <p>Open Google Authenticator, Authy, or 1Password and scan this QR code. If you can't scan, enter this key manually:</p>
            <code className="block break-all rounded-md bg-black/40 px-2 py-1.5 font-mono text-[11px] text-zinc-300">
              {otpauthUri}
            </code>
          </div>
        </div>

        {backupCodes.length > 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>Save these backup codes somewhere safe. Each can be used once if you lose access to your authenticator.</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {backupCodes.map((c) => (
                <code key={c} className="rounded-md bg-black/40 px-2 py-1.5 text-center font-mono text-[12px] text-zinc-200">{c}</code>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Enter code from app</label>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
            className="w-40 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-center font-mono text-base tracking-[0.3em] text-zinc-100 outline-none focus:border-white/20 focus:bg-white/[0.06] transition"
            placeholder="123456"
          />
        </div>

        {error ? <p className="text-xs text-rose-400">{error}</p> : null}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={busy || !code}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
            {busy ? 'Verifying…' : 'Verify and enable'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('idle'); setQrDataUrl(''); setOtpauthUri(''); setBackupCodes([]); setCode(''); setError(null) }}
            className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-zinc-500 transition hover:border-white/15 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  if (mode === 'disable') {
    return (
      <form onSubmit={disable} className="mt-3 w-full space-y-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
        <div className="flex items-start gap-2 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>Disabling 2FA removes a layer of protection. Re-enter your password to confirm.</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Current password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/[0.06] transition"
          />
        </div>
        {error ? <p className="text-xs text-rose-400">{error}</p> : null}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={busy || !password}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {busy ? 'Disabling…' : 'Disable 2FA'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('idle'); setPassword(''); setError(null) }}
            className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-zinc-500 transition hover:border-white/15 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {enabled ? (
        <>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
            Enabled
          </span>
          <button
            type="button"
            onClick={() => { setMode('disable'); setError(null) }}
            className="rounded-lg border border-rose-500/25 bg-rose-500/5 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/45 hover:bg-rose-500/10 hover:text-rose-200"
          >
            Disable
          </button>
        </>
      ) : (
        <>
          {success && <SavedBadge />}
          <button
            type="button"
            onClick={startSetup}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
            {busy ? 'Starting…' : 'Set up 2FA'}
          </button>
        </>
      )}
    </div>
  )
}

// ── Delete account form ───────────────────────────────────────────────────────

function DeleteAccountForm({ token }) {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const reset = () => {
    setPassword(''); setConfirm(''); setShowPw(false); setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (confirm !== 'DELETE') return setError('Type DELETE to confirm.')
    if (!password) return setError('Password is required.')
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/user'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ password, confirm }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Failed to delete account.')
        return
      }
      logout()
      window.location.assign('/welcome')
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { reset(); setOpen(true) }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/5 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/45 hover:bg-rose-500/10 hover:text-rose-200"
      >
        <Trash2 className="size-3.5" />
        Delete account
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 w-full space-y-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
      <div className="flex items-start gap-2 text-xs text-rose-300">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>This permanently removes your account, watchlists, alerts, and history. This cannot be undone.</span>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Current password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 pr-9 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/[0.06] transition"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
          >
            {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Type DELETE to confirm</label>
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/[0.06] transition"
        />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={busy || confirm !== 'DELETE' || !password}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); reset() }}
          className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-zinc-500 transition hover:border-white/15 hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Download my data ──────────────────────────────────────────────────────────

function DownloadDataButton({ token }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleClick = async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/user/export'), { headers: authHeaders(token) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message ?? 'Export failed.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dispo = res.headers.get('Content-Disposition') || ''
      const match = /filename="([^"]+)"/.exec(dispo)
      a.download = match?.[1] ?? `stockline-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-zinc-100 disabled:opacity-60"
      >
        {busy ? 'Preparing…' : 'Download my data'}
      </button>
      {error && <ErrorBadge message={error} />}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Settings() {
  const { user, token } = useAuth()

  return (
    <div className="app-page-enter space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Settings</h1>
        <p className="text-sm text-zinc-500">Manage your account, display preferences, and data sources.</p>
      </header>

      {/* Account */}
      <Section icon={User} title="Account">
        <Row label="Email" hint="Your sign-in address">
          <span className="text-sm text-zinc-400">{user?.email ?? '—'}</span>
        </Row>
        <div className="py-3.5">
          <p className="text-sm text-zinc-200">Password</p>
          <p className="mt-0.5 text-xs text-zinc-500">Must be at least 8 characters</p>
          <ChangePasswordForm token={token} />
        </div>
        <div className="py-3.5">
          <p className="text-sm text-zinc-200">Two-factor authentication</p>
          <p className="mt-0.5 text-xs text-zinc-500">Add an extra layer of security to your account using an authenticator app</p>
          <div className="mt-3">
            <TwoFactorSection token={token} />
          </div>
        </div>
        <Row label="Download my data" hint="Export your account, watchlists, alerts, and settings as a JSON file">
          <DownloadDataButton token={token} />
        </Row>
        <div className="py-3.5">
          <p className="text-sm text-zinc-200">Delete account</p>
          <p className="mt-0.5 text-xs text-zinc-500">Permanently remove all your data — this cannot be undone</p>
          <DeleteAccountForm token={token} />
        </div>
      </Section>

      {/* Display */}
      <Section icon={LayoutDashboard} title="Display" description="UI & layout preferences">
        <Row label="Default landing page" hint="Which page opens when you log in">
          <LandingPagePicker />
        </Row>
        <Row label="Theme" hint="Dark, light, or system default">
          <ThemePicker />
        </Row>
        <Row label="Number formatting" hint="Affects prices, percentages, and large numbers across the app">
          <LocalePicker />
        </Row>
        <Row label="Table density" hint="Row height for tables on Watchlist, Portfolio, Alerts, Sectors, News, and Strategies (compact ≈ 14px tall, comfortable ≈ 44px)">
          <DensityPicker />
        </Row>
        <Row label="Chart style" hint="Series type used by the SPY chart on the Markets page — Area shades the region under the line in green, Line draws only the price line">
          <ChartStylePicker />
        </Row>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Notifications" description="How and when you're notified">
        <Row label="Alert sound" hint="Play a chime when a WebSocket alert fires in the browser tab">
          <AlertSoundToggle />
        </Row>
        <div className="py-3.5">
          <EmailNotificationSettings token={token} userEmail={user?.email} />
        </div>
        <div className="py-3.5">
          <p className="text-sm text-zinc-200">Quiet hours</p>
          <p className="mt-0.5 text-xs text-zinc-500">Suppress in-app chimes and alert toasts during set times (ET)</p>
          <div className="mt-3">
            <QuietHoursPicker />
          </div>
        </div>
      </Section>

      {/* Data & API */}
      <Section icon={Database} title="Data & API" description="Market data source">
        <Row label="Data provider" hint="All market data is sourced from Financial Modeling Prep (FMP)">
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
            Connected
          </span>
        </Row>
        <Row label="Extended hours data" hint="Include pre-market and after-hours bars when checking intraday alerts">
          <ExtendedHoursToggle token={token} />
        </Row>
      </Section>

      {/* About */}
      <Section icon={SettingsIcon} title="About">
        <Row label="Version">
          <span className="text-sm tabular-nums text-zinc-500">0.1.0-alpha</span>
        </Row>
        <Row label="Data provider">
          <a
            href="https://financialmodelingprep.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent/80 underline-offset-4 hover:text-accent hover:underline"
          >
            Financial Modeling Prep
          </a>
        </Row>
        <Row label="Send feedback" hint="Report a bug or request a feature">
          <FeedbackActions />
        </Row>
      </Section>
    </div>
  )
}
