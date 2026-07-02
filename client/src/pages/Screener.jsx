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
    <div className="app-page-enter space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">Screener</h1>
        <p className="text-sm text-zinc-500">
          Find stocks approaching a strategy target — and converging on it — or filter the market by the classics.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border-subtle bg-surface-1/40 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-lg px-4 py-2 text-xs font-medium transition',
              tab === t.id
                ? 'bg-accent-muted text-accent accent-inset'
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'strategy' ? <StrategyScreener token={token} /> : <ClassicScreener token={token} />}
    </div>
  )
}
