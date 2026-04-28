import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, HelpCircle, Home, Layers, LogOut, Menu, Package } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDefaultLanding } from '../lib/prefs'
import { EmberLogo } from './EmberLogo'

const MENU_LINKS = [
  { to: '/products',  label: 'Products',  icon: Package, blurb: 'Every tool in the workspace' },
  { to: '/solutions', label: 'Solutions', icon: Layers,  blurb: 'Built for every trading style' },
  { to: '/faq',       label: 'FAQ',       icon: HelpCircle, blurb: 'Common questions answered' },
]

function MenuDropdown() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (!wrapperRef.current) return
      if (wrapperRef.current.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-300 hover:text-zinc-100"
      >
        <Menu className="size-3.5 opacity-80" aria-hidden />
        Menu
        <ChevronDown className={`size-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="welcome-menu-dropdown glass-bar absolute right-0 top-[calc(100%+8px)] z-40 w-[260px] overflow-hidden rounded-xl border border-white/10 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.85)]"
        >
          {MENU_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/[0.06]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-accent transition group-hover:border-accent/30">
                  <Icon className="size-4" strokeWidth={2} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-zinc-100">{item.label}</span>
                  <span className="text-[11px] leading-snug text-zinc-500">{item.blurb}</span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Marketing header — Ember dark theme; subtle L→R flowing lines in the background.
 * Products / Solutions / FAQ live in a single Menu dropdown.
 * Sign-in / Continue-to-app / Get started are rectangular buttons.
 */
export function WelcomeMarketingNav({ onSignIn, onGetStarted }) {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    logout()
    navigate('/welcome', { replace: true })
  }

  return (
    <div className="welcome-marketing-nav glass-bar sticky top-0 z-40 border-b border-white/[0.05] text-zinc-200">
      <div className="relative z-10 mx-auto flex h-[76px] max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Link
            to="/welcome"
            className="glass-btn flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100"
            aria-label="Home — welcome page"
            title="Welcome"
          >
            <Home className="size-[17px]" strokeWidth={2} aria-hidden />
          </Link>
          <Link to="/welcome" className="flex min-w-0 items-center gap-2.5">
            <EmberLogo size="sm" layout="horizontal" showTagline={false} />
          </Link>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <MenuDropdown />

          {isAuthenticated ? (
            <>
              <Link
                to={getDefaultLanding()}
                className="glass-btn--accent ember-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold"
              >
                Continue to app
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="glass-btn hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-400 hover:text-zinc-100 sm:inline-flex"
                aria-label="Sign out"
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
                className="glass-btn inline-flex items-center rounded-lg px-4 py-2 text-[13px] font-medium text-zinc-200 hover:text-zinc-50"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={onGetStarted}
                className="glass-btn--accent ember-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold"
              >
                Get started
                <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
