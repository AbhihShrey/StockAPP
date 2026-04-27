import { Link } from 'react-router-dom'
import { VertexLogo } from '../../components/VertexLogo'

const FOOTER_LINKS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/disclaimer', label: 'Disclaimer' },
  { to: '/cookies', label: 'Cookies' },
]

export function LegalShell({ title, lastUpdated, children }) {
  return (
    <div className="min-h-dvh bg-surface-0 text-zinc-200 antialiased">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-surface-0/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/welcome">
            <VertexLogo size="xs" layout="horizontal" showTagline={false} />
          </Link>
          <Link
            to="/welcome"
            className="text-sm font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-200 hover:underline"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">{title}</h1>
        {lastUpdated && (
          <p className="mt-2 text-xs uppercase tracking-wider text-zinc-600">Last updated {lastUpdated}</p>
        )}
        <div className="legal-prose mt-8 space-y-5 text-sm leading-relaxed text-zinc-400 [&_a]:text-accent [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-zinc-100 [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_strong]:text-zinc-200 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5">
          {children}
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between">
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} Vertex · For informational purposes only.</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="transition hover:text-zinc-300">{l.label}</Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
