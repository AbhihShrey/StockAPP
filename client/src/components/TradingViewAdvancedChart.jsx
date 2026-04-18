import { useEffect, useId, useRef } from 'react'
import { toTradingViewSymbol } from '../lib/tradingViewSymbol'

const SCRIPT_SRC =
  'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'

/** TradingView “dark” canvas background (matches their terminal dark theme). */
const TV_DARK_BG = '#131722'

/**
 * TradingView Advanced Real-Time Chart (embed).
 * `hide_side_toolbar: false` keeps drawing tools (incl. Fibonacci retracement) available.
 * Script must be a direct child of `.tradingview-widget-container` (sibling of `__widget`), or the embed throws.
 */
export function TradingViewAdvancedChart({
  ticker,
  height = 520,
  className = '',
  autosize = true,
  /** Adds TradingView’s built-in VWAP study (daily chart). */
  showVwapStudy = false,
}) {
  const uid = useId().replace(/:/g, '')
  const containerRef = useRef(null)
  const fullSymbol = toTradingViewSymbol(ticker)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    let cancelled = false
    root.replaceChildren()

    const t = window.setTimeout(() => {
      if (cancelled || containerRef.current !== root) return

      const widget = document.createElement('div')
      widget.className = 'tradingview-widget-container__widget'
      widget.style.height = '100%'
      widget.style.minHeight = '200px'
      widget.style.width = '100%'
      widget.id = `tv-advanced-${uid}`

      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = false
      script.src = SCRIPT_SRC
      const embedConfig = {
        autosize,
        symbol: fullSymbol,
        interval: 'D',
        timezone: 'America/New_York',
        theme: 'dark',
        style: '1',
        locale: 'en',
        hide_top_toolbar: false,
        hide_legend: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        save_image: true,
        calendar: false,
        hide_volume: false,
        support_host: 'https://www.tradingview.com',
        width: '100%',
        height,
        show_popup_button: true,
        popup_width: '1200',
        popup_height: '700',
        backgroundColor: TV_DARK_BG,
      }
      if (showVwapStudy) {
        embedConfig.studies = ['VWAP@tv-basicstudies']
      }
      script.text = JSON.stringify(embedConfig)

      root.replaceChildren()
      root.appendChild(widget)
      root.appendChild(script)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(t)
      root.replaceChildren()
    }
  }, [fullSymbol, height, autosize, uid, showVwapStudy])

  return (
    <div
      className={`h-full min-h-0 overflow-hidden rounded-xl border border-white/[0.06] shadow-inner ${className}`}
      style={{
        backgroundColor: TV_DARK_BG,
      }}
    >
      <div
        ref={containerRef}
        id={`tv-advanced-wrap-${uid}`}
        className="tradingview-widget-container h-full min-h-[200px] w-full"
      />
    </div>
  )
}
