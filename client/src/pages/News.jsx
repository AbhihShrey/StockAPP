import { Minus, Moon, Sun } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NewsMasterDetail } from '../components/NewsMasterDetail'
import { IpoCalendarTab } from '../components/news/IpoCalendarTab'
import { TableShell } from '../components/TableShell'
import { apiUrl } from '../lib/apiBase'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function fmtPct(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function fmtEps(v) {
  if (v === null || v === undefined || String(v).trim() === '') return '—'
  const n = Number(String(v).replace(/[%,$\s]/g, '').replace(/,/g, ''))
  if (Number.isFinite(n)) return n.toFixed(2)
  return String(v)
}

function fmtMacro(v) {
  if (v === null || v === undefined || String(v).trim() === '') return '—'
  return String(v).trim()
}

function fmtWhen(raw) {
  if (!raw) return '—'
  const s = String(raw).replace('T', ' ')
  if (s.length < 16) return s.slice(0, 10)
  const [hhStr, mmStr] = s.slice(11, 16).split(':')
  const hh = Number(hhStr)
  const mm = Number(mmStr)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return s.slice(0, 16)
  const period = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 || 12
  return `${s.slice(0, 10)} ${h12}:${String(mm).padStart(2, '0')} ${period}`
}

function SessionIcon({ hint }) {
  if (hint === 'bmo') return <Sun className="size-4 text-amber-200/90" aria-label="Before market open" />
  if (hint === 'amc') return <Moon className="size-4 text-indigo-200/90" aria-label="After market close" />
  return <Minus className="size-4 text-zinc-600" aria-label="Time unknown" />
}

/** Solid fills + light border; matches earnings label typography. */
const IMPACT_PILL = {
  high: {
    label: 'HIGH',
    title: 'High impact',
    className: 'border border-rose-400/55 bg-rose-700',
    textClass: 'text-rose-50',
  },
  medium: {
    label: 'MED',
    title: 'Medium impact',
    className: 'border border-amber-400/50 bg-amber-700',
    textClass: 'text-amber-50',
  },
  low: {
    label: 'LOW',
    title: 'Low impact',
    className: 'border border-zinc-500/45 bg-zinc-700',
    textClass: 'text-zinc-100',
  },
}

function ImpactPill({ level }) {
  const cfg = IMPACT_PILL[level] ?? IMPACT_PILL.low
  return (
    <span
      className={[
        'inline-flex min-w-[3.25rem] items-center justify-center rounded-full px-2.5 py-1',
        cfg.className,
      ].join(' ')}
      title={cfg.title}
      aria-label={cfg.title}
    >
      <span
        className={['whitespace-nowrap text-[11px] font-semibold tracking-wide', cfg.textClass].join(' ')}
      >
        {cfg.label}
      </span>
    </span>
  )
}

function ImpactLegendBox() {
  return (
    <div className="ml-auto flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface-1/60 px-2.5 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Impact</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <ImpactPill level="high" />
        <ImpactPill level="medium" />
        <ImpactPill level="low" />
      </div>
    </div>
  )
}

/** Sticky thead: frosted bar + upward strip (same layer as sticky) to mask scroll leak above headers. */
const STICKY_TABLE_HEAD =
  'sticky top-0 z-30 border-b border-white/10 bg-surface-0/85 text-[11px] uppercase tracking-wide text-zinc-500 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-surface-0/75 [&_th]:relative [&_th]:z-10 before:pointer-events-none before:absolute before:inset-x-0 before:-top-4 before:z-[1] before:h-4 before:bg-surface-0/90 before:backdrop-blur-xl before:backdrop-saturate-150 before:supports-[backdrop-filter]:bg-surface-0/80'

function ActualMacroValue({ eventKey, value }) {
  const s = fmtMacro(value)
  if (s === '—') {
    return <span className="text-zinc-600">—</span>
  }
  return (
    <span key={`${eventKey}-${s}`} className="econ-actual-in inline-block font-medium tabular-nums text-zinc-100">
      {s}
    </span>
  )
}

export function News() {
  const [mode, setMode] = useState('market')
  const [date, setDate] = useState(todayISO)
  const [calLoading, setCalLoading] = useState(false)
  const [errorEarn, setErrorEarn] = useState(null)
  const [errorEcon, setErrorEcon] = useState(null)
  const [earnRows, setEarnRows] = useState([])
  const [econRows, setEconRows] = useState([])

  useEffect(() => {
    if (mode !== 'earnings' && mode !== 'economic') return
    let cancelled = false
    async function load() {
      setCalLoading(true)
      setErrorEarn(null)
      setErrorEcon(null)
      try {
        const [earnRes, econRes] = await Promise.all([
          fetch(apiUrl(`/api/earnings-calendar?date=${encodeURIComponent(date)}`)),
          fetch(apiUrl(`/api/economic-calendar?date=${encodeURIComponent(date)}`)),
        ])
        const earnJson = await earnRes.json().catch(() => null)
        const econJson = await econRes.json().catch(() => null)
        if (!cancelled) {
          if (earnRes.ok) setEarnRows(Array.isArray(earnJson?.rows) ? earnJson.rows : [])
          else setErrorEarn(earnJson?.message ?? 'Failed to load earnings calendar')
          if (econRes.ok) setEconRows(Array.isArray(econJson?.rows) ? econJson.rows : [])
          else setErrorEcon(econJson?.message ?? 'Failed to load economic calendar')
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Unknown error'
          setErrorEarn(msg)
          setErrorEcon(msg)
        }
      } finally {
        if (!cancelled) setCalLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [date, mode])

  const mainRows = useMemo(() => earnRows.slice(0, 200), [earnRows])

  const { maxBeatSurprise, maxMissSurpriseAbs } = useMemo(() => {
    let maxB = 0
    let maxM = 0
    for (const r of mainRows) {
      const sp = r.surprisePct
      if (!Number.isFinite(sp)) continue
      if (r.result === 'BEAT' && sp > maxB) maxB = sp
      if (r.result === 'MISS' && sp < 0 && Math.abs(sp) > maxM) maxM = Math.abs(sp)
    }
    return { maxBeatSurprise: maxB || 1, maxMissSurpriseAbs: maxM || 1 }
  }, [mainRows])

  function barWidthFrac(result, surprisePct) {
    if (!Number.isFinite(surprisePct)) return 0
    if (result === 'BEAT' && surprisePct > 0) {
      const raw = (surprisePct / maxBeatSurprise) * 100
      return Math.min(100, Math.max(10, raw))
    }
    if (result === 'MISS' && surprisePct < 0) {
      const raw = (Math.abs(surprisePct) / maxMissSurpriseAbs) * 100
      return Math.min(100, Math.max(10, raw))
    }
    return 0
  }

  function barHeightPx(widthFrac) {
    const base = 28
    const extra = (widthFrac / 100) * 14
    return Math.round(base + extra)
  }

  const tabBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setMode(id)}
      className={[
        'rounded-lg px-4 py-2 text-xs font-medium transition',
        mode === id
          ? 'bg-accent-muted text-accent accent-inset'
          : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
      ].join(' ')}
    >
      {label}
    </button>
  )

  return (
    <div className="app-page-enter space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">News</h1>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface-1/40 p-2">
        {tabBtn('market', 'Market news')}
        {tabBtn('earnings', 'Earnings')}
        {tabBtn('economic', 'Economic')}
        {tabBtn('ipo', 'IPO Calendar')}
      </div>

      {mode !== 'market' && mode !== 'ipo' ? (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-subtle bg-surface-1/60 p-4 shadow-xl shadow-black/25 backdrop-blur-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {mode === 'earnings' ? 'Earnings date' : 'Week starting'}
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-0/60 px-3 py-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value || todayISO())}
                className="bg-transparent text-sm text-zinc-100 outline-none"
              />
            </div>
          </div>
          {mode === 'earnings' ? (
            <p className="ml-auto text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Sun className="size-3.5 text-amber-200/80" aria-hidden />
                BMO
              </span>{' '}
              ·{' '}
              <span className="inline-flex items-center gap-1">
                <Moon className="size-3.5 text-indigo-200/80" aria-hidden />
                AMC
              </span>
            </p>
          ) : (
            <ImpactLegendBox />
          )}
        </section>
      ) : null}

      {mode === 'market' ? (
        <NewsMasterDetail />
      ) : mode === 'ipo' ? (
        <IpoCalendarTab />
      ) : calLoading ? (
        <section className="rounded-2xl border border-border-subtle bg-surface-1/60 p-8 text-center text-sm text-zinc-500">
          Loading…
        </section>
      ) : mode === 'earnings' ? (
        errorEarn ? (
          <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-200">
            <p className="font-medium">Couldn’t load earnings</p>
            <p className="mt-1 text-rose-200/80">{errorEarn}</p>
          </section>
        ) : (
          <TableShell
            title="Earnings calendar"
            subtitle="Sorted by surprise %. Bars show the gap between estimated and actual EPS."
          >
            <div className="relative isolate max-h-[34rem] overflow-auto px-2 pb-1 pt-0">
              <table className="min-w-full text-left text-sm">
                <thead className={STICKY_TABLE_HEAD}>
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Sym</th>
                    <th className="px-4 py-2.5 font-medium">Company</th>
                    <th className="px-2 py-2.5 font-medium text-center">Sess.</th>
                    <th className="px-3 py-2.5 font-medium text-right">Est.</th>
                    <th className="px-3 py-2.5 font-medium text-right">Actual</th>
                    <th className="px-4 py-2.5 font-medium text-right">Surprise</th>
                    <th className="min-w-[12rem] px-4 py-2.5 font-medium">Beat / miss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/70">
                  {mainRows.map((r) => {
                    const surprise = r.surprisePct
                    const beat = r.result === 'BEAT'
                    const miss = r.result === 'MISS'
                    const neutral = r.result === 'MEET'

                    const widthFrac = barWidthFrac(r.result, surprise)
                    const barH = barHeightPx(widthFrac)

                    const barGlow = beat
                      ? 'shadow-[0_0_22px_rgba(16,185,129,0.9),0_0_44px_rgba(16,185,129,0.35),inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                      : miss
                        ? 'shadow-[0_0_22px_rgba(248,113,113,0.85),0_0_44px_rgba(248,113,113,0.3),inset_0_0_0_1px_rgba(255,255,255,0.1)]'
                        : 'shadow-[0_0_10px_rgba(161,161,170,0.25)]'
                    const barColor = beat
                      ? `from-emerald-400/80 via-emerald-500/85 to-emerald-400/80 ${barGlow}`
                      : miss
                        ? `from-rose-400/80 via-rose-500/85 to-rose-400/80 ${barGlow}`
                        : `from-zinc-500/70 via-zinc-400/70 to-zinc-500/70 ${barGlow}`

                    return (
                      <tr key={`${r.symbol}-${r.name}-${r.time ?? ''}`} className="relative z-0">
                        <td className="px-4 py-2.5 font-semibold text-zinc-100">{r.symbol ?? '—'}</td>
                        <td className="max-w-[18rem] truncate px-4 py-2.5 text-zinc-300" title={r.name ?? ''}>
                          {r.name ?? '—'}
                        </td>
                        <td className="px-2 py-2.5 text-center" title={r.time ?? 'Time not provided'}>
                          <span className="inline-flex items-center justify-center">
                            <SessionIcon hint={r.sessionHint} />
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-400">{fmtEps(r.epsEstimate)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-200">{fmtEps(r.epsActual)}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums">
                          <span
                            className={[
                              beat ? 'text-emerald-300' : miss ? 'text-rose-300' : 'text-zinc-300',
                            ].join(' ')}
                          >
                            {fmtPct(surprise)}
                          </span>
                        </td>
                        <td className="overflow-visible px-4 py-2.5 align-middle">
                          <div
                            className="relative w-full overflow-visible rounded-full bg-surface-0/60 ring-1 ring-border-subtle/70"
                            style={{ height: Math.max(28, barH) }}
                          >
                            {widthFrac > 0 && beat ? (
                              <div
                                className={[
                                  'absolute left-0 top-0 flex h-full min-w-[4.75rem] items-center justify-center rounded-full bg-gradient-to-r px-2.5',
                                  barColor,
                                  widthFrac >= 70 ? 'animate-pulse-[1.8s_ease-in-out_infinite_alternate]' : '',
                                ].join(' ')}
                                style={{ width: `max(4.75rem, ${widthFrac}%)` }}
                              >
                                <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-zinc-50">
                                  BEAT
                                </span>
                              </div>
                            ) : widthFrac > 0 && miss ? (
                              <div
                                className={[
                                  'absolute right-0 top-0 flex h-full min-w-[4.75rem] items-center justify-center rounded-full bg-gradient-to-l px-2.5',
                                  barColor,
                                  widthFrac >= 70 ? 'animate-pulse-[1.8s_ease-in-out_infinite_alternate]' : '',
                                ].join(' ')}
                                style={{ width: `max(4.75rem, ${widthFrac}%)` }}
                              >
                                <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-zinc-50">
                                  MISS
                                </span>
                              </div>
                            ) : (
                              <div className="flex h-full items-center justify-center text-[11px] font-semibold text-zinc-300">
                                {neutral ? 'MEET' : '—'}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {mainRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={7}>
                        No earnings found for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TableShell>
        )
      ) : errorEcon ? (
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-200">
          <p className="font-medium">Couldn’t load economic calendar</p>
          <p className="mt-1 text-rose-200/80">{errorEcon}</p>
        </section>
      ) : (
        <TableShell
          title="Economic calendar"
          subtitle="Macro releases for the selected week. Forecast is muted; actual slides in when present. Impact is color-coded by level."
        >
          <div className="relative isolate max-h-[34rem] overflow-auto px-2 pb-1 pt-0">
            <table className="min-w-full text-left text-sm">
              <thead className={STICKY_TABLE_HEAD}>
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-3 py-2.5 font-medium">Country</th>
                  <th className="px-3 py-2.5 font-medium text-center">Impact</th>
                  <th className="px-3 py-2.5 font-medium text-right">Forecast</th>
                  <th className="px-3 py-2.5 font-medium text-right">Previous</th>
                  <th className="px-4 py-2.5 font-medium text-right">Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/70">
                {econRows.map((ev, i) => {
                  const key = `${ev.date}-${i}-${ev.event}`
                  return (
                    <tr key={key}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">{fmtWhen(ev.date)}</td>
                      <td className="max-w-[20rem] px-4 py-2.5 font-medium text-zinc-100">{fmtMacro(ev.event)}</td>
                      <td className="px-3 py-2.5 text-zinc-400">{fmtMacro(ev.country)}</td>
                      <td className="overflow-visible px-3 py-2.5 text-center">
                        <div className="inline-flex justify-center">
                          <ImpactPill level={ev.impactLevel} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{fmtMacro(ev.forecast)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-400">{fmtMacro(ev.previous)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <ActualMacroValue eventKey={key} value={ev.actual} />
                      </td>
                    </tr>
                  )
                })}
                {econRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-zinc-500" colSpan={7}>
                      No macro events in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TableShell>
      )}
    </div>
  )
}
