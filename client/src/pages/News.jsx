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
  if (hint === 'bmo') return <Sun className="size-4 text-warn" aria-label="Before market open" />
  if (hint === 'amc') return <Moon className="size-4 text-ink-2" aria-label="After market close" />
  return <Minus className="size-4 text-ink-3" aria-label="Time unknown" />
}

/** Impact levels map to the standard chip variants. */
const IMPACT_PILL = {
  high: { label: 'HIGH', title: 'High impact', className: 'chip-down' },
  medium: { label: 'MED', title: 'Medium impact', className: 'chip-warn' },
  low: { label: 'LOW', title: 'Low impact', className: '' },
}

function ImpactPill({ level }) {
  const cfg = IMPACT_PILL[level] ?? IMPACT_PILL.low
  return (
    <span
      className={['chip min-w-[3.25rem] justify-center tracking-wide', cfg.className].join(' ')}
      title={cfg.title}
      aria-label={cfg.title}
    >
      {cfg.label}
    </span>
  )
}

function ImpactLegendBox() {
  return (
    <div className="ml-auto flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5">
      <span className="eyebrow">Impact</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <ImpactPill level="high" />
        <ImpactPill level="medium" />
        <ImpactPill level="low" />
      </div>
    </div>
  )
}

function ActualMacroValue({ eventKey, value }) {
  const s = fmtMacro(value)
  if (s === '—') {
    return <span className="text-ink-3">—</span>
  }
  return (
    <span key={`${eventKey}-${s}`} className="ignite num inline-block font-medium text-ink">
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
      aria-pressed={mode === id}
      className={[
        'rounded-lg px-4 py-2 text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ember/60',
        mode === id ? 'bg-surface-3 text-flame' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      ].join(' ')}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="eyebrow">News · Markets & calendars</p>
        <h1 className="display mt-1 text-2xl sm:text-3xl">News</h1>
        <div className="ember-rule mt-4" />
      </header>

      <div className="rise rise-1 panel flex flex-wrap items-center gap-1 p-1">
        {tabBtn('market', 'Market news')}
        {tabBtn('earnings', 'Earnings')}
        {tabBtn('economic', 'Economic')}
        {tabBtn('ipo', 'IPO calendar')}
      </div>

      {mode !== 'market' && mode !== 'ipo' ? (
        <section className="rise rise-2 panel panel-pad flex flex-wrap items-center gap-4">
          <div>
            <label className="field-label" htmlFor="news-cal-date">
              {mode === 'earnings' ? 'Earnings date' : 'Week starting'}
            </label>
            <input
              id="news-cal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="input num w-44"
            />
          </div>
          {mode === 'earnings' ? (
            <p className="ml-auto text-xs text-ink-3">
              <span className="inline-flex items-center gap-1">
                <Sun className="size-3.5 text-warn" aria-hidden />
                BMO
              </span>{' '}
              ·{' '}
              <span className="inline-flex items-center gap-1">
                <Moon className="size-3.5 text-ink-2" aria-hidden />
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
        <section className="rise rise-3 panel panel-pad space-y-3" aria-busy aria-label="Loading calendar">
          <div className="skeleton h-4 w-44" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
        </section>
      ) : mode === 'earnings' ? (
        errorEarn ? (
          <section className="rise rise-3 panel border-down/25 bg-down/5 p-6 text-sm">
            <p className="font-medium text-down">Couldn’t load earnings</p>
            <p className="mt-1 text-ink-2">{errorEarn}</p>
            <p className="mt-2 text-xs text-ink-3">Pick another date or reload the page to retry.</p>
          </section>
        ) : (
          <div className="rise rise-3">
            <TableShell
              title="Earnings calendar"
              subtitle="Sorted by surprise %. Bars show the gap between estimated and actual EPS."
            >
              <div className="max-h-[34rem] overflow-y-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Sym</th>
                      <th>Company</th>
                      <th className="text-center">Sess.</th>
                      <th className="num">Est.</th>
                      <th className="num">Actual</th>
                      <th className="num">Surprise</th>
                      <th className="min-w-[12rem]">Beat / miss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainRows.map((r) => {
                      const surprise = r.surprisePct
                      const beat = r.result === 'BEAT'
                      const miss = r.result === 'MISS'
                      const neutral = r.result === 'MEET'

                      const widthFrac = barWidthFrac(r.result, surprise)
                      const barH = barHeightPx(widthFrac)

                      return (
                        <tr key={`${r.symbol}-${r.name}-${r.time ?? ''}`}>
                          <td className="num font-semibold text-ink">{r.symbol ?? '—'}</td>
                          <td className="max-w-[18rem] truncate" title={r.name ?? ''}>
                            {r.name ?? '—'}
                          </td>
                          <td className="text-center" title={r.time ?? 'Time not provided'}>
                            <span className="inline-flex items-center justify-center">
                              <SessionIcon hint={r.sessionHint} />
                            </span>
                          </td>
                          <td className="num text-ink-3">{fmtEps(r.epsEstimate)}</td>
                          <td className="num text-ink">{fmtEps(r.epsActual)}</td>
                          <td className="num font-semibold">
                            <span className={beat ? 'text-up' : miss ? 'text-down' : 'text-ink-2'}>
                              {fmtPct(surprise)}
                            </span>
                          </td>
                          <td className="min-w-[12rem]">
                            <div
                              className="relative w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-line"
                              style={{ height: Math.max(28, barH) }}
                            >
                              {widthFrac > 0 && beat ? (
                                <div
                                  className="absolute left-0 top-0 flex h-full min-w-[4.75rem] items-center justify-center rounded-full border border-up/30 bg-up/15 px-2.5"
                                  style={{ width: `max(4.75rem, ${widthFrac}%)` }}
                                >
                                  <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-up">
                                    BEAT
                                  </span>
                                </div>
                              ) : widthFrac > 0 && miss ? (
                                <div
                                  className="absolute right-0 top-0 flex h-full min-w-[4.75rem] items-center justify-center rounded-full border border-down/30 bg-down/15 px-2.5"
                                  style={{ width: `max(4.75rem, ${widthFrac}%)` }}
                                >
                                  <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-down">
                                    MISS
                                  </span>
                                </div>
                              ) : (
                                <div className="flex h-full items-center justify-center text-[11px] font-semibold text-ink-3">
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
                        <td className="py-8 text-center text-ink-3" colSpan={7}>
                          No earnings found for this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TableShell>
          </div>
        )
      ) : errorEcon ? (
        <section className="rise rise-3 panel border-down/25 bg-down/5 p-6 text-sm">
          <p className="font-medium text-down">Couldn’t load economic calendar</p>
          <p className="mt-1 text-ink-2">{errorEcon}</p>
          <p className="mt-2 text-xs text-ink-3">Pick another date or reload the page to retry.</p>
        </section>
      ) : (
        <div className="rise rise-3">
          <TableShell
            title="Economic calendar"
            subtitle="Macro releases for the selected week. Forecast is muted; actual lights up when present. Impact is color-coded by level."
          >
            <div className="max-h-[34rem] overflow-y-auto">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Event</th>
                    <th>Country</th>
                    <th className="text-center">Impact</th>
                    <th className="num">Forecast</th>
                    <th className="num">Previous</th>
                    <th className="num">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {econRows.map((ev, i) => {
                    const key = `${ev.date}-${i}-${ev.event}`
                    return (
                      <tr key={key}>
                        <td className="num whitespace-nowrap text-xs text-ink-3">{fmtWhen(ev.date)}</td>
                        <td className="max-w-[20rem] font-medium text-ink">{fmtMacro(ev.event)}</td>
                        <td>{fmtMacro(ev.country)}</td>
                        <td className="text-center">
                          <div className="inline-flex justify-center">
                            <ImpactPill level={ev.impactLevel} />
                          </div>
                        </td>
                        <td className="num text-ink-3">{fmtMacro(ev.forecast)}</td>
                        <td className="num">{fmtMacro(ev.previous)}</td>
                        <td className="num">
                          <ActualMacroValue eventKey={key} value={ev.actual} />
                        </td>
                      </tr>
                    )
                  })}
                  {econRows.length === 0 && (
                    <tr>
                      <td className="py-8 text-center text-ink-3" colSpan={7}>
                        No macro events in this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TableShell>
        </div>
      )}
    </div>
  )
}
