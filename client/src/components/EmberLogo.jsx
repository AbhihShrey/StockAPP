import { useId } from 'react'

const SIZES = {
  xs: { box: 36, mark: 22, name: 15 },
  sm: { box: 48, mark: 30, name: 17 },
  md: { box: 72, mark: 46, name: 22 },
  lg: { box: 96, mark: 60, name: 30 },
}

/**
 * Icon mark: "the lit candle" — a bullish chart candlestick whose upper wick
 * has become a flame. All coordinates in a 32×32 viewBox.
 *
 * Flame: asymmetric teardrop, tip pulled up and slightly right so it reads
 *   as fire, with a bright inner core near the base for depth.
 * Candle: rounded green body (the site accent — an "up" candle) with a short
 *   lower wick, so the shape stays chart data rather than a wax candle.
 */
function EmberMark({ size, uid }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        {/* Flame: hot orange tip cooling into amber at the base */}
        <linearGradient id={`emf-${uid}`} x1="16" y1="3" x2="16" y2="16.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff4d1f" />
          <stop offset="55%" stopColor="#ff7a2e" />
          <stop offset="100%" stopColor="#ffb64f" />
        </linearGradient>
        {/* Candle body: the app's mint accent, lit slightly from above */}
        <linearGradient id={`emc-${uid}`} x1="16" y1="18.6" x2="16" y2="26.8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#41e2a1" />
          <stop offset="100%" stopColor="#14b87c" />
        </linearGradient>
      </defs>

      {/* Flame — replaces the candle's upper wick */}
      <path
        d="M 16.9 2.8
           C 16.9 5.7 21.3 8.5 21.3 12
           C 21.3 14.7 19 16.5 16.1 16.5
           C 13.2 16.5 10.9 14.7 10.9 12
           C 10.9 10.2 11.9 8.8 13 7.4
           C 14.3 5.8 15.2 4.5 16.9 2.8 Z"
        fill={`url(#emf-${uid})`}
      />
      {/* Inner core — the glow of the ember */}
      <path
        d="M 16.1 9.6
           C 17.6 11.3 18.55 12.5 18.55 13.7
           C 18.55 15.1 17.5 16 16.1 16
           C 14.7 16 13.65 15.1 13.65 13.7
           C 13.65 12.5 14.6 11.3 16.1 9.6 Z"
        fill="#ffdf9e"
      />

      {/* Candle body — a green "up" candle */}
      <rect x="11.5" y="18.6" width="9.2" height="8.2" rx="1.9" fill={`url(#emc-${uid})`} />
      {/* Lower wick */}
      <path d="M 16.1 26.8 L 16.1 29.6" stroke="#2bcf90" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconTile({ s, uid }) {
  const r = Math.round(s.box * 0.26)
  return (
    <div
      className="ember-logo-tile"
      style={{
        width: s.box,
        height: s.box,
        background:
          'radial-gradient(130% 110% at 50% 12%, rgba(255,122,46,0.16), transparent 58%),' +
          'radial-gradient(120% 90% at 50% 108%, rgba(20,184,124,0.14), transparent 55%),' +
          '#101010',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: r,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 10px rgba(0,0,0,0.45)',
      }}
    >
      <EmberMark size={s.mark} uid={uid} />
    </div>
  )
}

function Wordmark({ s }) {
  return (
    <div
      className="ember-logo-wordmark"
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: s.name,
        letterSpacing: '-0.015em',
        userSelect: 'none',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.32ch',
      }}
    >
      <span style={{ fontWeight: 700, color: '#f2ede7' }}>Ember</span>
      <span style={{ fontWeight: 450, color: 'rgba(242,237,231,0.58)' }}>Finances</span>
    </div>
  )
}

/**
 * EmberLogo — reusable brand component.
 *
 * Props:
 *   size        'xs' | 'sm' | 'md' | 'lg'
 *   layout      'vertical' | 'horizontal'
 *   iconOnly    boolean
 *   showTagline boolean (retired, accepted but unused)
 *   className   string
 */
export function EmberLogo({
  size = 'md',
  layout = 'vertical',
  iconOnly = false,
  showTagline = false,
  className,
}) {
  const uid = useId().replace(/:/g, 'x')
  const s = SIZES[size] ?? SIZES.md
  const tile = <IconTile s={s} uid={uid} />

  if (iconOnly) return <div className={className}>{tile}</div>

  if (layout === 'horizontal') {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {tile}
        <Wordmark s={s} />
      </div>
    )
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {tile}
      <Wordmark s={s} />
    </div>
  )
}
