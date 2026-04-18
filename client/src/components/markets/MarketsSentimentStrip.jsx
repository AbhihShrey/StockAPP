export function MarketsSentimentStrip({ data, loading, error }) {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-4 text-sm text-rose-200">
        {error}
      </div>
    )
  }
  if (loading && !data) {
    return <div className="h-28 animate-pulse rounded-xl bg-white/5" />
  }

  const vix = data?.vix
  const pc = data?.putCallRatio
  const label = data?.label ?? '—'

  let vixTone = 'text-zinc-200'
  if (typeof vix === 'number' && Number.isFinite(vix)) {
    if (vix >= 25) vixTone = 'text-amber-200'
    else if (vix <= 15) vixTone = 'text-[color:var(--color-success)]'
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">VIX (fear)</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className={`text-3xl font-semibold tabular-nums tracking-tight ${vixTone}`}>
            {vix == null ? '—' : vix.toFixed(2)}
          </p>
          <p className="text-right text-[11px] leading-snug text-zinc-500">
            Implied vol index.
            <br />
            Elevated → fear / hedging.
          </p>
        </div>
        {typeof vix === 'number' && Number.isFinite(vix) ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 via-amber-400/90 to-rose-500/90"
              style={{ width: `${Math.min(100, Math.max(0, ((vix - 10) / 35) * 100))}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Put / call ratio</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-100">
          {pc == null ? '—' : pc.toFixed(3)}
        </p>
        <p className="mt-1 text-[11px] text-zinc-600">
          {data?.putCallSource === 'cnn_put_call_series' ? 'CNN auxiliary series (options flow).' : 'Options flow.'}{' '}
          &gt;1 often means more put protection.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Blended sentiment</p>
        <p className="mt-2 text-lg font-semibold text-zinc-100">{label}</p>
        {data?.score != null ? (
          <p className="mt-1 text-sm text-zinc-500">Score {data.score.toFixed(1)} / 100</p>
        ) : null}
      </div>
    </div>
  )
}
