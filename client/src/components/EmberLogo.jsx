import { useId } from 'react'

const SIZES = {
  xs: { box: 36, mark: 22, name: 15 },
  sm: { box: 48, mark: 30, name: 17 },
  md: { box: 72, mark: 46, name: 22 },
  lg: { box: 96, mark: 60, name: 30 },
}

/**
 * Icon mark: a lit candle drawn as one fused, all-warm object.
 * All coordinates in a 32×32 viewBox.
 *
 * The flame's rounded base overlaps the candle body, and the body's own
 * gradient runs hottest at the top — so fire and wax melt into each other
 * instead of reading as two separate shapes. A cream core at the junction
 * bridges them. Single ember palette throughout (no cool colors).
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
        {/* Flame: red-hot tip cooling into amber where it meets the wax */}
        <linearGradient id={`emf-${uid}`} x1="16" y1="3.2" x2="16" y2="18.6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff4a21" />
          <stop offset="55%" stopColor="#ff8434" />
          <stop offset="100%" stopColor="#ffbe5f" />
        </linearGradient>
        {/* Body: molten at the rim, deep ember red at the base */}
        <linearGradient id={`emc-${uid}`} x1="16" y1="16.9" x2="16" y2="27.6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f56f2f" />
          <stop offset="45%" stopColor="#c8431c" />
          <stop offset="100%" stopColor="#99290f" />
        </linearGradient>
        {/* Core: the brightest point, bridging flame and body */}
        <linearGradient id={`emk-${uid}`} x1="16" y1="10.4" x2="16" y2="17.8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff1c6" />
          <stop offset="100%" stopColor="#ffd27f" />
        </linearGradient>
      </defs>

      {/* Candle body */}
      <rect x="11.3" y="16.9" width="9.4" height="10.7" rx="3.1" fill={`url(#emc-${uid})`} />

      {/* Flame — its base sinks into the molten top of the body */}
      <path
        d="M 17 3.2
           C 17 6.2 21.5 9.2 21.5 12.8
           C 21.5 16.2 19 18.6 16 18.6
           C 13 18.6 10.5 16.2 10.5 12.8
           C 10.5 10.8 11.6 9.3 12.8 7.9
           C 14.1 6.3 15.3 5 17 3.2 Z"
        fill={`url(#emf-${uid})`}
      />

      {/* Inner core */}
      <path
        d="M 16 10.4
           C 17.6 12.2 18.6 13.6 18.6 15
           C 18.6 16.7 17.5 17.8 16 17.8
           C 14.5 17.8 13.4 16.7 13.4 15
           C 13.4 13.6 14.4 12.2 16 10.4 Z"
        fill={`url(#emk-${uid})`}
      />
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
          'radial-gradient(120% 100% at 50% 34%, rgba(255,120,40,0.18), transparent 62%),' +
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
