import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Flame, HelpCircle, Mail, Sparkles } from 'lucide-react'
import { EmberLogo } from '../components/EmberLogo'

const FAQ_GROUPS = [
  {
    title: 'Getting started',
    items: [
      {
        q: 'What is Ember Finances?',
        a: 'A focused workspace for reading the market, tracking positions, and stress-testing trading ideas — built for clarity, not clutter. The dashboard, charts, watchlist, alerts, sectors, and backtests all live in one place.',
      },
      {
        q: 'Is it free to use?',
        a: 'Yes. Sign up takes seconds and gives you the full app. No credit card required. Some compute-heavy features (like deep backtests) may be paywalled in the future, but the core workspace stays free.',
      },
      {
        q: 'Do I need a brokerage account?',
        a: 'No. Ember Finances is a research and planning tool — there is nothing to link. Sign up, add symbols to a watchlist, set alerts, and you are running.',
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
    title: 'The fire spirit',
    items: [
      {
        q: 'What is the little flame in the corner?',
        a: 'That\'s the Ember mascot — a quick way to open this FAQ from anywhere on the welcome page. Click it and a panel slides up with the most-common questions. It\'s purely decorative and doesn\'t collect any data.',
      },
      {
        q: 'Can I turn the mascot off?',
        a: 'Yes. After you sign in, go to Settings → Appearance and toggle "Ember mascot" off. The same panel also lets you disable click sparks, fire crackle sound, and reduce motion.',
      },
    ],
  },
]

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={`overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] transition ${open ? 'shadow-[0_0_24px_-12px_rgba(255,106,44,0.45)]' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.04]"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-zinc-100">{q}</span>
        <ChevronDown className={`size-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180 text-accent' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-5 py-4">
          <p className="text-sm leading-relaxed text-zinc-400">{a}</p>
        </div>
      )}
    </li>
  )
}

export function FAQ() {
  return (
    <div className="min-h-dvh bg-surface-0 text-zinc-200 antialiased">
      <header className="glass-bar sticky top-0 z-30 border-b border-white/[0.05]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/welcome">
            <EmberLogo size="xs" layout="horizontal" showTagline={false} />
          </Link>
          <Link
            to="/welcome"
            className="glass-btn inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-medium text-zinc-300 hover:text-zinc-100"
          >
            ← Back
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-14 text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <HelpCircle className="size-3.5 text-accent" />
            Frequently asked questions
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">Things people ask</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-base">
            Quick answers to the most common questions about Ember Finances. Don't see yours? Drop us a line at{' '}
            <a className="text-accent hover:underline" href="mailto:support@emberfinances.com">support@emberfinances.com</a>.
          </p>
          <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.06] px-3 py-1 text-[11px] font-medium text-accent">
            <Flame className="size-3" /> Tip — the flame mascot in the corner of the welcome page opens these too.
          </p>
        </div>

        <div className="space-y-10">
          {FAQ_GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Sparkles className="size-3 text-accent" /> {group.title}
              </h2>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <AccordionItem key={item.q} q={item.q} a={item.a} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-8 text-center">
          <p className="text-base font-medium text-zinc-100">Still curious?</p>
          <p className="mt-1 text-sm text-zinc-500">Sign up free and explore the workspace yourself — most questions answer themselves once you're in.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/welcome"
              className="glass-btn--accent ember-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              Get started <ArrowRight className="size-4" />
            </Link>
            <a
              href="mailto:support@emberfinances.com"
              className="glass-btn inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-200"
            >
              <Mail className="size-4 opacity-80" /> Email support
            </a>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/[0.06] py-8 text-center">
        <p className="text-xs text-zinc-600">© {new Date().getFullYear()} Ember Finances · For informational purposes only.</p>
      </footer>
    </div>
  )
}
