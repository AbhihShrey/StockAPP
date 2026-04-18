import { Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

/** Quick jump back to the marketing / welcome page from inside the app. */
export function MarketingHomeFab() {
  const { pathname } = useLocation()
  if (pathname === '/welcome') return null

  return (
    <Link
      to="/welcome"
      title="Marketing home"
      className="fixed bottom-5 right-5 z-[45] flex size-12 items-center justify-center rounded-full border border-white/10 bg-neutral-900/90 text-zinc-100 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.65)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-neutral-900 hover:text-accent"
    >
      <Home className="size-5" strokeWidth={2} aria-hidden />
    </Link>
  )
}
