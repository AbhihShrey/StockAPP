import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, HelpCircle, Layers, LogOut, Menu, Package } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDefaultLanding } from '../lib/prefs'
import { EmberLogo } from './EmberLogo'

const MENU_LINKS = [
  { to: '/products',  label: 'Products',  icon: Package,    blurb: 'Every tool in the terminal' },
  { to: '/solutions', label: 'Solutions', icon: Layers,     blurb: 'Fit for every trading style' },
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
        aria-label="Menu"
        className="btn-ghost h-11 px-3 sm:px-4"
      >
        <Menu className="size-4 opacity-80" aria-hidden />
        <span className="hidden sm:inline">Menu</span>
        <ChevronDown
          className={`hidden size-3.5 opacity-60 transition-transform duration-200 sm:inline ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="glass absolute right-0 top-[calc(100%+8px)] z-40 w-[272px] overflow-hidden rounded-[14px] border border-line-strong p-1.5 shadow-2xl shadow-black/50"
        >
          {MENU_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="group flex items-start gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors duration-150 hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-ember/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-flame transition-colors duration-150 group-hover:border-ember/30">
                  <Icon className="size-4" strokeWidth={2} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-ink">{item.label}</span>
                  <span className="text-[11px] leading-snug text-ink-3">{item.blurb}</span>
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
 * Marketing header — Ember Terminal idiom: glass bar, hairline bottom border.
 * Products / Solutions / FAQ live in a single Menu dropdown.
 */
export function WelcomeMarketingNav({ onSignIn, onGetStarted }) {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    logout()
    navigate('/welcome', { replace: true })
  }

  return (
    <div className="glass sticky top-0 z-40 border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          to="/welcome"
          className="flex min-w-0 shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <EmberLogo size="xs" layout="horizontal" showTagline={false} />
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <MenuDropdown />

          {isAuthenticated ? (
            <>
              <Link to={getDefaultLanding()} className="btn-primary h-11 px-4">
                Continue to app
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="btn-ghost hidden h-11 px-4 sm:inline-flex"
                aria-label="Sign out"
              >
                <LogOut className="size-3.5 opacity-80" aria-hidden />
                Sign out
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onSignIn} className="btn-ghost hidden h-11 px-4 sm:inline-flex">
                Sign in
              </button>
              <button type="button" onClick={onGetStarted} className="btn-primary h-11 px-3.5 sm:px-4">
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
