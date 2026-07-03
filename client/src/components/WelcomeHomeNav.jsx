import { Home, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'

/** App sidebar footer: home link + sign out. */
export function WelcomeHomeNav({ collapsed, user, onSignOut, onNavigate }) {
  const afterNav = () => {
    onNavigate?.()
  }

  const btnBase =
    'inline-flex items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-3 transition-colors duration-200 hover:border-line-strong hover:bg-surface-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-ember/60 outline-none'

  return (
    <div
      className={['mt-2 flex gap-1.5', collapsed ? 'flex-col items-center' : 'items-center'].join(' ')}
      aria-label="Home and session"
    >
      <Link to="/welcome" onClick={afterNav} className={`${btnBase} size-9`} title="Home" aria-label="Home">
        <Home className="size-4" strokeWidth={2} aria-hidden />
      </Link>
      {user ? (
        <button
          type="button"
          onClick={() => onSignOut()}
          className={`${btnBase} size-9 hover:text-down`}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="size-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
