import { ArrowUpRight, Bookmark } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'
import { FlameSpinner } from './FlameSpinner'

function PctPill({ value }) {
  if (value == null) return <span className="num text-ink-3">—</span>
  const up = value > 0
  const down = value < 0
  const cls = up ? 'chip chip-up' : down ? 'chip chip-down' : 'chip'
  const sign = up ? '+' : ''
  return (
    <span className={`${cls} num`}>
      <span aria-hidden>{up ? '▲' : down ? '▼' : ''}</span>
      {sign}{value.toFixed(2)}%
    </span>
  )
}

/** Tracks previous price per symbol and returns a flash class when it changes. */
function usePriceFlash(items) {
  const prevRef = useRef({})
  const [flashes, setFlashes] = useState({})

  useEffect(() => {
    const next = {}
    const newFlashes = {}
    let changed = false
    for (const item of items) {
      const prev = prevRef.current[item.symbol]
      if (prev != null && item.price != null && prev !== item.price) {
        newFlashes[item.symbol] = item.price > prev ? 'up' : 'down'
        changed = true
      }
      next[item.symbol] = item.price
    }
    prevRef.current = next
    if (changed) {
      setFlashes(newFlashes)
      const t = setTimeout(() => setFlashes({}), 1000)
      return () => clearTimeout(t)
    }
  }, [items])

  return flashes
}

export function WatchlistMiniWidget() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const flashes = usePriceFlash(items)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(apiUrl('/api/watchlist'), { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setItems(j.items ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token) return
    const id = window.setInterval(() => {
      fetch(apiUrl('/api/watchlist'), { headers: authHeaders(token) })
        .then((r) => r.json())
        .then((j) => { if (j.ok) setItems(j.items ?? []) })
        .catch(() => {})
    }, 30_000)
    return () => window.clearInterval(id)
  }, [token])

  const preview = items.slice(0, 8)

  return (
    <div className="flex h-full flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-8" aria-busy aria-label="Loading watchlist">
          <FlameSpinner size={18} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <Bookmark className="size-8 text-ink-3" aria-hidden />
          <p className="text-sm text-ink-2">Your watchlist is empty.</p>
          <Link to="/watchlist" className="btn-ghost h-8 px-3 text-xs">
            Add stocks
          </Link>
        </div>
      ) : (
        <>
          <div className="tbl min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Price</th>
                  <th className="num">Chg%</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const flash = flashes[row.symbol]
                  return (
                    <tr
                      key={row.symbol}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${row.symbol} analysis`}
                      onClick={() => navigate(`/analysis/${row.symbol}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/analysis/${row.symbol}`) }}
                      className={[
                        'group cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ember/60',
                        flash === 'up' ? 'bg-up/10' : flash === 'down' ? 'bg-down/10' : '',
                      ].join(' ')}
                    >
                      <td>
                        <span className="num inline-flex items-center gap-1.5 font-semibold text-ink">
                          {row.symbol}
                          <ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-60" aria-hidden />
                        </span>
                      </td>
                      <td className="num">
                        {row.price != null ? `$${row.price.toFixed(2)}` : '—'}
                      </td>
                      <td className="num">
                        <PctPill value={row.changePercent} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {items.length > 8 && (
            <div className="border-t border-line px-4 py-2.5 text-center">
              <Link to="/watchlist" className="text-xs text-ink-3 transition-colors duration-150 hover:text-ink-2">
                +{items.length - 8} more · Manage watchlist →
              </Link>
            </div>
          )}
          {items.length <= 8 && (
            <div className="border-t border-line px-4 py-2.5 text-right">
              <Link to="/watchlist" className="text-xs text-ink-3 transition-colors duration-150 hover:text-ink-2">
                Manage watchlist →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
