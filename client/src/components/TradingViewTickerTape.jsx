import { useEffect, useId, useRef } from 'react'
import { useChartTheme } from '../lib/theme'

const SCRIPT_SRC =
  'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'

export function TradingViewTickerTape() {
  const uid = useId().replace(/:/g, '')
  const ref = useRef(null)
  const theme = useChartTheme()
  const isLight = theme === 'light'
  const bg = isLight ? '#ffffff' : '#131722'

  useEffect(() => {
    const root = ref.current
    if (!root) return undefined

    let cancelled = false
    root.replaceChildren()

    const t = window.setTimeout(() => {
      if (cancelled || ref.current !== root) return

      const widget = document.createElement('div')
      widget.className = 'tradingview-widget-container__widget'

      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = false
      script.src = SCRIPT_SRC
      script.text = JSON.stringify({
        symbols: [
          { proName: 'AMEX:SPY', title: 'S&P 500 ETF' },
          { proName: 'NASDAQ:QQQ', title: 'Nasdaq 100' },
          { proName: 'AMEX:IWM', title: 'Russell 2000' },
          { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
          { proName: 'BITSTAMP:ETHUSD', title: 'Ethereum' },
          { proName: 'NASDAQ:AAPL', title: 'Apple' },
          { proName: 'NASDAQ:MSFT', title: 'Microsoft' },
          { proName: 'NASDAQ:NVDA', title: 'NVIDIA' },
        ],
        colorTheme: isLight ? 'light' : 'dark',
        displayMode: 'regular',
        isTransparent: false,
        backgroundColor: bg,
        showSymbolLogo: true,
        locale: 'en',
        width: '100%',
        height: 72,
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
  }, [uid, isLight, bg])

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06]"
      style={{ backgroundColor: bg }}
    >
      <div
        ref={ref}
        id={`tv-ticker-tape-${uid}`}
        className="tradingview-widget-container w-full"
        style={{ height: 72 }}
      />
    </div>
  )
}
