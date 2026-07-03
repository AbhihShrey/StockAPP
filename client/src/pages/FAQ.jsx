import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Mail } from 'lucide-react'
import { EmberLogo } from '../components/EmberLogo'

const FAQ_GROUPS = [
  {
    title: 'Getting started',
    items: [
      {
        q: 'What is Ember Finance?',
        a: 'A focused workspace for reading the market, tracking positions, and stress-testing trading ideas — built for clarity, not clutter. The dashboard, charts, watchlist, alerts, sectors, and backtests all live in one place.',
      },
      {
        q: 'Is it free to use?',
        a: 'Yes. Sign up takes seconds and gives you the full app. No credit card required. Some compute-heavy features (like deep backtests) may be paywalled in the future, but the core workspace stays free.',
      },
      {
        q: 'Do I need a brokerage account?',
        a: 'No. Ember Finance is a research and planning tool — there is nothing to link. Sign up, add symbols to a watchlist, set alerts, and you are running.',
      },
      {
        q: 'Can I use it on mobile?',
        a: 'Yes. The dashboard, watchlist, charts, and alerts are responsive and work on phones and tablets. The command bar (⌘K on desktop) is the fastest way to navigate on a laptop.',
      },
    ],
  },
  {
    title: 'Data & accuracy',
    items: [
      {
        q: 'Where does the market data come from?',
        a: 'Real-time and historical price, fundamentals, sector, and economic-calendar data is sourced from Financial Modeling Prep (FMP). Quotes refresh continuously while the U.S. market is open.',
      },
      {
        q: 'How fresh are the quotes?',
        a: 'Watchlist and dashboard quotes refresh every 15 seconds during market hours. Sector strength, breadth, and technical readings refresh on a 5-minute cache so the views stay snappy without hammering the data feed.',
      },
      {
        q: 'Are the backtests realistic?',
        a: 'They model fills at the close of the bar that triggered the signal and benchmark every strategy against buy-and-hold over the same period. Slippage and commissions are not modeled — treat the numbers as a sanity check on the idea, not a P&L forecast.',
      },
    ],
  },
  {
    title: 'Alerts & notifications',
    items: [
      {
        q: 'How do alerts work?',
        a: 'Set a condition (price-cross, VWAP cross, opening-range breakout, earnings day) and Ember runs the check on the server. When it fires you can be pinged in-app, by sound, by browser notification, or by email — toggle each in Settings → Notifications.',
      },
      {
        q: 'Can alerts run while my browser is closed?',
        a: 'Yes. The alert engine runs server-side, so closing the tab does not stop alerts. Email is the most reliable delivery channel when you are away from the device.',
      },
      {
        q: 'Why didn\'t my alert fire?',
        a: 'Most common reasons: the alert is in cooldown after a recent fire, the volume filter excluded the bar, or the time-window filter restricted firing to a narrower part of the session. The Alerts page shows the firing history for every alert.',
      },
    ],
  },
  {
    title: 'Privacy & account',
    items: [
      {
        q: 'Is my portfolio data private?',
        a: 'Yes. Watchlists, alerts, and portfolios are tied to your account and never shared with other users. You can delete any of them at any time from inside the app, or delete the account entirely from Settings.',
      },
      {
        q: 'Do you sell or share my email?',
        a: 'No. Your email is used to log you in and (if you opt in) to send alerts and the daily digest. We never sell email addresses or share them with third-party marketers.',
      },
      {
        q: 'Does Ember give trading advice?',
        a: 'No. Ember surfaces data and analytics — it does not recommend trades. Always do your own research, manage risk, and consult a licensed advisor for personalized advice.',
      },
    ],
  },
  {
    title: 'Appearance & motion',
    items: [
      {
        q: 'Can I reduce animation across the app?',
        a: 'Yes. Ember Finance honors your system\'s reduced-motion setting — page transitions, shimmer, and pulses all switch off automatically. You can also fine-tune appearance from Settings after you sign in.',
      },
      {
        q: 'Is there a light theme?',
        a: 'No. Ember Terminal is a dark trading workspace by design — warm near-black surfaces keep price colors and data easy to read for long sessions.',
      },
    ],
  },
]

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="panel panel-hover overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left outline-none transition-colors duration-150 hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-ember/60"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-ink">{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-flame' : 'text-ink-3'}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-line px-5 py-4">
          <p className="text-base leading-relaxed text-ink-2">{a}</p>
        </div>
      )}
    </li>
  )
}

export function FAQ() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-bg text-ink antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(56rem 38rem at 50% -12%, rgba(255,107,44,0.07), transparent 70%)',
        }}
      />
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

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="rise mb-14 text-center">
          <p className="eyebrow">Support · Frequently asked questions</p>
          <h1 className="display mt-3 text-3xl sm:text-4xl">Things people ask</h1>
          <div className="ember-rule mx-auto mt-5 w-40" aria-hidden />
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-2">
            Quick answers to the most common questions about Ember Finance. Don't see yours? Drop us a line at{' '}
            <a className="text-flame underline-offset-4 hover:underline" href="mailto:support@emberfinances.com">support@emberfinances.com</a>.
          </p>
        </header>

        <div className="space-y-10">
          {FAQ_GROUPS.map((group, gi) => (
            <section key={group.title} className={`rise rise-${gi + 2}`}>
              <h2 className="eyebrow mb-3">{group.title}</h2>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <AccordionItem key={item.q} q={item.q} a={item.a} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="panel mt-16 overflow-hidden">
          <div className="ember-rule" aria-hidden />
          <div className="px-6 py-8 text-center">
            <p className="font-display text-base font-semibold text-ink">Still curious?</p>
            <p className="mt-1 text-sm text-ink-2">Sign up free and explore the workspace yourself — most questions answer themselves once you're in.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/welcome" className="btn-primary h-11 px-5">
                Get started
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="mailto:support@emberfinances.com" className="btn-ghost h-11 px-5">
                <Mail className="size-4 opacity-80" aria-hidden />
                Email support
              </a>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 border-t border-line py-10 text-center">
        <p className="text-xs text-ink-3">© {new Date().getFullYear()} Ember Finance · For informational purposes only.</p>
      </footer>
    </div>
  )
}
