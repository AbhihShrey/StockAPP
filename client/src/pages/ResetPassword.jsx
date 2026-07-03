import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmberLogo } from '../components/EmberLogo'
import { FlameSpinner } from '../components/FlameSpinner'
import { apiUrl } from '../lib/apiBase'

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => { setErr(null) }, [password, confirm])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token) return setErr('This link is missing its reset token.')
    if (password.length < 8) return setErr('Password must be at least 8 characters.')
    if (password !== confirm) return setErr('Passwords do not match.')
    setBusy(true)
    try {
      const res = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setErr(data.message ?? 'Could not reset password. The link may be invalid or expired.')
        return
      }
      setDone(true)
    } catch {
      setErr('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-bg text-ink antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(56rem 38rem at 50% -12%, rgba(255,107,44,0.07), transparent 70%)',
        }}
      />
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/welcome"
            className="flex min-w-0 shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
          >
            <EmberLogo size="xs" layout="horizontal" showTagline={false} />
          </Link>
          <Link to="/welcome" className="btn-ghost h-9 px-3.5">
            <ArrowLeft className="size-3.5 opacity-80" aria-hidden />
            Back
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <div className="panel rise overflow-hidden shadow-2xl shadow-black/40">
          <div className="ember-rule" aria-hidden />
          <div className="p-6 sm:p-7">
            <p className="eyebrow">Account · Security</p>
            <h1 className="display mt-2 text-xl">Reset password</h1>

            {done ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm leading-relaxed text-up">Your password has been updated. You can now sign in with the new password.</p>
                <Link
                  to="/welcome?signin=1"
                  className="btn-primary w-full"
                >
                  Continue to sign in
                </Link>
              </div>
            ) : !token ? (
              <p className="mt-4 text-sm text-down">This link is missing a reset token. Request a new password reset email.</p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <p className="text-sm text-ink-2">Choose a new password (8+ characters).</p>
                <div>
                  <label htmlFor="reset-password" className="field-label">New password</label>
                  <div className="relative">
                    <input
                      id="reset-password"
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      autoComplete="new-password"
                      required
                      className="input pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-3 outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60"
                      aria-label={show ? 'Hide password' : 'Show password'}
                    >
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reset-confirm" className="field-label">Confirm new password</label>
                  <input
                    id="reset-confirm"
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    required
                    className="input"
                  />
                </div>
                {err ? <p className="text-xs text-down">{err}</p> : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary w-full"
                >
                  {busy ? <FlameSpinner size={16} /> : <KeyRound className="size-4" />}
                  {busy ? 'Updating…' : 'Update password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
