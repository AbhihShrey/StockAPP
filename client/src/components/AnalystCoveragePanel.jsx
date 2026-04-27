import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

const CONSENSUS_STYLES = {
  SB: { label: 'Strong Buy', text: 'text-emerald-300', bg: 'bg-emerald-500/15', ring: 'ring-emerald-400/40' },
  B:  { label: 'Buy',        text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-400/30' },
  H:  { label: 'Hold',       text: 'text-amber-300',   bg: 'bg-amber-500/10',   ring: 'ring-amber-400/30' },
  S:  { label: 'Sell',       text: 'text-rose-400',    bg: 'bg-rose-500/10',    ring: 'ring-rose-400/30' },
  SS: { label: 'Strong Sell', text: 'text-rose-300',   bg: 'bg-rose-500/15',    ring: 'ring-rose-400/40' },
}

function fmtPrice(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SkeletonPanel() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-48 rounded bg-white/5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="h-3 w-full rounded bg-white/5" />
      <div className="space-y-2">
        <div className="h-8 w-full rounded bg-white/5" />
        <div className="h-8 w-full rounded bg-white/5" />
        <div className="h-8 w-full rounded bg-white/5" />
      </div>
    </div>
  )
}

function ConsensusBadge({ code }) {
  const style = CONSENSUS_STYLES[code] ?? CONSENSUS_STYLES.H
  return (
    <div className={`inline-flex items-center rounded-xl px-4 py-2 ring-1 ${style.bg} ${style.ring}`}>
      <span className={`text-xl font-bold tracking-tight ${style.text}`}>{style.label}</span>
    </div>
  )
}

function RangeBar({ low, high, current }) {
  if (low == null || high == null || current == null || high <= low) return null
  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>Low {fmtPrice(low)}</span>
        <span>High {fmtPrice(high)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-rose-500/40 via-amber-500/40 to-emerald-500/40">
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-100 ring-2 ring-zinc-950"
          style={{ left: `${pct}%` }}
          title={`Current: ${fmtPrice(current)}`}
        />
      </div>
      <div className="text-center text-[11px] text-zinc-500">
        Current {fmtPrice(current)}
      </div>
    </div>
  )
}

export function AnalystCoveragePanel({ symbol, currentPrice }) {
  const { token } = useAuth()
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(null)
  const [errored, setErrored] = useState(false)

  const load = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setErrored(false)
    try {
      const res = await fetch(
        apiUrl(`/api/analyst-rating/${encodeURIComponent(symbol)}`),
        { headers: authHeaders(token) },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrored(true)
        setRating(null)
      } else {
        setRating(json.rating ?? null)
      }
    } catch {
      setErrored(true)
      setRating(null)
    } finally {
      setLoading(false)
    }
  }, [symbol, token])

  useEffect(() => { load() }, [load])

  // Gracefully hide if no data and not loading/erroring
  if (!loading && !errored && !rating) return null

  const upside =
    rating?.avgTarget != null && currentPrice != null && currentPrice > 0
      ? ((rating.avgTarget - currentPrice) / currentPrice) * 100
      : null

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-1/60 shadow-xl shadow-black/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Users className="size-4 text-zinc-400" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
            Analyst coverage — {symbol}
          </h2>
          {!loading && rating?.consensus?.code ? (
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${CONSENSUS_STYLES[rating.consensus.code]?.bg ?? ''} ${CONSENSUS_STYLES[rating.consensus.code]?.text ?? ''} ${CONSENSUS_STYLES[rating.consensus.code]?.ring ?? ''}`}>
              {CONSENSUS_STYLES[rating.consensus.code]?.label}
            </span>
          ) : null}
        </div>
        {open ? <ChevronUp className="size-4 text-zinc-500" /> : <ChevronDown className="size-4 text-zinc-500" />}
      </button>

      {open ? (
        <div className="border-t border-border-subtle p-5">
          {loading ? (
            <SkeletonPanel />
          ) : errored ? (
            <p className="text-sm text-zinc-500">Analyst coverage unavailable.</p>
          ) : (
            <div className="space-y-6">
              {/* Top row — consensus + stat cards */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-start gap-2">
                  {rating.consensus?.code ? <ConsensusBadge code={rating.consensus.code} /> : null}
                  <p className="text-xs text-zinc-500">
                    {rating.analystCount > 0 ? `${rating.analystCount} analyst${rating.analystCount === 1 ? '' : 's'}` : 'No price targets'}
                    {rating.consensus?.total ? ` · ${rating.consensus.total} ratings` : null}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Avg target</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-zinc-100">{fmtPrice(rating.avgTarget)}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">High</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-emerald-400">{fmtPrice(rating.highTarget)}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Low</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-rose-400">{fmtPrice(rating.lowTarget)}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Upside</p>
                    <p className={`mt-1 inline-flex items-center gap-1 text-base font-semibold tabular-nums ${upside == null ? 'text-zinc-500' : upside >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {upside != null ? (upside >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />) : null}
                      {fmtPct(upside)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Range bar */}
              {rating.lowTarget != null && rating.highTarget != null && currentPrice != null ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <RangeBar low={rating.lowTarget} high={rating.highTarget} current={currentPrice} />
                </div>
              ) : null}

              {/* Recent changes table */}
              {rating.recentChanges?.length ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent rating changes</h3>
                  <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Firm</th>
                          <th className="px-3 py-2 font-medium">Analyst</th>
                          <th className="px-3 py-2 text-right font-medium">Price target</th>
                          <th className="px-3 py-2 text-right font-medium">When posted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/70">
                        {rating.recentChanges.map((r, i) => (
                          <tr key={`${r.date}-${r.firm}-${i}`} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{fmtDate(r.date)}</td>
                            <td className="px-3 py-2 text-zinc-200">{r.firm ?? '—'}</td>
                            <td className="px-3 py-2 text-zinc-400">{r.analyst ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-zinc-100">{fmtPrice(r.priceTarget)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{fmtPrice(r.priceWhenPosted)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Compact consensus pill (for table cells).
 * code: 'SB' | 'B' | 'H' | 'S' | 'SS'
 */
export function ConsensusPill({ code }) {
  const style = CONSENSUS_STYLES[code]
  if (!style) return <span className="text-zinc-600">—</span>
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${style.bg} ${style.text} ${style.ring}`}>
      {code}
    </span>
  )
}
