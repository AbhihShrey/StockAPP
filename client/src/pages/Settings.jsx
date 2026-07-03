import {
  AlertCircle,
  Bell,
  Check,
  ChevronDown,
  Database,
  Eye,
  EyeOff,
  History,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'
import { getChartStyle, getDefaultLanding, getLocale, getQuietHours, saveChartStyle, saveDefaultLanding, saveLocale, saveQuietHours } from '../lib/prefs'
import { getDensity, saveDensity } from '../lib/theme'
import { CURRENT_VERSION, VERSION_HISTORY } from '../lib/versionHistory'

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

function Section({ icon, title, description, danger = false, className = '', children }) {
  const Icon = icon
  return (
    <section className={['panel', danger ? 'border-down/25' : '', className].join(' ')}>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 sm:px-5">
        <Icon className={['size-4', danger ? 'text-down' : 'text-ink-3'].join(' ')} aria-hidden />
        <h2 className={['eyebrow', danger ? 'text-down' : ''].join(' ')}>{title}</h2>
        {description && <span className="ml-auto text-xs text-ink-3">{description}</span>}
      </div>
      <div className="divide-y divide-line px-4 sm:px-5">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// Toggle switch — bg-ember-grad when on, surface-3 when off.
function Switch({ on, onClick, disabled = false, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors duration-200',
        'focus-visible:ring-2 focus-visible:ring-ember/60 disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'bg-ember-grad' : 'border border-line-strong bg-surface-3',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block size-4 rounded-full bg-ink shadow-sm transition-transform duration-200',
          on ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
        aria-hidden
      />
    </button>
  )
}

// Segmented control — one active segment gets the ember gradient.
function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 p-1">
      {options.map(({ value: v, label: l }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={[
            'rounded-md px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/60',
            value === v ? 'bg-ember-grad text-bg' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
          ].join(' ')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

// A single changelog release — shows the version, a one-line summary, and reveals the
// full list of changes when clicked.
function VersionEntry({ release, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const chipClass =
    release.type === 'major'
      ? 'chip chip-ember'
      : release.type === 'minor'
        ? 'chip border-line-strong text-ink-2'
        : 'chip text-ink-3'

  return (
    <div className="py-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
      >
        <span className="num text-sm font-semibold text-ink">v{release.version}</span>
        <span className={[chipClass, 'uppercase'].join(' ')}>{release.type}</span>
        <span className="hidden text-xs text-ink-3 sm:inline">{release.title}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="num text-xs text-ink-3">{release.date}</span>
          <ChevronDown className={['size-4 text-ink-3 transition-transform', open ? 'rotate-180' : ''].join(' ')} aria-hidden />
        </span>
      </button>

      {release.summary && <p className="mt-1 pr-6 text-xs text-ink-2">{release.summary}</p>}

      {open && (
        <ul className="mt-2 space-y-1">
          {release.changes.map((c, i) => (
            <li key={i} className="flex gap-2 text-xs text-ink-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ember/60" aria-hidden />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SavedBadge() {
  return (
    <span className="flex items-center gap-1 text-xs text-up">
      <Check className="size-3.5" aria-hidden /> Saved
    </span>
  )
}

function ErrorBadge({ message = 'Save failed' }) {
  return (
    <span className="flex items-center gap-1 text-xs text-down" title={message}>
      <AlertCircle className="size-3.5" aria-hidden /> {message}
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
      <button type="button" onClick={() => { reset(); setOpen(true) }} className="btn-ghost mt-3">
        Change password
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 w-full max-w-md space-y-3">
      {[
        { label: 'Current password', value: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent((v) => !v) },
        { label: 'New password', value: next, set: setNext, show: showNext, toggle: () => setShowNext((v) => !v) },
        { label: 'Confirm new password', value: confirm, set: setConfirm, show: showNext, toggle: null },
      ].map(({ label, value, set, show, toggle }) => (
        <div key={label}>
          <label className="field-label" htmlFor={`pw-${label}`}>{label}</label>
          <div className="relative">
            <input
              id={`pw-${label}`}
              type={show ? 'text' : 'password'}
              value={value}
              onChange={(e) => set(e.target.value)}
              required
              className="input pr-10"
            />
            {toggle && (
              <button
                type="button"
                onClick={toggle}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-2 text-ink-3 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            )}
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-down">{error}</p>}
      {success && <p className="flex items-center gap-1 text-xs text-up"><Check className="size-3.5" aria-hidden /> Password updated successfully.</p>}
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
          {busy ? 'Saving…' : 'Update password'}
        </button>
        <button type="button" onClick={() => { setOpen(false); reset() }} className="btn-ghost">
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
      <select value={value} onChange={handleChange} aria-label="Default landing page" className="select w-44">
        {LANDING_PAGES.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
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
      <Segmented options={DENSITIES} value={value} onChange={handleChange} label="Table density" />
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
      <Segmented options={LOCALES} value={value} onChange={handleChange} label="Number formatting" />
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
      <Segmented options={CHART_STYLES} value={value} onChange={handleChange} label="Chart style" />
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
        <Switch on={prefs.enabled} onClick={() => update({ enabled: !prefs.enabled })} label="Quiet hours" />
        <span className="text-xs text-ink-3">{prefs.enabled ? 'On' : 'Off'}</span>
        {saved && <SavedBadge />}
      </div>
      {prefs.enabled && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
          <span>From</span>
          <input
            type="time"
            value={prefs.start}
            onChange={(e) => update({ start: e.target.value })}
            aria-label="Quiet hours start"
            className="input num w-auto"
          />
          <span>to</span>
          <input
            type="time"
            value={prefs.end}
            onChange={(e) => update({ end: e.target.value })}
            aria-label="Quiet hours end"
            className="input num w-auto"
          />
          <span className="text-ink-3">ET</span>
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
      <p className="flex items-center gap-1.5 py-3.5 text-xs text-down">
        <AlertCircle className="size-3.5" aria-hidden /> Couldn't load email settings — try refreshing the page.
      </p>
    )
  }

  if (!settings) return <div className="skeleton my-3.5 h-8" />

  return (
    <>
      <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-ink">Alert fire emails</p>
          <p className="mt-0.5 text-xs text-ink-3">Receive an email each time a price alert triggers</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Switch
            on={settings.email_alerts_enabled}
            onClick={() => patch({ email_alerts_enabled: !settings.email_alerts_enabled })}
            disabled={saving === 'email_alerts_enabled'}
            label="Alert fire emails"
          />
          <span className="text-xs text-ink-3">{settings.email_alerts_enabled ? 'On' : 'Off'}</span>
          {saved === 'email_alerts_enabled' && <SavedBadge />}
          {errorKey === 'email_alerts_enabled' && <ErrorBadge />}
        </div>
      </div>

      <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-ink">Daily close digest</p>
          <p className="mt-0.5 text-xs text-ink-3">End-of-day market summary with watchlist movers and alerts — sent at 4:30 PM ET</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Switch
            on={settings.email_digest_enabled}
            onClick={() => patch({ email_digest_enabled: !settings.email_digest_enabled })}
            disabled={saving === 'email_digest_enabled'}
            label="Daily close digest"
          />
          <span className="text-xs text-ink-3">{settings.email_digest_enabled ? 'On' : 'Off'}</span>
          {saved === 'email_digest_enabled' && <SavedBadge />}
          {errorKey === 'email_digest_enabled' && <ErrorBadge />}
        </div>
      </div>

      {(settings.email_alerts_enabled || settings.email_digest_enabled) && (
        <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink">Delivery email</p>
            <p className="mt-0.5 text-xs text-ink-3">Leave blank to use your account email ({userEmail})</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              placeholder={userEmail}
              aria-label="Delivery email"
              className="input w-52"
            />
            <button type="button" onClick={saveEmail} disabled={saving === 'alert_email'} className="btn-ghost">
              Save
            </button>
            {saved === 'alert_email' && <SavedBadge />}
            {errorKey === 'alert_email' && <ErrorBadge />}
          </div>
        </div>
      )}
    </>
  )
}

// ── Alert sound toggle ────────────────────────────────────────────────────────

const SOUND_KEY = 'ember_alert_sound'

function FeedbackActions() {
  const email = 'support@emberfinances.com'
  const subject = 'Ember Finance feedback'
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
      <span className="num me-2 text-xs text-ink-2 select-all">{email}</span>
      <button type="button" onClick={copy} className="btn-ghost">
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <a href={gmailHref} target="_blank" rel="noopener noreferrer" className="btn-ghost">
        Gmail
      </a>
      <a href={mailtoHref} className="btn-ghost">
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
      <Switch on={enabled} onClick={toggle} label="Alert sound" />
      <span className="text-xs text-ink-3">{enabled ? 'On' : 'Muted'}</span>
      {saved && <SavedBadge />}
    </div>
  )
}

// ── Fire crackle audio toggle ─────────────────────────────────────────────────

const FIRE_CRACKLE_KEY = 'ember_fire_crackle'

function FireCrackleToggle() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(FIRE_CRACKLE_KEY) === 'true')
  const [saved, setSaved] = useState(false)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem(FIRE_CRACKLE_KEY, next ? 'true' : 'false')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-3">
      <Switch on={enabled} onClick={toggle} label="Fire crackle" />
      <span className="text-xs text-ink-3">{enabled ? 'On' : 'Off'}</span>
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
  if (enabled === null) return <div className="skeleton h-6 w-24 rounded-full" />

  if (mode === 'setup') {
    return (
      <form onSubmit={verifyAndEnable} className="mt-3 w-full space-y-4 rounded-xl border border-line bg-surface-2 p-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="2FA QR code" className="size-[180px] shrink-0 rounded-lg bg-ink p-2" />
          ) : null}
          <div className="min-w-0 space-y-2 text-xs text-ink-2">
            <p className="text-sm text-ink">Scan with your authenticator</p>
            <p>Open Google Authenticator, Authy, or 1Password and scan this QR code. If you can't scan, enter this key manually:</p>
            <code className="num block rounded-md border border-line bg-bg px-2 py-1.5 text-[11px] break-all text-ink-2">
              {otpauthUri}
            </code>
          </div>
        </div>

        {backupCodes.length > 0 ? (
          <div className="rounded-xl border border-warn/25 bg-warn/10 p-3">
            <div className="flex items-start gap-2 text-xs text-warn">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>Save these backup codes somewhere safe. Each can be used once if you lose access to your authenticator.</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {backupCodes.map((c) => (
                <code key={c} className="num rounded-md border border-line bg-bg px-2 py-1.5 text-center text-[12px] text-ink">{c}</code>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <label className="field-label" htmlFor="twofa-code">Enter code from app</label>
          <input
            id="twofa-code"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
            className="input num w-40 text-center text-base tracking-[0.3em]"
            placeholder="123456"
          />
        </div>

        {error ? <p className="text-xs text-down">{error}</p> : null}

        <div className="flex items-center gap-2 pt-1">
          <button type="submit" disabled={busy || !code} className="btn-primary">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
            {busy ? 'Verifying…' : 'Verify and enable'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('idle'); setQrDataUrl(''); setOtpauthUri(''); setBackupCodes([]); setCode(''); setError(null) }}
            className="btn-ghost"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  if (mode === 'disable') {
    return (
      <form onSubmit={disable} className="mt-3 w-full max-w-md space-y-3 rounded-xl border border-down/25 bg-down/10 p-4">
        <div className="flex items-start gap-2 text-xs text-down">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>Disabling 2FA removes a layer of protection. Re-enter your password to confirm.</span>
        </div>
        <div>
          <label className="field-label" htmlFor="twofa-disable-pw">Current password</label>
          <input
            id="twofa-disable-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input"
          />
        </div>
        {error ? <p className="text-xs text-down">{error}</p> : null}
        <div className="flex items-center gap-2 pt-1">
          <button type="submit" disabled={busy || !password} className="btn-danger">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? 'Disabling…' : 'Disable 2FA'}
          </button>
          <button type="button" onClick={() => { setMode('idle'); setPassword(''); setError(null) }} className="btn-ghost">
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
          <span className="chip chip-up">Enabled</span>
          <button type="button" onClick={() => { setMode('disable'); setError(null) }} className="btn-danger">
            Disable
          </button>
        </>
      ) : (
        <>
          {success && <SavedBadge />}
          <button type="button" onClick={startSetup} disabled={busy} className="btn-ghost">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
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
      <button type="button" onClick={() => { reset(); setOpen(true) }} className="btn-danger mt-3">
        <Trash2 className="size-4" aria-hidden />
        Delete account
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 w-full max-w-md space-y-3 rounded-xl border border-down/25 bg-down/10 p-4">
      <div className="flex items-start gap-2 text-xs text-down">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>This permanently removes your account, watchlists, alerts, and history. This cannot be undone.</span>
      </div>
      <div>
        <label className="field-label" htmlFor="delete-pw">Current password</label>
        <div className="relative">
          <input
            id="delete-pw"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="input pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-2 text-ink-3 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
          >
            {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="delete-confirm">Type DELETE to confirm</label>
        <input
          id="delete-confirm"
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="input"
        />
      </div>
      {error && <p className="text-xs text-down">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={busy || confirm !== 'DELETE' || !password} className="btn-danger">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button type="button" onClick={() => { setOpen(false); reset() }} className="btn-ghost">
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
      a.download = match?.[1] ?? `ember-finances-export-${Date.now()}.json`
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
      <button type="button" onClick={handleClick} disabled={busy} className="btn-ghost">
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
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">Account · Preferences</p>
        <h1 className="display mt-1 text-2xl sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-sm text-ink-2">Manage your account, display preferences, and notifications.</p>
        <div className="ember-rule mt-4" />
      </header>

      {/* Account */}
      <Section icon={User} title="Account" className="rise rise-1">
        <Row label="Email" hint="Your sign-in address">
          <span className="text-sm text-ink-2">{user?.email ?? '—'}</span>
        </Row>
        <div className="py-3.5">
          <p className="text-sm text-ink">Password</p>
          <p className="mt-0.5 text-xs text-ink-3">Must be at least 8 characters</p>
          <ChangePasswordForm token={token} />
        </div>
        <div className="py-3.5">
          <p className="text-sm text-ink">Two-factor authentication</p>
          <p className="mt-0.5 text-xs text-ink-3">Add an extra layer of security to your account using an authenticator app</p>
          <div className="mt-3">
            <TwoFactorSection token={token} />
          </div>
        </div>
        <Row label="Download my data" hint="Export your account, watchlists, alerts, and settings as a JSON file">
          <DownloadDataButton token={token} />
        </Row>
      </Section>

      {/* Display */}
      <Section icon={LayoutDashboard} title="Display" description="UI & layout preferences" className="rise rise-2">
        <Row label="Default landing page" hint="Which page opens when you log in">
          <LandingPagePicker />
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
      <Section icon={Bell} title="Notifications" description="How and when you're notified" className="rise rise-3">
        <Row label="Alert sound" hint="Play a chime when a WebSocket alert fires in the browser tab">
          <AlertSoundToggle />
        </Row>
        <Row label="Fire crackle" hint="Add a brief crackling-fire sound after the chime when alerts fire">
          <FireCrackleToggle />
        </Row>
        <EmailNotificationSettings token={token} userEmail={user?.email} />
        <div className="py-3.5">
          <p className="text-sm text-ink">Quiet hours</p>
          <p className="mt-0.5 text-xs text-ink-3">Suppress in-app chimes and alert toasts during set times (ET)</p>
          <div className="mt-3">
            <QuietHoursPicker />
          </div>
        </div>
      </Section>

      {/* Data & API */}
      <Section icon={Database} title="Data & API" description="Market data source" className="rise rise-4">
        <Row label="Data provider" hint="All market data is sourced from Financial Modeling Prep (FMP)">
          <span className="chip chip-up">Connected</span>
        </Row>
      </Section>

      {/* About */}
      <Section icon={SettingsIcon} title="About" className="rise rise-5">
        <Row label="Version">
          <span className="num text-sm text-ink-2">v{CURRENT_VERSION}</span>
        </Row>
        <Row label="Data provider">
          <a
            href="https://financialmodelingprep.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded text-sm text-flame underline-offset-4 outline-none transition-colors hover:text-ember hover:underline focus-visible:ring-2 focus-visible:ring-ember/60"
          >
            Financial Modeling Prep
          </a>
        </Row>
        <Row label="Send feedback" hint="Report a bug or request a feature">
          <FeedbackActions />
        </Row>
      </Section>

      {/* Version history */}
      <Section icon={History} title="Version history" description="What's new" className="rise rise-6">
        {VERSION_HISTORY.map((rel, i) => (
          <VersionEntry key={rel.version} release={rel} defaultOpen={i === 0} />
        ))}
      </Section>

      {/* Danger zone */}
      <Section icon={Trash2} title="Danger zone" description="Irreversible actions" danger className="rise rise-7">
        <div className="py-3.5">
          <p className="text-sm text-ink">Delete account</p>
          <p className="mt-0.5 text-xs text-ink-3">Permanently remove all your data — this cannot be undone</p>
          <DeleteAccountForm token={token} />
        </div>
      </Section>
    </div>
  )
}
