/** Pulsing bar / block for loading placeholders */
export function SkeletonBlock({ className = '' }) {
  return (
    <div
      className={[
        'animate-pulse rounded-lg bg-gradient-to-r from-white/[0.06] via-white/[0.12] to-white/[0.06] bg-[length:200%_100%]',
        className,
      ].join(' ')}
      aria-hidden
    />
  )
}

export function SkeletonText({ className = '' }) {
  return <SkeletonBlock className={['h-3 w-full', className].join(' ')} />
}

/** Mini card grid for global assets loading */
export function GlobalAssetsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-white/10 bg-neutral-900/40 p-4"
          aria-busy
          aria-label="Loading"
        >
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

export function MarketBreadthSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading breadth">
      <div className="flex justify-between gap-3">
        <SkeletonBlock className="h-10 w-24" />
        <div className="flex flex-col items-end gap-2">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <SkeletonBlock className="h-3 w-full rounded-full" />
      <div className="flex justify-between">
        <SkeletonBlock className="h-2 w-6" />
        <SkeletonBlock className="h-2 w-6" />
        <SkeletonBlock className="h-2 w-6" />
      </div>
    </div>
  )
}

export function MarketSentimentSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading sentiment">
      <div className="mx-auto flex max-w-[12rem] flex-col items-center gap-3">
        <SkeletonBlock className="h-16 w-full rounded-lg" />
        <SkeletonBlock className="h-4 w-32" />
      </div>
      <SkeletonBlock className="h-2 w-full rounded-full" />
      <div className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-5">
        <SkeletonBlock className="h-14 rounded-xl" />
        <SkeletonBlock className="h-14 rounded-xl" />
      </div>
    </div>
  )
}

export function SectorGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy aria-label="Loading sectors">
      {Array.from({ length: 11 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-white/10 bg-neutral-900/40 p-3">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-4 w-12" />
          <SkeletonBlock className="h-8 w-14" />
          <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function VolHeatmapSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Loading heatmap">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBlock key={i} className="min-h-[5.5rem] rounded-xl" />
        ))}
      </div>
      <SkeletonText className="max-w-md" />
    </div>
  )
}

export function TableRowsSkeleton({ rows = 8, cols = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-2.5">
              <SkeletonBlock className={c === 0 ? 'h-4 w-14' : 'h-4 w-20'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function RelatedStrengthSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-busy aria-label="Loading related strength">
      <SkeletonBlock className="h-28 rounded-xl" />
      <SkeletonBlock className="h-28 rounded-xl" />
    </div>
  )
}
