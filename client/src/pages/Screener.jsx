import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ClassicScreener } from '../components/screener/ClassicScreener'
import { StrategyScreener } from '../components/screener/StrategyScreener'

const TABS = [
  { id: 'strategy', label: 'Strategy proximity' },
  { id: 'classic', label: 'Classic filters' },
]

export function Screener() {
  const { token } = useAuth()
  const [tab, setTab] = useState('strategy')

  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">Screener · US equities</p>
        <h1 className="display mt-1 text-2xl sm:text-3xl">Screener</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          Find stocks approaching a strategy target — and converging on it — or filter the market by the classics.
        </p>
        <div className="ember-rule mt-4" aria-hidden />
      </header>

      <div
        className="rise rise-1 inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-1 p-1"
        role="tablist"
        aria-label="Screener mode"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              'rounded-lg px-4 py-2.5 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
              tab === t.id
                ? 'bg-ember/10 text-flame'
                : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rise rise-2">
        {tab === 'strategy' ? <StrategyScreener token={token} /> : <ClassicScreener token={token} />}
      </section>
    </div>
  )
}
