import { useEffect, useId, useRef } from 'react'
import { toTradingViewSymbol } from '../lib/tradingViewSymbol'

const SCRIPT_SRC =
  'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'

/**
 * Compact Symbol Overview — ~1M candles, minimal UI (grid tiles).
 * Full drawing tools + Fibonacci: use {@link TradingViewAdvancedChart} in the expand modal.
 * Mount is deferred one tick so the DOM is stable (helps React Strict Mode + TradingView’s embed).
 */
export function TradingViewSymbolOverviewSimple({
  ticker,
  height = 220,
  className = '',
  /** TradingView symbol line uses e.g. `AMZN|1M` (see their Symbol Overview demos). */
  range = '1M',
}) {
  const uid = useId().replace(/:/g, '')
  const containerRef = useRef(null)
  const full = toTradingViewSymbol(ticker)
  const baseTicker = full.includes(':') ? full.split(':')[1] : String(ticker).toUpperCase()

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    let cancelled = false
    root.replaceChildren()

    const t = window.setTimeout(() => {
      if (cancelled || containerRef.current !== root) return

      const widget = document.createElement('div')
      widget.className = 'tradingview-widget-container__widget'
      widget.style.height = `${height}px`
      widget.style.width = '100%'

      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = false
      script.src = SCRIPT_SRC
      script.text = JSON.stringify({
        symbols: [[String(ticker).toUpperCase(), `${baseTicker}|${range}`]],
        chartOnly: true,
        chartType: 'candlesticks',
        colorTheme: 'dark',
        isTransparent: false,
        backgroundColor: '#131722',
        autosize: true,
        width: '100%',
        height,
        locale: 'en',
        showVolume: false,
        showMA: false,
        hideDateRanges: true,
        hideMarketStatus: true,
        hideSymbolLogo: true,
        scalePosition: 'right',
        scaleMode: 'Normal',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif',
        fontSize: '10',
        noTimeScale: false,
        valuesTracking: '1',
        changeMode: 'price-only',
        lineType: 0,
        dateRanges: ['1m|1D'],
        downColor: '#c24141',
        upColor: '#1a8f72',
        borderUpColor: '#1a8f72',
        borderDownColor: '#c24141',
        wickUpColor: '#1a8f72',
        wickDownColor: '#c24141',
      })

      root.replaceChildren()
      root.appendChild(widget)
      root.appendChild(script)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(t)
      root.replaceChildren()
    }
  }, [ticker, baseTicker, height, range, uid])

  return (
    <div
      className={`overflow-hidden rounded-lg bg-[#131722] ring-1 ring-white/[0.06] [&_.tradingview-widget-copyright]:hidden ${className}`}
      style={{ height, minHeight: height }}
    >
      <div
        ref={containerRef}
        id={`tv-symbol-overview-${uid}`}
        className="tradingview-widget-container h-full w-full"
        style={{ height }}
      />
    </div>
  )
}
