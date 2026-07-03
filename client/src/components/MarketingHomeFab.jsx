import { Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

/** Quick jump back to the marketing / welcome page from inside the app. */
export function MarketingHomeFab() {
  const { pathname } = useLocation()
  if (pathname === '/welcome') return null

  return (
    <Link
      to="/welcome"
      title="Ember Finance home"
      className="glass fixed bottom-5 right-5 z-[45] flex size-12 items-center justify-center rounded-full border border-line text-ink-2 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.65)] transition-colors duration-200 hover:border-ember/40 hover:text-flame focus-visible:ring-2 focus-visible:ring-ember/60 outline-none"
    >
      <Home className="size-5" strokeWidth={2} aria-hidden />
    </Link>
  )
}
