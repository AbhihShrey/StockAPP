import { ArrowUpRight, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

function PctPill({ value }) {
  if (value == null) return <span className="text-zinc-600">—</span>
  const up = value > 0
  const down = value < 0
  const cls = up
    ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
    : down
      ? 'bg-rose-500/10 text-rose-300 ring-rose-500/20'
      : 'bg-white/5 text-zinc-400 ring-white/10'
  const sign = up ? '+' : ''
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ring-1 ${cls}`}>
      {sign}{value.toFixed(2)}%
    </span>
  )
}

export function WatchlistMiniWidget() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

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
        <div className="flex flex-1 items-center justify-center py-8 text-zinc-600">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <p className="text-sm text-zinc-500">Your watchlist is empty.</p>
          <Link
            to="/watchlist"
            className="text-xs font-medium text-accent hover:underline"
          >
            Add stocks →
          </Link>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-neutral-900/80 text-[11px] uppercase tracking-wide text-zinc-600 backdrop-blur">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2 text-left font-medium">Symbol</th>
                  <th className="px-4 py-2 text-right font-medium">Price</th>
                  <th className="px-4 py-2 text-right font-medium">Chg%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {preview.map((row) => (
                  <tr
                    key={row.symbol}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/analysis/${row.symbol}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/analysis/${row.symbol}`) }}
                    className="group cursor-pointer transition-colors hover:bg-white/5"
                  >
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-100">
                        {row.symbol}
                        <ArrowUpRight className="size-3 opacity-0 transition group-hover:opacity-50" aria-hidden />
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">
                      {row.price != null ? `$${row.price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <PctPill value={row.changePercent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > 8 && (
            <div className="border-t border-white/[0.06] px-4 py-2.5 text-center">
              <Link to="/watchlist" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                +{items.length - 8} more · Manage watchlist →
              </Link>
            </div>
          )}
          {items.length <= 8 && (
            <div className="border-t border-white/[0.06] px-4 py-2.5 text-right">
              <Link to="/watchlist" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                Manage watchlist →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
