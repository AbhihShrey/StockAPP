import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StockLineLogo } from '../components/StockLineLogo'
import { apiUrl } from '../lib/apiBase'

export function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('This link is missing its verification token.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl(`/api/auth/verify-email?token=${encodeURIComponent(token)}`))
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && data.ok) {
          setStatus('ok')
        } else {
          setStatus('error')
          setMessage(data.message ?? 'Verification failed. The link may be invalid or expired.')
        }
      } catch {
        if (!cancelled) {
          setStatus('error')
          setMessage('Network error. Please try again.')
        }
      }
    })()
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="min-h-dvh bg-surface-0 text-zinc-200 antialiased">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-surface-0/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/welcome">
            <StockLineLogo size="xs" layout="horizontal" showTagline={false} />
          </Link>
          <Link to="/welcome" className="text-sm font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-200 hover:underline">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-6 text-center shadow-2xl shadow-black/40">
          {status === 'loading' ? (
            <>
              <Loader2 className="mx-auto size-10 animate-spin text-accent" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">Verifying email…</h1>
            </>
          ) : status === 'ok' ? (
            <>
              <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">Email verified</h1>
              <p className="mt-2 text-sm text-zinc-500">Thanks — your account is fully verified.</p>
              <Link
                to="/dashboard"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-110"
              >
                Continue to StockLine
              </Link>
            </>
          ) : (
            <>
              <XCircle className="mx-auto size-12 text-rose-400" />
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-50">Verification failed</h1>
              <p className="mt-2 text-sm text-zinc-500">{message}</p>
              <Link
                to="/welcome?signin=1"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]"
              >
                Sign in to request a new link
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
