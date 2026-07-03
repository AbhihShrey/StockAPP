import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

const CONSENSUS_STYLES = {
  SB: { label: 'Strong Buy',  text: 'text-up',   bg: 'bg-up/15',   ring: 'ring-up/40' },
  B:  { label: 'Buy',         text: 'text-up',   bg: 'bg-up/10',   ring: 'ring-up/30' },
  H:  { label: 'Hold',        text: 'text-warn', bg: 'bg-warn/10', ring: 'ring-warn/30' },
  S:  { label: 'Sell',        text: 'text-down', bg: 'bg-down/10', ring: 'ring-down/30' },
  SS: { label: 'Strong Sell', text: 'text-down', bg: 'bg-down/15', ring: 'ring-down/40' },
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
    <div className="space-y-4" aria-busy aria-label="Loading analyst coverage">
      <div className="skeleton h-7 w-48" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
      <div className="skeleton h-3 w-full" />
      <div className="space-y-2">
        <div className="skeleton h-8 w-full" />
        <div className="skeleton h-8 w-full" />
        <div className="skeleton h-8 w-full" />
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
      <div className="num flex items-center justify-between text-[11px] text-ink-3">
        <span>Low {fmtPrice(low)}</span>
        <span>High {fmtPrice(high)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-down/40 via-warn/40 to-up/40">
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-bg"
          style={{ left: `${pct}%` }}
          title={`Current: ${fmtPrice(current)}`}
        />
      </div>
      <div className="num text-center text-[11px] text-ink-3">
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
    <section className="panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-[14px] px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
      >
        <div className="flex items-center gap-3">
          <Users className="size-4 text-ink-2" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            Analyst coverage — {symbol}
          </h2>
          {!loading && rating?.consensus?.code ? (
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${CONSENSUS_STYLES[rating.consensus.code]?.bg ?? ''} ${CONSENSUS_STYLES[rating.consensus.code]?.text ?? ''} ${CONSENSUS_STYLES[rating.consensus.code]?.ring ?? ''}`}>
              {CONSENSUS_STYLES[rating.consensus.code]?.label}
            </span>
          ) : null}
        </div>
        {open ? <ChevronUp className="size-4 text-ink-3" /> : <ChevronDown className="size-4 text-ink-3" />}
      </button>

      {open ? (
        <div className="border-t border-line p-5">
          {loading ? (
            <SkeletonPanel />
          ) : errored ? (
            <p className="text-sm text-ink-3">Analyst coverage unavailable.</p>
          ) : (
            <div className="space-y-6">
              {/* Top row — consensus + stat cards */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-start gap-2">
                  {rating.consensus?.code ? <ConsensusBadge code={rating.consensus.code} /> : null}
                  <p className="text-xs text-ink-3">
                    {rating.analystCount > 0 ? `${rating.analystCount} analyst${rating.analystCount === 1 ? '' : 's'}` : 'No price targets'}
                    {rating.consensus?.total ? ` · ${rating.consensus.total} ratings` : null}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="eyebrow text-[11px]">Avg target</p>
                    <p className="num mt-1 text-base font-semibold text-ink">{fmtPrice(rating.avgTarget)}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="eyebrow text-[11px]">High</p>
                    <p className="num mt-1 text-base font-semibold text-up">{fmtPrice(rating.highTarget)}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="eyebrow text-[11px]">Low</p>
                    <p className="num mt-1 text-base font-semibold text-down">{fmtPrice(rating.lowTarget)}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2 p-3">
                    <p className="eyebrow text-[11px]">Upside</p>
                    <p className={`num mt-1 inline-flex items-center gap-1 text-base font-semibold ${upside == null ? 'text-ink-3' : upside >= 0 ? 'text-up' : 'text-down'}`}>
                      {upside != null ? (upside >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />) : null}
                      {fmtPct(upside)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Range bar */}
              {rating.lowTarget != null && rating.highTarget != null && currentPrice != null ? (
                <div className="rounded-xl border border-line bg-surface-2 p-4">
                  <RangeBar low={rating.lowTarget} high={rating.highTarget} current={currentPrice} />
                </div>
              ) : null}

              {/* Recent changes table */}
              {rating.recentChanges?.length ? (
                <div>
                  <h3 className="eyebrow mb-2">Recent rating changes</h3>
                  <div className="tbl">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Firm</th>
                          <th>Analyst</th>
                          <th className="num">Price target</th>
                          <th className="num">When posted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rating.recentChanges.map((r, i) => (
                          <tr key={`${r.date}-${r.firm}-${i}`}>
                            <td className="num whitespace-nowrap text-ink-2">{fmtDate(r.date)}</td>
                            <td className="text-ink">{r.firm ?? '—'}</td>
                            <td className="text-ink-2">{r.analyst ?? '—'}</td>
                            <td className="num font-semibold text-ink">{fmtPrice(r.priceTarget)}</td>
                            <td className="num text-ink-3">{fmtPrice(r.priceWhenPosted)}</td>
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
  if (!style) return <span className="text-ink-3">—</span>
  return (
    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${style.bg} ${style.text} ${style.ring}`}>
      {code}
    </span>
  )
}
