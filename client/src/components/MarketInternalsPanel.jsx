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
import { SkeletonBlock } from './DataSkeleton'

/* Chart colors are hex-in-JS by design-system exception. */
const GRID = 'rgba(244,232,216,0.06)'
const AXIS = '#8b7f6d'
const UP_FILL = 'rgba(61,220,151,0.55)'
const DOWN_FILL = 'rgba(255,97,97,0.55)'
const EMBER = '#c88738'

const TOOLTIP_STYLE = {
  background: 'rgba(27, 23, 19, 0.94)',
  border: '1px solid rgba(244, 232, 216, 0.16)',
  borderRadius: '10px',
  color: '#F4EFE9',
  fontSize: '12px',
  padding: '8px 10px',
  fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
}

function PctAboveMaRow({ label, pct }) {
  const pctNum = pct != null && Number.isFinite(pct) ? pct : null
  const widthPct = pctNum == null ? 0 : Math.min(100, Math.max(0, pctNum))
  const zone =
    pctNum == null ? 'neutral' : pctNum >= 60 ? 'strong' : pctNum <= 40 ? 'weak' : 'neutral'
  const barColor = zone === 'strong' ? 'bg-up' : zone === 'weak' ? 'bg-down' : 'bg-ink-3'

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">{label}</p>
        <p className="num text-lg font-semibold text-ink">
          {pctNum == null ? (
            '—'
          ) : (
            <AnimatedNumber value={pctNum} format={(n) => `${n.toFixed(1)}%`} duration={560} />
          )}
        </p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={['h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]', barColor].join(' ')}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="num flex justify-between text-[10px] text-ink-3">
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
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="eyebrow">New 52-week highs / lows</p>
      <p className="mt-1 text-[11px] text-ink-3">S&P 500 — session vs trailing 52-week range.</p>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(244,232,216,0.04)' }} />
            <Bar dataKey="v" radius={[8, 8, 8, 8]}>
              <Cell fill={UP_FILL} />
              <Cell fill={DOWN_FILL} />
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
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <p className="eyebrow">Advance / Decline (S&P 500)</p>
        <p className="mt-3 text-sm text-ink-3">Collecting participation history…</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="eyebrow">Advance / Decline line</p>
      <p className="mt-1 text-[11px] text-ink-3">Net advancers minus decliners (recent samples).</p>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="t" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="net" stroke={EMBER} strokeWidth={2} dot={false} />
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
      <div className="rounded-xl border border-down/25 bg-down/10 p-4 text-sm">
        <p className="font-medium text-ink">Market breadth failed to load</p>
        <p className="mt-1 text-down">{breadthError}</p>
        <p className="mt-1 text-ink-3">It retries on the next refresh.</p>
      </div>
    )
  }

  if (breadthLoading && !breadth) {
    return (
      <div className="space-y-4" aria-busy aria-label="Loading market internals">
        <SkeletonBlock className="h-32 rounded-xl" />
        <SkeletonBlock className="h-40 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AdvanceDeclineLine history={adHist} />
      <NewHighsLowsBar52w highs={h52} lows={l52} />
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <p className="eyebrow">% above moving averages</p>
        <p className="mt-1 text-[11px] text-ink-3">S&P 500 constituents (quotes + derived breadth).</p>
        <div className="mt-4 space-y-6">
          <PctAboveMaRow label="50-day MA" pct={breadth?.pctAbove50sma} />
          <PctAboveMaRow label="200-day MA" pct={pct200} />
        </div>
      </div>
      {highs != null || lows != null ? (
        <p className="num text-[11px] text-ink-3">
          Momentum proxy (±5% day): {typeof highs === 'number' ? highs : '—'} highs /{' '}
          {typeof lows === 'number' ? lows : '—'} lows
        </p>
      ) : null}
    </div>
  )
}
