import { Lock, Mail, X } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * @param {{ open: boolean, mode: 'signin' | 'signup', onClose: () => void, onSwitchMode: (m: 'signin' | 'signup') => void }} props
 */
export function WelcomeAuthModal({ open, mode, onClose, onSwitchMode }) {
  const titleId = useId()
  const navigate = useNavigate()
  const { login, signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!open) return
    setErr(null)
    setBusy(false)
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
      onClose()
      navigate('/dashboard', { replace: true })
    },
    [email, password, login, signup, mode, navigate, onClose],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="welcome-modal-backdrop-enter absolute inset-0 bg-black/55 backdrop-blur-md"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="welcome-modal-panel-enter relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/90 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-zinc-100">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {mode === 'signin'
                ? 'Welcome back — your workspace is one step away.'
                : 'Choose a password you will remember. Your data is stored securely on the server.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        <form className="space-y-4 px-6 py-5" onSubmit={onSubmit}>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Email</span>
            <span className="relative flex items-center">
              <Mail className="pointer-events-none absolute left-3 size-4 text-zinc-600" aria-hidden />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none ring-accent/25 placeholder:text-zinc-600 focus:border-accent/35 focus:ring-2"
                placeholder="you@company.com"
                required
              />
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Password</span>
            <span className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-3 size-4 text-zinc-600" aria-hidden />
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-zinc-100 outline-none ring-accent/25 placeholder:text-zinc-600 focus:border-accent/35 focus:ring-2"
                placeholder="••••••••"
                minLength={mode === 'signup' ? 8 : 1}
                required
              />
            </span>
          </label>
          {err ? <p className="text-sm text-rose-300">{err}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          <p className="text-center text-xs text-zinc-600">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button
                  type="button"
                  className="font-medium text-accent hover:underline"
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
                  className="font-medium text-accent hover:underline"
                  onClick={() => onSwitchMode('signin')}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
