import { Eye, EyeOff, KeyRound } from 'lucide-react'
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
    <div className="min-h-dvh bg-surface-0 text-zinc-200 antialiased">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-surface-0/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/welcome">
            <EmberLogo size="xs" layout="horizontal" showTagline={false} />
          </Link>
          <Link to="/welcome" className="text-sm font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-200 hover:underline">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-6 shadow-2xl shadow-black/40">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Reset password</h1>

          {done ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm leading-relaxed text-zinc-400">Your password has been updated. You can now sign in with the new password.</p>
              <Link
                to="/welcome?signin=1"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
              >
                Continue to sign in
              </Link>
            </div>
          ) : !token ? (
            <p className="mt-4 text-sm text-rose-300">This link is missing a reset token. Request a new password reset email.</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <p className="text-sm text-zinc-500">Choose a new password (8+ characters).</p>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">New password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 pr-9 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/[0.06] transition"
                  />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300">
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Confirm new password</label>
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/20 focus:bg-white/[0.06] transition"
                />
              </div>
              {err ? <p className="text-xs text-rose-400">{err}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
              >
                {busy ? <FlameSpinner size={16} /> : <KeyRound className="size-4" />}
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
