import { ChevronDown, Globe, Home, LogOut, TrendingUp } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function NavFlowLines() {
  return (
    <div className="welcome-nav-flow-lines" aria-hidden>
      <div className="welcome-nav-flow-line welcome-nav-flow-line--1" />
      <div className="welcome-nav-flow-line welcome-nav-flow-line--2" />
      <div className="welcome-nav-flow-line welcome-nav-flow-line--3" />
      <div className="welcome-nav-flow-line welcome-nav-flow-line--4" />
    </div>
  )
}

/**
 * Marketing header — matches app dark theme; subtle L→R flowing lines in the background.
 */
export function WelcomeMarketingNav({ onSignIn, onGetStarted }) {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    logout()
    navigate('/welcome', { replace: true })
  }

  return (
    <div className="relative z-30 overflow-hidden border-b border-white/10 bg-surface-0/85 text-zinc-200 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
      <NavFlowLines />
      <div className="relative z-10 mx-auto flex h-[60px] max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Link
            to="/welcome"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-zinc-100"
            aria-label="Home — welcome page"
            title="Welcome"
          >
            <Home className="size-[17px]" strokeWidth={2} aria-hidden />
          </Link>
          <Link to="/welcome" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
              <TrendingUp className="size-[18px]" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="truncate text-[15px] font-semibold tracking-tight text-zinc-100">InvestAIV1</span>
          </Link>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center gap-7 text-[14px] font-medium text-zinc-500 md:flex">
          <Link to="/products" className="inline-flex items-center gap-0.5 transition hover:text-zinc-200">
            Products <ChevronDown className="size-3.5 opacity-50" aria-hidden />
          </Link>
          <Link to="/solutions" className="inline-flex items-center gap-0.5 transition hover:text-zinc-200">
            Solutions <ChevronDown className="size-3.5 opacity-50" aria-hidden />
          </Link>
          <Link to="/enterprise" className="transition hover:text-zinc-200">
            Enterprise
          </Link>
          <Link to="/pricing" className="transition hover:text-zinc-200">
            Pricing
          </Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="hidden rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 sm:inline-flex"
            aria-label="Language"
          >
            <Globe className="size-5" />
          </button>
          <Link
            to="/contact"
            className="hidden px-2 py-2 text-[13px] font-medium text-zinc-500 transition hover:text-zinc-200 lg:inline"
          >
            Contact sales
          </Link>
          <Link
            to="/app"
            className="hidden items-center gap-0.5 px-2 py-2 text-[13px] font-medium text-zinc-500 transition hover:text-zinc-200 lg:inline-flex"
          >
            Get app <ChevronDown className="size-3.5 opacity-50" aria-hidden />
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="px-2 py-2 text-[13px] font-medium text-zinc-300 transition hover:text-zinc-100 sm:px-3"
              >
                Continue to dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-100"
              >
                <LogOut className="size-3.5 opacity-80" aria-hidden />
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSignIn}
                className="px-2 py-2 text-[13px] font-medium text-zinc-400 transition hover:text-zinc-100 sm:px-3"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={onGetStarted}
                className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-zinc-950 shadow-sm shadow-black/20 transition hover:brightness-110"
              >
                Get started
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
