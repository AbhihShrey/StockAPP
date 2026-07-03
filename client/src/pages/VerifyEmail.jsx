import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmberLogo } from '../components/EmberLogo'
import { FlameSpinner } from '../components/FlameSpinner'
import { apiUrl } from '../lib/apiBase'

export function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState(token ? 'loading' : 'error') // 'loading' | 'ok' | 'error'
  const [message, setMessage] = useState(token ? '' : 'This link is missing its verification token.')

  useEffect(() => {
    if (!token) return
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
        <div className="panel rise overflow-hidden text-center shadow-2xl shadow-black/40">
          <div className="ember-rule" aria-hidden />
          <div className="p-6 sm:p-7">
            {status === 'loading' ? (
              <>
                <FlameSpinner size={40} className="mx-auto" />
                <h1 className="display mt-4 text-xl">Verifying email…</h1>
              </>
            ) : status === 'ok' ? (
              <>
                <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-up/25 bg-up/10 text-up">
                  <CheckCircle2 className="size-6" aria-hidden />
                </span>
                <h1 className="display mt-4 text-xl">Email verified</h1>
                <p className="mt-2 text-sm text-ink-2">Thanks — your account is fully verified.</p>
                <Link
                  to="/dashboard"
                  className="btn-primary mt-6 w-full"
                >
                  Continue to Ember Finance
                </Link>
              </>
            ) : (
              <>
                <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-down/25 bg-down/10 text-down">
                  <XCircle className="size-6" aria-hidden />
                </span>
                <h1 className="display mt-4 text-xl">Verification failed</h1>
                <p className="mt-2 text-sm text-ink-2">{message}</p>
                <Link
                  to="/welcome?signin=1"
                  className="btn-ghost mt-6 w-full"
                >
                  Sign in to request a new link
                </Link>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
