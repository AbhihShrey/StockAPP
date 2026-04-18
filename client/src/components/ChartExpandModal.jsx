import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TradingViewAdvancedChart } from './TradingViewAdvancedChart'

function measureHost(el) {
  if (!el) return null
  const h = Math.floor(el.getBoundingClientRect().height)
  return h >= 200 ? h : null
}

export function ChartExpandModal({
  open,
  ticker,
  onClose,
  chartRefreshKey = 0,
  showVwapStudy = true,
}) {
  const chartHostRef = useRef(null)
  const [chartHeight, setChartHeight] = useState(() =>
    typeof window !== 'undefined'
      ? Math.max(280, Math.min(900, Math.floor(window.innerHeight * 0.65)))
      : 520,
  )

  useLayoutEffect(() => {
    if (!open) return undefined
    const el = chartHostRef.current
    if (!el) return undefined

    const sync = () => {
      const next = measureHost(chartHostRef.current)
      if (next != null) setChartHeight(next)
    }

    sync()

    let debounceTimer = 0
    const debounced = () => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(sync, 80)
    }

    const ro = new ResizeObserver(debounced)
    ro.observe(el)
    window.addEventListener('resize', sync)

    return () => {
      window.clearTimeout(debounceTimer)
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [open, ticker, chartRefreshKey])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !ticker) return null

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label={`Full chart ${ticker}`}
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[101] flex min-h-dvh items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex w-full max-w-6xl flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-2xl shadow-black/60 sm:gap-4 sm:p-5 [max-height:calc(100dvh_-_3rem)]">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Expanded view</p>
              <p className="text-lg font-semibold text-zinc-100">{ticker}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
              aria-label="Close expanded chart"
            >
              <X className="size-5" />
            </button>
          </div>
          <div
            ref={chartHostRef}
            className="w-full overflow-hidden [height:min(900px,calc(100dvh_-_14rem))]"
          >
            <TradingViewAdvancedChart
              key={`${ticker}-${chartRefreshKey}-${showVwapStudy ? 'v' : 'n'}`}
              ticker={ticker}
              height={chartHeight}
              className="min-h-0 max-h-full"
              showVwapStudy={showVwapStudy}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
