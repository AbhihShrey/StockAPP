import { useEffect, useRef, useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { FireSpirit } from './FireSpirit'

const SCROLL_REVEAL_PX = 280

const FAQ = [
  {
    q: 'What is Ember Finances?',
    a: "A focused workspace for reading the market, tracking positions, and stress-testing trading ideas — built for clarity, not clutter.",
  },
  {
    q: 'Is it free to use?',
    a: 'Yes. Sign up takes seconds and gives you the full app. No credit card required.',
  },
  {
    q: 'Where does the market data come from?',
    a: 'Real-time and historical data is sourced from Financial Modeling Prep (FMP). Quotes refresh continuously while the market is open.',
  },
  {
    q: 'How do alerts work?',
    a: 'Set conditions like price-cross, VWAP cross, or earnings-day. Alerts run server-side and ping you in-app, by sound, browser notification, or email.',
  },
  {
    q: 'Is my portfolio data private?',
    a: 'Yes. Your watchlists, alerts, and portfolios are tied to your account and never shared. You can delete them at any time.',
  },
  {
    q: 'Does Ember give trading advice?',
    a: "No. Ember surfaces data and analytics — it doesn't recommend trades. Always do your own research and manage risk.",
  },
  {
    q: 'Can I use it on mobile?',
    a: 'Yes. The whole app is responsive and the dashboard, watchlist, and charts work on phones and tablets.',
  },
]

export function WelcomeFireSpiritQA() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(0)
  const panelRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_REVEAL_PX)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (!panelRef.current) return
      if (panelRef.current.contains(e.target)) return
      if (e.target.closest && e.target.closest('.ember-spirit')) return
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

  if (!scrolled) return null

  return (
    <>
      <FireSpirit onActivate={() => setOpen((v) => !v)} />
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Frequently asked questions"
          className="ember-qa-panel"
          data-no-click-spark
        >
          <div className="ember-qa-header">
            <div className="flex items-center gap-2">
              <span className="ember-qa-pip" aria-hidden />
              <p className="text-sm font-semibold text-zinc-100">Quick questions</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-zinc-500 transition hover:text-zinc-200"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="ember-qa-list">
            {FAQ.map((item, i) => {
              const isOpen = expanded === i
              return (
                <li key={item.q} className={`ember-qa-item${isOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? -1 : i)}
                    className="ember-qa-q"
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`size-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && <p className="ember-qa-a">{item.a}</p>}
                </li>
              )
            })}
          </ul>
          <div className="ember-qa-footer">
            <p className="text-[11px] text-zinc-500">Tap the spirit again to close.</p>
          </div>
        </div>
      )}
    </>
  )
}
