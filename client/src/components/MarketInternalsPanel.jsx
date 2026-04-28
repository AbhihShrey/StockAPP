import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AnimatedNumber } from './AnimatedNumber'

const TOOLTIP_STYLE = {
  background: 'rgba(20, 20, 24, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: '0.75rem',
  backdropFilter: 'blur(18px) saturate(170%)',
  WebkitBackdropFilter: 'blur(18px) saturate(170%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 8px 24px rgba(0,0,0,0.35)',
  color: 'oklch(0.92 0 0)',
  fontSize: '12px',
  padding: '8px 10px',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

function PctAboveMaRow({ label, pct }) {
  const pctNum = pct != null && Number.isFinite(pct) ? pct : null
  const widthPct = pctNum == null ? 0 : Math.min(100, Math.max(0, pctNum))
  const zone =
    pctNum == null ? 'neutral' : pctNum >= 60 ? 'strong' : pctNum <= 40 ? 'weak' : 'neutral'
  const barColor =
    zone === 'strong'
      ? 'bg-[color:var(--color-success)]'
      : zone === 'weak'
        ? 'bg-rose-500'
        : 'bg-zinc-500'

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-zinc-100">
          {pctNum == null ? (
            '—'
          ) : (
            <AnimatedNumber value={pctNum} format={(n) => `${n.toFixed(1)}%`} duration={560} />
          )}
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={['metric-bar-fill-inner metric-bar-fill-spring h-full rounded-full', barColor].join(' ')}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-600">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function NewHighsLowsBar52w({ highs, lows }) {
  const data = [
    { name: '52w highs', v: typeof highs === 'number' && Number.isFinite(highs) ? highs : 0 },
    { name: '52w lows', v: typeof lows === 'number' && Number.isFinite(lows) ? lows : 0 },
  ]

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">New 52-week highs / lows</p>
      <p className="mt-1 text-[11px] text-zinc-600">S&P 500 — session vs trailing 52-week range.</p>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="v" radius={[8, 8, 8, 8]}>
              <Cell fill="rgba(52,211,153,0.55)" />
              <Cell fill="rgba(251,113,133,0.55)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AdvanceDeclineLine({ history }) {
  const data = Array.isArray(history)
    ? history.map((p) => ({
        t: p.t ? String(p.t).slice(11, 16) : '',
        net: typeof p.net === 'number' && Number.isFinite(p.net) ? p.net : 0,
      }))
    : []

  if (data.length < 2) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Advance / Decline (S&P 500)</p>
        <p className="mt-3 text-sm text-zinc-500">Collecting participation history…</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Advance / Decline line</p>
      <p className="mt-1 text-[11px] text-zinc-600">Net advancers minus decliners (recent samples).</p>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="t" tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="net" stroke="rgba(96,165,250,0.9)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function MarketInternalsPanel({ breadth, breadthLoading, breadthError, highs, lows }) {
  const h52 = breadth?.highs52w
  const l52 = breadth?.lows52w
  const adHist = breadth?.advanceDeclineHistory24h
  const pct200Fallback = breadth?.pctAbove200dma
  const pct200 = breadth?.pctAbove200sma ?? pct200Fallback

  if (breadthError) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-200">
        <p className="font-medium">Market breadth</p>
        <p className="mt-1 text-rose-200/80">{breadthError}</p>
      </div>
    )
  }

  if (breadthLoading && !breadth) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-white/5" />
        <div className="h-40 animate-pulse rounded-xl bg-white/5" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AdvanceDeclineLine history={adHist} />
      <NewHighsLowsBar52w highs={h52} lows={l52} />
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">% above moving averages</p>
        <p className="mt-1 text-[11px] text-zinc-600">S&P 500 constituents (quotes + derived breadth).</p>
        <div className="mt-4 space-y-6">
          <PctAboveMaRow label="50-day MA" pct={breadth?.pctAbove50sma} />
          <PctAboveMaRow label="200-day MA" pct={pct200} />
        </div>
      </div>
      {highs != null || lows != null ? (
        <p className="text-[11px] text-zinc-600">
          Momentum proxy (±5% day): {typeof highs === 'number' ? highs : '—'} highs /{' '}
          {typeof lows === 'number' ? lows : '—'} lows
        </p>
      ) : null}
    </div>
  )
}
