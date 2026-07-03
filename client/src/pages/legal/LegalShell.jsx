import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmberLogo } from '../../components/EmberLogo'

const FOOTER_LINKS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/disclaimer', label: 'Disclaimer' },
  { to: '/cookies', label: 'Cookies' },
]

export function LegalShell({ title, lastUpdated, children }) {
  return (
    <div className="min-h-dvh bg-bg text-ink antialiased">
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

      <main className="mx-auto max-w-prose px-4 py-14 sm:px-6 sm:py-20">
        <header className="rise">
          <p className="eyebrow">Legal · Ember Finance</p>
          <h1 className="display mt-3 text-3xl sm:text-4xl">{title}</h1>
          {lastUpdated && (
            <p className="num mt-3 text-xs uppercase tracking-wider text-ink-3">
              Last updated {lastUpdated}
            </p>
          )}
          <div className="ember-rule mt-6" aria-hidden />
        </header>

        <div className="legal-prose rise rise-2 mt-8 space-y-5 text-base leading-[1.65] text-ink-2 [&_a]:text-flame [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5">
          {children}
        </div>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-prose flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between">
          <p className="text-xs text-ink-3">
            © {new Date().getFullYear()} Ember Finance · For informational purposes only.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-3">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="transition-colors duration-150 hover:text-flame"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
