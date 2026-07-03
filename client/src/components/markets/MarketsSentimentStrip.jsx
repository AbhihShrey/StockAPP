export function MarketsSentimentStrip({ data, loading, error }) {
  if (error) {
    return (
      <div className="rounded-xl border border-down/25 bg-down/5 p-4 text-sm text-down">
        {error}
      </div>
    )
  }
  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy aria-label="Loading sentiment">
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    )
  }

  const vix = data?.vix
  const pc = data?.putCallRatio
  const label = data?.label ?? '—'

  let vixChip = null
  if (typeof vix === 'number' && Number.isFinite(vix)) {
    if (vix >= 25) vixChip = <span className="chip chip-warn">Elevated</span>
    else if (vix <= 15) vixChip = <span className="chip">Calm</span>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">VIX · Fear</p>
          {vixChip}
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="num text-3xl font-semibold text-ink">
            {vix == null ? '—' : vix.toFixed(2)}
          </p>
          <p className="text-right text-[11px] leading-snug text-ink-3">
            Implied vol index.
            <br />
            Elevated → fear / hedging.
          </p>
        </div>
        {typeof vix === 'number' && Number.isFinite(vix) ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-up/70 via-warn/80 to-down/80"
              style={{ width: `${Math.min(100, Math.max(0, ((vix - 10) / 35) * 100))}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <p className="eyebrow">Put / call ratio</p>
        <p className="num mt-2 text-2xl font-semibold text-ink">
          {pc == null ? '—' : pc.toFixed(3)}
        </p>
        <p className="mt-1 text-[11px] text-ink-3">
          {data?.putCallSource === 'cnn_put_call_series' ? 'CNN auxiliary series (options flow).' : 'Options flow.'}{' '}
          &gt;1 often means more put protection.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <p className="eyebrow">Blended sentiment</p>
        <p className="mt-2 font-display text-lg font-semibold text-ink">{label}</p>
        {data?.score != null ? (
          <p className="num mt-1 text-sm text-ink-3">Score {data.score.toFixed(1)} / 100</p>
        ) : null}
      </div>
    </div>
  )
}
