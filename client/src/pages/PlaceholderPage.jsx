import { Link, useLocation } from 'react-router-dom'

const TITLES = {
  '/products': 'Products',
  '/solutions': 'Solutions',
  '/enterprise': 'Enterprise',
  '/pricing': 'Pricing',
  '/contact': 'Contact sales',
  '/app': 'Get the app',
}

export function PlaceholderPage() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Page'

  return (
    <div className="min-h-dvh bg-surface-0 text-zinc-200 antialiased">
      <header className="border-b border-border-subtle bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/welcome" className="text-sm font-semibold tracking-tight text-zinc-100 hover:text-accent">
            InvestAIV1
          </Link>
          <Link
            to="/welcome"
            className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            ← Back
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{title}</h1>
        <p className="mt-4 text-zinc-500">This page is reserved for future content.</p>
        <Link
          to="/welcome"
          className="mt-10 inline-flex rounded-full border border-border-subtle bg-surface-1/60 px-6 py-2.5 text-sm font-semibold text-zinc-100 shadow-lg shadow-black/30 transition hover:border-white/15 hover:bg-surface-1/80"
        >
          Return home
        </Link>
      </main>
    </div>
  )
}
