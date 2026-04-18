import { Home, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * App sidebar: compact icon row to welcome (without sign-out).
 */
export function WelcomeHomeNav({ collapsed, user, onSignOut, onNavigate }) {
  const afterNav = () => {
    onNavigate?.()
  }

  const btnBase =
    'inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-zinc-100'

  if (collapsed) {
    return (
      <div className="mt-2 flex flex-col items-center gap-1.5" aria-label="Home and session">
        <Link
          to="/welcome"
          onClick={afterNav}
          className={`${btnBase} size-9`}
          title="Welcome"
          aria-label="Welcome"
        >
          <Home className="size-4" strokeWidth={2} aria-hidden />
        </Link>
        {user ? (
          <button
            type="button"
            onClick={() => onSignOut()}
            className={`${btnBase} size-9 hover:text-rose-300`}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="size-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <Link
        to="/welcome"
        onClick={afterNav}
        className={`${btnBase} size-9`}
        title="Welcome"
        aria-label="Welcome"
      >
        <Home className="size-4" strokeWidth={2} aria-hidden />
      </Link>
      {user ? (
        <button
          type="button"
          onClick={() => onSignOut()}
          className={`${btnBase} size-9 hover:text-rose-300`}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="size-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
