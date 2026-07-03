import { Lock, Mail, X } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiUrl } from '../lib/apiBase'
import { getDefaultLanding } from '../lib/prefs'
import { FlameSpinner } from './FlameSpinner'

/**
 * @param {{ open: boolean, mode: 'signin' | 'signup', onClose: () => void, onSwitchMode: (m: 'signin' | 'signup') => void }} props
 */
export function WelcomeAuthModal({ open, mode, onClose, onSwitchMode }) {
  const titleId = useId()
  const navigate = useNavigate()
  const { login, signup, completeTwoFactor } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotBusy, setForgotBusy] = useState(false)
  const [challengeMode, setChallengeMode] = useState(false)
  const [challengeToken, setChallengeToken] = useState(null)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!open) return
    setErr(null)
    setBusy(false)
    setForgotMode(false)
    setForgotSent(false)
    setForgotBusy(false)
    setChallengeMode(false)
    setChallengeToken(null)
    setCode('')
  }, [open, mode])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setErr(null)
      setBusy(true)
      const res = mode === 'signin' ? await login(email, password) : await signup(email, password)
      setBusy(false)
      if (!res.ok) {
        setErr(res.error ?? 'Something went wrong.')
        return
      }
      if (res.twofaRequired) {
        setChallengeToken(res.challengeToken)
        setChallengeMode(true)
        setCode('')
        return
      }
      onClose()
      navigate(getDefaultLanding(), { replace: true })
    },
    [email, password, login, signup, mode, navigate, onClose],
  )

  const onChallengeSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setErr(null)
      setBusy(true)
      const res = await completeTwoFactor(challengeToken, code)
      setBusy(false)
      if (!res.ok) {
        setErr(res.error ?? '2FA verification failed.')
        return
      }
      onClose()
      navigate(getDefaultLanding(), { replace: true })
    },
    [challengeToken, code, completeTwoFactor, navigate, onClose],
  )

  const onForgotSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setErr(null)
      setForgotBusy(true)
      try {
        await fetch(apiUrl('/api/auth/forgot-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      } catch {
        // Even on error we show the same neutral message — never leak existence.
      }
      setForgotBusy(false)
      setForgotSent(true)
    },
    [email],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass panel rise relative w-full max-w-[420px] overflow-hidden border-line-strong shadow-2xl shadow-black/60"
      >
        <div className="ember-rule" aria-hidden />
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 id={titleId} className="display text-lg">
              {challengeMode
                ? 'Two-factor authentication'
                : forgotMode
                  ? 'Reset password'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {challengeMode
                ? 'Enter the 6-digit code from your authenticator app, or a backup code.'
                : forgotMode
                  ? 'Enter your email and we\'ll send a reset link.'
                  : mode === 'signin'
                    ? 'Welcome back — your terminal is one step away.'
                    : 'Choose a password you will remember. Your data is stored securely on the server.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2.5 text-ink-3 outline-none transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        {challengeMode ? (
          <form className="space-y-4 px-6 py-5" onSubmit={onChallengeSubmit}>
            <div>
              <label className="field-label" htmlFor={`${titleId}-code`}>Verification code</label>
              <input
                id={`${titleId}-code`}
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input num h-12 text-center text-lg tracking-[0.3em]"
                placeholder="123456"
                autoFocus
                required
              />
            </div>
            {err ? <p className="text-sm text-down">{err}</p> : null}
            <button type="submit" disabled={busy} className="btn-primary h-11 w-full">
              {busy ? <FlameSpinner size={16} /> : null}
              {busy ? 'Verifying…' : 'Verify and sign in'}
            </button>
            <p className="text-center text-xs text-ink-3">
              <button
                type="button"
                className="font-medium text-flame hover:underline"
                onClick={() => {
                  setChallengeMode(false)
                  setChallengeToken(null)
                  setCode('')
                  setErr(null)
                }}
              >
                Back to sign in
              </button>
            </p>
          </form>
        ) : forgotMode ? (
          <form className="space-y-4 px-6 py-5" onSubmit={onForgotSubmit}>
            {forgotSent ? (
              <>
                <p className="text-sm leading-relaxed text-ink-2">
                  If an account exists for <span className="text-ink">{email}</span>, a password reset link is on its way.
                  The link expires in 60 minutes.
                </p>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setForgotSent(false) }}
                  className="btn-ghost h-11 w-full"
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="field-label" htmlFor={`${titleId}-forgot-email`}>Email</label>
                  <span className="relative flex items-center">
                    <Mail className="pointer-events-none absolute left-3 size-4 text-ink-3" aria-hidden />
                    <input
                      id={`${titleId}-forgot-email`}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input h-11 pl-10"
                      placeholder="you@company.com"
                      required
                    />
                  </span>
                </div>
                <button type="submit" disabled={forgotBusy} className="btn-primary h-11 w-full">
                  {forgotBusy ? <FlameSpinner size={16} /> : null}
                  {forgotBusy ? 'Sending…' : 'Send reset link'}
                </button>
                <p className="text-center text-xs text-ink-3">
                  <button
                    type="button"
                    className="font-medium text-flame hover:underline"
                    onClick={() => setForgotMode(false)}
                  >
                    Back to sign in
                  </button>
                </p>
              </>
            )}
          </form>
        ) : (
        <form className="space-y-4 px-6 py-5" onSubmit={onSubmit}>
          <div>
            <label className="field-label" htmlFor={`${titleId}-email`}>Email</label>
            <span className="relative flex items-center">
              <Mail className="pointer-events-none absolute left-3 size-4 text-ink-3" aria-hidden />
              <input
                id={`${titleId}-email`}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input h-11 pl-10"
                placeholder="you@company.com"
                required
              />
            </span>
          </div>
          <div>
            <span className="flex items-center justify-between">
              <label className="field-label" htmlFor={`${titleId}-password`}>Password</label>
              {mode === 'signin' ? (
                <button
                  type="button"
                  onClick={() => { setErr(null); setForgotMode(true) }}
                  className="mb-1.5 text-[11px] font-medium text-flame hover:underline"
                >
                  Forgot password?
                </button>
              ) : null}
            </span>
            <span className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-3 size-4 text-ink-3" aria-hidden />
              <input
                id={`${titleId}-password`}
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input h-11 pl-10"
                placeholder="••••••••"
                minLength={mode === 'signup' ? 8 : 1}
                required
              />
            </span>
          </div>
          {err ? <p className="text-sm text-down">{err}</p> : null}
          {mode === 'signup' ? (
            <p className="text-[11px] leading-relaxed text-ink-3">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="text-flame hover:underline" onClick={onClose}>Terms</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-flame hover:underline" onClick={onClose}>Privacy Policy</Link>.
            </p>
          ) : null}
          <button type="submit" disabled={busy} className="btn-primary h-11 w-full">
            {busy ? <FlameSpinner size={16} /> : null}
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          <p className="text-center text-xs text-ink-3">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button
                  type="button"
                  className="font-medium text-flame hover:underline"
                  onClick={() => onSwitchMode('signup')}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="font-medium text-flame hover:underline"
                  onClick={() => onSwitchMode('signin')}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
        )}
      </div>
    </div>
  )
}
